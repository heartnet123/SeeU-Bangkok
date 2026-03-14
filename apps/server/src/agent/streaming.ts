// Streaming module - SSE adapter for the multi-agent supervisor
import { streamSupervisor, invokeSupervisor } from "./supervisor";
import { MemoryManager } from "./memory";
import { SessionMemory } from "./memory/session";
import {
	ItinerarySchema,
	PlannerAgentOutputSchema,
	ResearcherAgentOutputSchema,
	UiResponsePayloadSchema,
	type Itinerary,
	type PlaceSuggestion,
	type UiResponsePayload,
} from "./state";

/**
 * SSE Event types matching the existing frontend expectations
 */
export interface SSEEvent {
	event: "start" | "agent" | "tools" | "context" | "suggestions" | "itinerary" | "ui" | "message" | "error" | "done";
	data: string;
}


/**
 * Options for the agent stream
 */
export interface AgentStreamOptions {
	messages: Array<{ role: string; content: string }>;
	userLocation?: { lat: number; lng: number };
	sessionId?: string;
	userId?: string;
	onEvent?: (event: SSEEvent) => Promise<void>;
}

/**
 * Stream the multi-agent supervisor execution with SSE events
 * Compatible with the existing frontend SSE handling
 */
export async function* streamAgentExecution(
	options: AgentStreamOptions
): AsyncGenerator<SSEEvent> {
	const { messages, userLocation, sessionId, userId } = options;

	// Initialize memory manager and ensure session exists before emitting start
	const memory = new MemoryManager({ sessionId, userId });
	const session = await memory.getOrCreateSession();

	// Save first user message as session title if this is a new session
	const firstUserMessage = messages.find((m) => m.role === "user")?.content?.slice(0, 80);
	if (firstUserMessage && !session.metadata?.title) {
		await SessionMemory.updateSessionMetadata(session.id, {
			...session.metadata,
			title: firstUserMessage,
		});
	}

	// Emit start event with the real session ID (including newly created ones)
	yield {
		event: "start",
		data: JSON.stringify({ status: "processing", sessionId: memory.getSessionId() }),
	};

	// Get conversation history if resuming session
	let conversationMessages = messages;
	if (sessionId && messages.length === 1) {
		// If resuming with just one new message, get history
		const history = await memory.getConversationHistory(20);
		if (history.length > 0) {
			conversationMessages = [...history, ...messages];
		}
	}

	// Get user preferences for context
	let userPreferences: Record<string, any> = {};
	if (userId) {
		userPreferences = await memory.getUserPreferences();
	}

	// Track state for aggregating results
	const toolsUsed: Array<{ tool: string; args: any }> = [];
	const suggestedPlaces: Array<PlaceSuggestion> = [];
	let currentItinerary: Itinerary | null = null;
	let latestItinerary: Itinerary | null = null;
	let lastAgent: string | null = null;
	let lastAssistantMessage: string | null = null;
	let latestAssistantSummary: string | null = null;

	try {
		// Stream from the supervisor
		const stream = streamSupervisor(conversationMessages, {
			userLocation,
			sessionId,
			userId,
		});

		for await (const event of stream) {
			switch (event.type) {
				case "agent":
					// New agent is active
					if (event.data.agent !== lastAgent) {
						lastAgent = event.data.agent;
						yield {
							event: "agent",
							data: JSON.stringify({ agent: event.data.agent }),
						};
					}
					break;

				case "tool":
					// Tool was called
					toolsUsed.push({
						tool: event.data.tool,
						args: event.data.args,
					});
					yield {
						event: "tools",
						data: JSON.stringify({ tools: toolsUsed }),
					};

					// Extract places from tool results for suggestions
					if (event.data.result) {
						const result = event.data.result;
						if (Array.isArray(result)) {
							// search_places or nearby_places result
							const places = result.filter((p: any) => p.lat && p.lng);
							suggestedPlaces.push(...places);
						}
						if (result.stops) {
							// plan_itinerary result
							currentItinerary = result;
							latestItinerary = result;
						}
					}
					break;

				case "message":
					// Message from an agent
					if (event.data.content) {
						const content = event.data.content;
						const role = event.data.role || "assistant";

						// Tool result messages carry structured data (e.g. place arrays).
						// Extract place data from researcher tool results to populate suggestedPlaces.
						if (role === "tool" && lastAgent === "researcher_agent") {
							try {
								const parsed = JSON.parse(content);
								if (Array.isArray(parsed)) {
									const places = parsed.filter((p: any) => p.lat && p.lng);
									if (places.length > 0) {
										suggestedPlaces.push(...places);
									}
								}
							} catch {
								// Not JSON — ignore
							}
							// Don't forward raw tool results to the frontend as chat text
							break;
						}

						let parsedHandled = false;
						if (role === "assistant") {
							try {
								const parsedJson = JSON.parse(content);
								const plannerParsed = PlannerAgentOutputSchema.safeParse(parsedJson);
								if (plannerParsed.success) {
									const { summary, itinerary } = plannerParsed.data;
									latestAssistantSummary = summary;
									lastAssistantMessage = summary;
									currentItinerary = itinerary;
									latestItinerary = itinerary;
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
								// Non-JSON assistant text fallback
							}
						}

						// Send context event for retrieved docs
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

						// Send itinerary event if we have one
						if (currentItinerary) {
							yield {
								event: "itinerary",
								data: JSON.stringify(currentItinerary),
							};
							currentItinerary = null; // Only send once
						}

						if (!parsedHandled) {
							// Track assistant message for storage (fallback)
							lastAssistantMessage = content;
						}

						// Send user-facing message as summary when available; otherwise raw content
						yield {
							event: "message",
							data: latestAssistantSummary || content,
						};
					}
					break;

				case "done":
					// Store the conversation turn in session memory
					{
						const userMessage = messages[messages.length - 1];
						if (userMessage) {
							await memory.addMessage("user", userMessage.content);
						}
						if (lastAssistantMessage) {
							await memory.addMessage("assistant", lastAssistantMessage);
						}
					}
					break;
			}
		}

		const uniquePlaces = Array.from(
			new Map(
				suggestedPlaces
					.filter((p) => p && (p.id || p.slug || p.name))
					.map((p) => [String(p.id || p.slug || p.name), p])
			).values()
		);

		if (lastAssistantMessage) {
			const rawUiPayload: UiResponsePayload = {
				version: "1.0",
				intent: latestItinerary || uniquePlaces.length > 0 ? (latestItinerary ? "itinerary" : "place_recommendation") : "chat",
				summary: latestAssistantSummary || lastAssistantMessage,
				places: uniquePlaces,
				itinerary: latestItinerary,
				actions: [
					...(uniquePlaces.length > 0 ? [{ type: "add_all_to_trip", label: "Add all to trip" }] : []),
					...(latestItinerary ? [{ type: "preview_itinerary", label: "Preview itinerary on map" }] : []),
				],
				raw_text: lastAssistantMessage,
			};

			const validatedUi = UiResponsePayloadSchema.safeParse(rawUiPayload);
			const uiPayload = validatedUi.success
				? validatedUi.data
				: {
					version: "1.0" as const,
					intent: "chat" as const,
					summary: latestAssistantSummary || lastAssistantMessage,
					places: [],
					itinerary: null,
					actions: [],
					raw_text: lastAssistantMessage,
				};

			yield {
				event: "ui",
				data: JSON.stringify(uiPayload),
			};
		}

		// Emit done event
		yield {
			event: "done",
			data: "ok",
		};
	} catch (error: any) {
		const streamErrorMessage = error?.message || "Agent processing failed";
		const isStreamInputIssue = /input stream/i.test(streamErrorMessage);

		// Fallback for flaky model streaming/parser errors: run a non-streamed invoke.
		if (isStreamInputIssue) {
			try {
				const fallbackResult = await invokeSupervisor(conversationMessages, {
					userLocation,
					sessionId,
					userId,
				});
				const assistantMessage = [...(fallbackResult.messages || [])]
					.reverse()
					.find(
						(msg) =>
							msg.role === "assistant" &&
							typeof msg.content === "string" &&
							msg.content.trim().length > 0
					);

				if (assistantMessage?.content) {
					let safeSummary = assistantMessage.content;
					let safePlaces: PlaceSuggestion[] = [];
					let safeItinerary: Itinerary | null = null;

					try {
						const parsed = JSON.parse(assistantMessage.content);
						const plannerParsed = PlannerAgentOutputSchema.safeParse(parsed);
						if (plannerParsed.success) {
							safeSummary = plannerParsed.data.summary;
							safeItinerary = plannerParsed.data.itinerary;
						}
						const researcherParsed = ResearcherAgentOutputSchema.safeParse(parsed);
						if (researcherParsed.success) {
							safeSummary = researcherParsed.data.summary;
							safePlaces = researcherParsed.data.places;
						}
					} catch {
						// keep plain text fallback
					}

					yield {
						event: "message",
						data: safeSummary,
					};
					const fallbackUiParsed = UiResponsePayloadSchema.safeParse({
						version: "1.0",
						intent: safeItinerary ? "itinerary" : safePlaces.length > 0 ? "place_recommendation" : "chat",
						summary: safeSummary,
						places: safePlaces,
						itinerary: safeItinerary,
						actions: [
							...(safePlaces.length > 0 ? [{ type: "add_all_to_trip", label: "Add all to trip" }] : []),
							...(safeItinerary ? [{ type: "preview_itinerary", label: "Preview itinerary on map" }] : []),
						],
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
									summary: safeSummary,
									places: [],
									itinerary: null,
									actions: [],
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
				// Continue to standard error emission below.
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

/**
 * Run the agent without streaming (for non-streaming requests)
 */
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
	itinerary?: Itinerary;
	places?: any[];
}> {
	const events: SSEEvent[] = [];
	let finalResponse = "";
	let finalItinerary: Itinerary | undefined;
	const toolsUsed: string[] = [];
	const places: any[] = [];

	try {
		for await (const event of streamAgentExecution(options)) {
			events.push(event);

			if (event.event === "message") {
				finalResponse = event.data;
			}
			if (event.event === "itinerary") {
				finalItinerary = JSON.parse(event.data);
			}
			if (event.event === "tools") {
				const data = JSON.parse(event.data);
				for (const tool of data.tools) {
					if (!toolsUsed.includes(tool.tool)) {
						toolsUsed.push(tool.tool);
					}
				}
			}
			if (event.event === "suggestions") {
				const data = JSON.parse(event.data);
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
			itinerary: finalItinerary,
			places,
		};
	} catch (error: any) {
		return {
			success: false,
			error: error.message || "Agent processing failed",
		};
	}
}
