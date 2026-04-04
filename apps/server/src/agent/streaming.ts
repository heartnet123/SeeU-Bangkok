import { invokeSupervisor, streamSupervisor } from "./supervisor";
import { MemoryManager } from "./memory";
import { SessionMemory } from "./memory/session";
import { type CandidatePlace, type TripDraft, type UiResponsePayload } from "./state";
import { parseAssistantPayload, parseToolPlacesPayload } from "./payload-parsing";
import { buildUiPayload } from "./ui-payload";

export interface SSEEvent {
	event: "start" | "stage" | "agent" | "tools" | "context" | "suggestions" | "itinerary" | "ui" | "message" | "error" | "done";
	data: string;
}

export interface AgentStreamOptions {
	messages: Array<{ role: string; content: string }>;
	userLocation?: { lat: number; lng: number };
	sessionId?: string;
	userId?: string;
	onEvent?: (event: SSEEvent) => Promise<void>;
}

async function hydrateConversationMessages(
	memory: MemoryManager,
	messages: Array<{ role: string; content: string }>,
	sessionId?: string
): Promise<Array<{ role: string; content: string }>> {
	if (!sessionId || messages.length !== 1) {
		return messages;
	}

	const history = await memory.getConversationHistory(20);
	return history.length > 0 ? [...history, ...messages] : messages;
}

async function persistConversationResult(options: {
	memory: MemoryManager;
	messages: Array<{ role: string; content: string }>;
	latestUiPayload: UiResponsePayload | null;
	lastAssistantMessage: string | null;
}): Promise<void> {
	const userMessage = options.messages[options.messages.length - 1];
	if (userMessage) {
		await options.memory.addMessage("user", userMessage.content);
	}

	if (options.latestUiPayload) {
		await options.memory.addMessage("assistant", JSON.stringify(options.latestUiPayload));
		return;
	}

	if (options.lastAssistantMessage) {
		await options.memory.addMessage("assistant", options.lastAssistantMessage);
	}
}

function createFallbackUiPayload(options: {
	sessionId?: string;
	assistantContent: string;
}): { summary: string; uiPayload: UiResponsePayload } {
	const parsed = parseAssistantPayload(options.assistantContent);

	return {
		summary: parsed.summary,
		uiPayload: parsed.uiPayload ?? buildUiPayload({
			sessionId: options.sessionId,
			summary: parsed.summary,
			rawText: parsed.rawText,
			places: parsed.places,
			tripDraft: parsed.tripDraft,
			warnings: parsed.warnings,
		}),
	};
}

function looksLikeJsonBlob(content: string): boolean {
	const trimmed = content.trim();
	return (
		(trimmed.startsWith("{") && trimmed.endsWith("}")) ||
		(trimmed.startsWith("[") && trimmed.endsWith("]"))
	);
}

function buildSafeMessageEventData(options: {
	content: string;
	latestAssistantSummary: string | null;
}): string | null {
	if (options.latestAssistantSummary) {
		return options.latestAssistantSummary;
	}

	if (looksLikeJsonBlob(options.content)) {
		const parsed = parseAssistantPayload(options.content);
		if (parsed.source !== "text") {
			return parsed.summary;
		}
		return null;
	}

	return options.content;
}

