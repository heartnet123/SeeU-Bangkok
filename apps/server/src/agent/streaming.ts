import {
	buildExecutionMessages,
	invokeSupervisor,
	resolveAgentExecutionPlan,
	streamSupervisor,
} from "./supervisor";
import { researcherAgent } from "./agents";
import { MemoryManager } from "./memory";
import { SessionMemory } from "./memory/session";
import {
	loadUserProfileSnapshot,
	normalizePersonalizationDefaults,
	rerankPlacesByPersonalization,
	type PersonalizationDefaults,
} from "./personalization";
import {
	PlannerAgentOutputSchema,
	ResearcherAgentOutputSchema,
	UiResponsePayloadSchema,
	type CandidatePlace,
	type TripDraft,
	type UiResponsePayload,
} from "./state";

export interface SSEEvent {
	event: "start" | "agent" | "tools" | "context" | "suggestions" | "itinerary" | "ui" | "message" | "error" | "done";
	data: string;
}

export interface AgentStreamOptions {
	messages: Array<{ role: string; content: string }>;
	userLocation?: { lat: number; lng: number };
	sessionId?: string;
	userId?: string;
	onEvent?: (event: SSEEvent) => Promise<void>;
}

type UiAction = {
	type: "add_all_to_trip" | "preview_itinerary" | "save_trip_draft";
	label: string;
};

