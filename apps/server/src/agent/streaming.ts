// Streaming module - SSE adapter for the multi-agent supervisor
import { streamSupervisor, invokeSupervisor } from "./supervisor";
import { MemoryManager } from "./memory";
import type { Itinerary } from "./state";

/**
 * SSE Event types matching the existing frontend expectations
 */
export interface SSEEvent {
	event: "start" | "agent" | "tools" | "context" | "suggestions" | "itinerary" | "message" | "error" | "done";
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

	// Emit start event immediately to open the SSE stream early.
	yield {
		event: "start",
		data: JSON.stringify({ status: "processing", sessionId }),
	};

	// Initialize memory manager if we have session/user context
	const memory = new MemoryManager({ sessionId, userId });

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
	const suggestedPlaces: Array<any> = [];
	let currentItinerary: Itinerary | null = null;
	let lastAgent: string | null = null;

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
						}
					}
					break;

				case "message":
					// Message from an agent
					if (event.data.content) {
						// Check if content contains itinerary data
						const content = event.data.content;

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

						// Send the message
						yield {
							event: "message",
							data: content,
						};
					}
					break;

				case "done":
					// Store the conversation if we have memory
					if (sessionId) {
						// Store user message
						const userMessage = messages[messages.length - 1];
						if (userMessage) {
							await memory.addMessage("user", userMessage.content);
						}
					}
					break;
			}
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
					yield {
						event: "message",
						data: assistantMessage.content,
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