export async function* streamAgentExecution(
	options: AgentStreamOptions
): AsyncGenerator<SSEEvent> {
	const { messages, userLocation, sessionId, userId } = options;

	const memory = new MemoryManager({ sessionId, userId });
	const session = await memory.getOrCreateSession();

	const firstUserMessage = messages.find((message) => message.role === "user")?.content?.slice(0, 80);
	if (firstUserMessage && !session.metadata?.title) {
		await SessionMemory.updateSessionMetadata(session.id, {
			...session.metadata,
			title: firstUserMessage,
		});
	}

	yield {
		event: "start",
		data: JSON.stringify({ status: "processing", sessionId: memory.getSessionId() }),
	};

	const conversationMessages = await hydrateConversationMessages(memory, messages, sessionId);

	let userPreferences: Record<string, unknown> = {};
	if (userId) {
		userPreferences = await memory.getUserPreferences();
	}

	const toolsUsed: Array<{ tool: string; args: unknown }> = [];
	const suggestedPlaces: CandidatePlace[] = [];
	let currentTripDraft: TripDraft | null = null;
	let latestTripDraft: TripDraft | null = null;
	let lastAgent: string | null = null;
	let lastAssistantMessage: string | null = null;
	let latestAssistantSummary: string | null = null;
	let latestWarnings: string[] = [];
	let latestUiPayload: UiResponsePayload | null = null;

	try {
		const stream = streamSupervisor(conversationMessages, {
			userLocation,
			sessionId,
			userId,
			userPreferences,
		});

		for await (const event of stream) {
			switch (event.type) {
				case "stage":
					yield {
						event: "stage",
						data: JSON.stringify(event.data),
					};
					break;

				case "agent":
					if (event.data.agent !== lastAgent) {
						lastAgent = event.data.agent;
						yield {
							event: "agent",
							data: JSON.stringify({ agent: event.data.agent }),
						};
					}
					break;

				case "tool":
					toolsUsed.push({
						tool: event.data.tool,
						args: event.data.args,
					});
					yield {
						event: "tools",
						data: JSON.stringify({ tools: toolsUsed }),
					};
					break;

				case "message":
					if (!event.data.content) break;

					{
						const content = event.data.content;
						const role = event.data.role || "assistant";

						if (role === "tool" && lastAgent === "researcher_agent") {
							suggestedPlaces.push(...parseToolPlacesPayload(content));
							break;
						}

						let parsedHandled = false;
						if (role === "assistant") {
							const parsed = parseAssistantPayload(content);
							if (parsed.source !== "text") {
								latestAssistantSummary = parsed.summary;
								lastAssistantMessage = parsed.summary;
								suggestedPlaces.push(...parsed.places);
								if (parsed.tripDraft) {
									currentTripDraft = parsed.tripDraft;
									latestTripDraft = parsed.tripDraft;
									latestWarnings = parsed.warnings;
								}
								if (parsed.uiPayload) {
									latestUiPayload = parsed.uiPayload;
								}
								parsedHandled = true;
							}
						}

						if (event.data.agent === "researcher_agent" && suggestedPlaces.length > 0) {
							yield {
								event: "context",
								data: JSON.stringify({
									documents: suggestedPlaces.length,
									top_docs: suggestedPlaces.slice(0, 3),
								}),
							};

							yield {
								event: "suggestions",
								data: JSON.stringify({ places: suggestedPlaces }),
							};
						}

						if (currentTripDraft) {
							yield {
								event: "itinerary",
								data: JSON.stringify(currentTripDraft),
							};
							currentTripDraft = null;
						}

						if (!parsedHandled) {
							lastAssistantMessage = content;
						}

						const safeMessageData = buildSafeMessageEventData({
							content,
							latestAssistantSummary,
						});
						if (safeMessageData) {
							yield {
								event: "message",
								data: safeMessageData,
							};
						}
					}
					break;

				case "done":
					await persistConversationResult({
						memory,
						messages,
						latestUiPayload,
						lastAssistantMessage,
					});
					break;
			}
		}

		if (lastAssistantMessage && !latestUiPayload) {
			latestUiPayload = buildUiPayload({
				sessionId: memory.getSessionId() || undefined,
				summary: latestAssistantSummary || lastAssistantMessage,
				rawText: lastAssistantMessage,
				places: suggestedPlaces,
				tripDraft: latestTripDraft,
				warnings: latestWarnings,
			});
		}

		if (latestUiPayload) {
			yield {
				event: "ui",
				data: JSON.stringify(latestUiPayload),
			};
		}

		yield {
			event: "done",
			data: "ok",
		};
	} catch (error: unknown) {
		const streamErrorMessage =
			error instanceof Error ? error.message : "Agent processing failed";
		const isStreamInputIssue = /input stream/i.test(streamErrorMessage);

		if (isStreamInputIssue) {
			try {
				const fallbackResult = await invokeSupervisor(conversationMessages, {
					userLocation,
					sessionId,
					userId,
					userPreferences,
				});
				const assistantMessage = [...(fallbackResult.messages || [])]
					.reverse()
					.find(
						(message) =>
							message.role === "assistant" &&
							typeof message.content === "string" &&
							message.content.trim().length > 0
					);

				if (assistantMessage?.content) {
					const { summary: safeSummary, uiPayload } = createFallbackUiPayload({
						sessionId: memory.getSessionId() || undefined,
						assistantContent: assistantMessage.content,
					});

					yield {
						event: "message",
						data: safeSummary,
					};

					yield {
						event: "ui",
						data: JSON.stringify(uiPayload),
					};
					yield {
						event: "done",
						data: "ok",
					};
					return;
				}
			} catch {
				// Fall through to standard error response.
			}
		}

		yield {
			event: "error",
			data: streamErrorMessage,
		};
		yield {
			event: "done",
			data: "error",
		};
	}
}

export async function runAgent(options: {
	messages: Array<{ role: string; content: string }>;
	userLocation?: { lat: number; lng: number };
	sessionId?: string;
	userId?: string;
}): Promise<{
	success: boolean;
	response?: string;
	error?: string;
	tools_used?: string[];
	tripDraft?: TripDraft;
	places?: CandidatePlace[];
}> {
	let finalResponse = "";
	let finalTripDraft: TripDraft | undefined;
	const toolsUsed: string[] = [];
	const places: CandidatePlace[] = [];

	try {
		for await (const event of streamAgentExecution(options)) {
			if (event.event === "message") {
				finalResponse = event.data;
			}
			if (event.event === "itinerary") {
				finalTripDraft = JSON.parse(event.data);
			}
			if (event.event === "tools") {
				const data = JSON.parse(event.data) as { tools: Array<{ tool: string }> };
				for (const tool of data.tools) {
					if (!toolsUsed.includes(tool.tool)) {
						toolsUsed.push(tool.tool);
					}
				}
			}
			if (event.event === "suggestions") {
				const data = JSON.parse(event.data) as { places: CandidatePlace[] };
				places.push(...data.places);
			}
			if (event.event === "ui") {
				const data = JSON.parse(event.data) as UiResponsePayload;
				if (!finalResponse && typeof data.summary === "string") {
					finalResponse = data.summary;
				}
			}
			if (event.event === "error") {
				return {
					success: false,
					error: event.data,
				};
			}
		}

		if (!finalResponse) {
			const fallbackResult = await invokeSupervisor(options.messages, {
				userLocation: options.userLocation,
				sessionId: options.sessionId,
				userId: options.userId,
			});
			const assistantMessage = [...(fallbackResult.messages || [])]
				.reverse()
				.find(
					(message) =>
						message.role === "assistant" &&
						typeof message.content === "string" &&
						message.content.trim().length > 0
				);

			if (assistantMessage?.content) {
				const parsed = parseAssistantPayload(assistantMessage.content);
				finalResponse = parsed.summary || assistantMessage.content;
			}
		}

		return {
			success: true,
			response: finalResponse,
			tools_used: toolsUsed,
			tripDraft: finalTripDraft,
			places,
		};
	} catch (error: unknown) {
		return {
			success: false,
			error: error instanceof Error ? error.message : "Agent processing failed",
		};
	}
}