function findLatestAssistantMessage(
	messages: Array<{ role?: string; content?: unknown }>
): string | null {
	for (const message of [...messages].reverse()) {
		if (
			message.role === "assistant" &&
			typeof message.content === "string" &&
			message.content.trim().length > 0
		) {
			return message.content;
		}
	}

	return null;
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

	let conversationMessages = messages;
	if (sessionId && messages.length === 1) {
		const history = await memory.getConversationHistory(20);
		if (history.length > 0) {
			conversationMessages = [...history, ...messages];
		}
	}

	const executionPlan = resolveAgentExecutionPlan(conversationMessages);

	let userPreferences: Record<string, unknown> = {};
	let personalizationDefaults: PersonalizationDefaults | null = null;
	if (userId) {
		userPreferences = await memory.getUserPreferences();
		const profile = await loadUserProfileSnapshot(userId);
		personalizationDefaults = normalizePersonalizationDefaults({
			profile,
			userPreferences,
		});
		userPreferences = {
			...userPreferences,
			personalization_defaults: personalizationDefaults,
		};
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
		if (executionPlan.mode === "direct_researcher") {
			yield {
				event: "agent",
				data: JSON.stringify({ agent: "researcher_agent" }),
			};

			const directResult = await researcherAgent.invoke({
				messages: buildExecutionMessages(conversationMessages, {
					userLocation,
					sessionId,
					userId,
					userPreferences,
				}),
			});
			const assistantContent = findLatestAssistantMessage(
				Array.isArray(directResult?.messages) ? directResult.messages : []
			);

			if (assistantContent) {
				lastAssistantMessage = assistantContent;
				try {
					const parsedJson = JSON.parse(assistantContent);
					const researcherParsed = ResearcherAgentOutputSchema.safeParse(parsedJson);
					if (researcherParsed.success) {
						const { summary, places } = researcherParsed.data;
						latestAssistantSummary = summary;
						lastAssistantMessage = summary;
						if (places.length > 0) {
							suggestedPlaces.push(...places);
							const rankedPlaces = rerankPlacesByPersonalization(
								places,
								personalizationDefaults,
							);
							yield {
								event: "context",
								data: JSON.stringify({
									documents: rankedPlaces.length,
									top_docs: rankedPlaces.slice(0, 3),
								}),
							};
							yield {
								event: "suggestions",
								data: JSON.stringify({ places: rankedPlaces }),
							};
						}
						yield {
							event: "message",
							data: summary,
						};
					} else {
						yield {
							event: "message",
							data: assistantContent,
						};
					}
				} catch {
					yield {
						event: "message",
						data: assistantContent,
					};
				}
			}
		} else {
			const stream = streamSupervisor(conversationMessages, {
				userLocation,
				sessionId,
				userId,
				userPreferences,
				includeCritic: executionPlan.includeCritic,
			});

			for await (const event of stream) {
				switch (event.type) {
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
								try {
									const parsed = JSON.parse(content);
									if (Array.isArray(parsed)) {
										const places = parsed.filter(
											(place) => place && typeof place === "object" && "id" in place
										) as CandidatePlace[];
										suggestedPlaces.push(...places);
									}
								} catch {
									// Ignore raw tool text.
								}
								break;
							}

							let parsedHandled = false;
							if (role === "assistant") {
								try {
									const parsedJson = JSON.parse(content);
									const plannerParsed = PlannerAgentOutputSchema.safeParse(parsedJson);
									if (plannerParsed.success) {
										const { summary, tripDraft } = plannerParsed.data;
										latestAssistantSummary = summary;
										lastAssistantMessage = summary;
										currentTripDraft = tripDraft;
										latestTripDraft = tripDraft;
										latestWarnings = tripDraft.warnings;
										parsedHandled = true;
									} else {
										const researcherParsed = ResearcherAgentOutputSchema.safeParse(parsedJson);
										if (researcherParsed.success) {
											const { summary, places } = researcherParsed.data;
											latestAssistantSummary = summary;
											lastAssistantMessage = summary;
											if (places.length > 0) suggestedPlaces.push(...places);
											parsedHandled = true;
										}
									}
								} catch {
									// Keep plain text fallback.
								}
							}

							if (event.data.agent === "researcher_agent" && suggestedPlaces.length > 0) {
								const rankedPlaces = rerankPlacesByPersonalization(
									suggestedPlaces,
									personalizationDefaults,
								);
								yield {
									event: "context",
									data: JSON.stringify({
										documents: rankedPlaces.length,
										top_docs: rankedPlaces.slice(0, 3),
									}),
								};

								yield {
									event: "suggestions",
									data: JSON.stringify({ places: rankedPlaces }),
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

							yield {
								event: "message",
								data: latestAssistantSummary || content,
							};
						}
						break;

					case "done":
						break;
				}
			}
		}

		const userMessage = messages[messages.length - 1];
		if (userMessage) {
			await memory.addMessage("user", userMessage.content);
		}

		const uniquePlaces = rerankPlacesByPersonalization(Array.from(
			new Map(
				suggestedPlaces
					.filter((place) => place && (place.id || place.slug || place.name))
					.map((place) => [String(place.id || place.slug || place.name), place])
			).values()
		), personalizationDefaults);

		if (lastAssistantMessage) {
			const actions: UiAction[] = [
				...(uniquePlaces.length > 0 ? [{ type: "add_all_to_trip", label: "Add all to trip" } as const] : []),
				...(latestTripDraft ? [{ type: "preview_itinerary", label: "Preview itinerary on map" } as const] : []),
				...(latestTripDraft ? [{ type: "save_trip_draft", label: "Save trip" } as const] : []),
			];
			const rawUiPayload: UiResponsePayload = {
				version: "1.0",
				intent: latestTripDraft || uniquePlaces.length > 0 ? (latestTripDraft ? "itinerary" : "place_recommendation") : "chat",
				sessionId: memory.getSessionId() || undefined,
				summary: latestAssistantSummary || lastAssistantMessage,
				places: uniquePlaces,
				tripDraft: latestTripDraft,
				actions,
				warnings: latestWarnings,
				raw_text: lastAssistantMessage,
			};

			const validatedUi = UiResponsePayloadSchema.safeParse(rawUiPayload);
			latestUiPayload = validatedUi.success
				? validatedUi.data
				: {
					version: "1.0" as const,
					intent: "chat" as const,
					sessionId: memory.getSessionId() || undefined,
					summary: latestAssistantSummary || lastAssistantMessage,
					places: [],
					tripDraft: null,
					actions: [],
					warnings: [],
					raw_text: lastAssistantMessage,
				};

			yield {
				event: "ui",
				data: JSON.stringify(latestUiPayload),
			};
		}

		if (latestUiPayload) {
			await memory.addMessage("assistant", JSON.stringify(latestUiPayload));
		} else if (lastAssistantMessage) {
			await memory.addMessage("assistant", lastAssistantMessage);
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
					includeCritic: executionPlan.includeCritic,
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
					let safeSummary = assistantMessage.content;
					let safePlaces: CandidatePlace[] = [];
					let safeTripDraft: TripDraft | null = null;
					let safeWarnings: string[] = [];

					try {
						const parsed = JSON.parse(assistantMessage.content);
						const plannerParsed = PlannerAgentOutputSchema.safeParse(parsed);
						if (plannerParsed.success) {
							safeSummary = plannerParsed.data.summary;
							safeTripDraft = plannerParsed.data.tripDraft;
							safeWarnings = plannerParsed.data.tripDraft.warnings;
						}

						const researcherParsed = ResearcherAgentOutputSchema.safeParse(parsed);
						if (researcherParsed.success) {
							safeSummary = researcherParsed.data.summary;
							safePlaces = researcherParsed.data.places;
						}
					} catch {
						// Keep plain text fallback.
					}

					yield {
						event: "message",
						data: safeSummary,
					};

					const fallbackUiParsed = UiResponsePayloadSchema.safeParse({
						version: "1.0",
						intent: safeTripDraft ? "itinerary" : safePlaces.length > 0 ? "place_recommendation" : "chat",
						sessionId: memory.getSessionId() || undefined,
						summary: safeSummary,
						places: safePlaces,
						tripDraft: safeTripDraft,
						actions: [
							...(safePlaces.length > 0 ? [{ type: "add_all_to_trip", label: "Add all to trip" } as const] : []),
							...(safeTripDraft ? [{ type: "preview_itinerary", label: "Preview itinerary on map" } as const] : []),
							...(safeTripDraft ? [{ type: "save_trip_draft", label: "Save trip" } as const] : []),
						],
						warnings: safeWarnings,
						raw_text: assistantMessage.content,
					});

					yield {
						event: "ui",
						data: JSON.stringify(
							fallbackUiParsed.success
								? fallbackUiParsed.data
								: {
									version: "1.0",
									intent: "chat",
									sessionId: memory.getSessionId() || undefined,
									summary: safeSummary,
									places: [],
									tripDraft: null,
									actions: [],
									warnings: [],
									raw_text: assistantMessage.content,
								}
						),
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
			if (event.event === "error") {
				return {
					success: false,
					error: event.data,
				};
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
