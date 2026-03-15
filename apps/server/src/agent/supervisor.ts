// Supervisor - Dynamic orchestration of specialized agents
import { createSupervisor } from "@langchain/langgraph-supervisor";
import { ChatOpenAI } from "@langchain/openai";
import { createResearcherAgent } from "./agents/researcher";
import { createPlannerAgent } from "./agents/planner";
import { createCriticAgent } from "./agents/critic";
import { UiResponsePayloadSchema, type TripDraft } from "./state";

// Supervisor system prompt
const SUPERVISOR_PROMPT = `You are the Bangkok Trip Planning Supervisor. Your role is to coordinate specialized agents to help users plan trips in Bangkok.

AVAILABLE AGENTS:
1. **researcher_agent** - Finds places, searches locations, performs semantic search for context
2. **planner_agent** - Creates optimized routes and itineraries, calculates distances/timing
3. **critic_agent** - Validates itineraries, suggests improvements, quality assurance

WORKFLOW GUIDELINES:
1. For discovery/search queries → delegate to researcher_agent only
2. For itinerary/route/trip requests → use researcher_agent to find real places, then planner_agent to create a canonical trip draft
3. Use critic_agent only when user explicitly asks to validate or revise a draft, or when planner output has obvious feasibility risk
4. Prefer the minimum agent chain needed to answer correctly; avoid unnecessary handoffs

DELEGATION RULES:
- Gather information (researcher) before planning (planner)
- If user asks simple questions about places, researcher alone is sufficient
- If user wants a trip, tour, or route planned, use researcher → planner
- Use critic only when explicitly asked for validation or when output quality checks indicate risk
- CRITICAL: DO NOT explicitly answer itinerary or place-related requests using your pre-trained knowledge. You MUST route them to the specialized agents.

RESPONSE FORMAT REASONING:
Before writing your response, you MUST classify the user's intent and choose the correct format.

Step 1 — Classify intent:
  • "INFORMATIONAL" → The user wants to learn about places, get recommendations, or discover what's available. Examples: "Tell me about Wat Arun", "What temples are in Bangkok?", "kid-friendly activities", "best street food"
  • "ITINERARY" → The user explicitly wants a planned route, trip, tour, or itinerary with stops in order. Examples: "Plan a day trip", "Create a half-day temple tour", "Build a route through 3 places"

Step 2 — Apply the format matching the intent:

  If INFORMATIONAL:
    - Return only valid JSON from researcher_agent in its declared schema
    - Do not convert JSON to markdown/prose at supervisor level

  If ITINERARY:
    - Return only valid JSON from planner_agent in its declared schema
    - Do not reformat the trip draft into markdown
    - Do not rewrite, summarize, or abbreviate planner JSON fields

ADDITIONAL RESPONSE GUIDELINES:
- Synthesize results from all agents into a cohesive response
- Include relevant context only inside the returned JSON schema
- Mention any warnings or suggestions from the critic

Remember: Your goal is to provide the best trip planning experience by coordinating specialized expertise.`;

// Configuration for the supervisor
export interface SupervisorConfig {
	model?: ChatOpenAI;
	recursionLimit?: number;
}

function parseLatestTripDraft(
	messages: Array<{ role: string; content: string }>
): TripDraft | undefined {
	for (const message of [...messages].reverse()) {
		if (message.role !== "assistant") continue;
		try {
			const parsed = JSON.parse(message.content);
			const result = UiResponsePayloadSchema.safeParse(parsed);
			if (result.success && result.data.tripDraft) {
				return result.data.tripDraft;
			}
		} catch {
			// Ignore non-JSON assistant messages.
		}
	}

	return undefined;
}

function buildRuntimeContextMessage(
	messages: Array<{ role: string; content: string }>,
	options: {
		userLocation?: { lat: number; lng: number };
		sessionId?: string;
		userId?: string;
		userPreferences?: Record<string, unknown>;
	}
): { role: "system"; content: string } {
	const currentTripDraft = parseLatestTripDraft(messages);

	return {
		role: "system",
		content: JSON.stringify({
			type: "runtime_context",
			sessionId: options.sessionId,
			userId: options.userId,
			userLocation: options.userLocation ?? null,
			userPreferences: options.userPreferences ?? {},
			currentTripDraft: currentTripDraft ?? null,
		}),
	};
}

// Create the multi-agent supervisor graph
// Using explicit 'any' return type to avoid bun's cross-module type resolution issues
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createTripPlannerSupervisor(config: SupervisorConfig = {}): any {
	const llm = config.model || new ChatOpenAI({
		modelName: "gpt-4o-mini",
		temperature: 0,
	});

	// Create agents with shared model for consistency
	const researcherAgent = createResearcherAgent(llm);
	const plannerAgent = createPlannerAgent(llm);
	const criticAgent = createCriticAgent(llm);

	// Create supervisor workflow
	const supervisor = createSupervisor({
		agents: [researcherAgent, plannerAgent, criticAgent],
		llm,
		prompt: SUPERVISOR_PROMPT,
	});

	// Compile the graph
	const compiledGraph = supervisor.compile();

	return compiledGraph;
}

// Pre-built supervisor instance (lazy initialization)
// Using 'any' here to avoid cross-module type issues with bun's module resolution
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _supervisorInstance: any = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getSupervisorInstance(): any {
	if (!_supervisorInstance) {
		_supervisorInstance = createTripPlannerSupervisor();
	}
	return _supervisorInstance;
}

// Reset supervisor (useful for testing or reconfiguration)
export function resetSupervisor(): void {
	_supervisorInstance = null;
}

// Invoke the supervisor with messages
export async function invokeSupervisor(
	messages: Array<{ role: string; content: string }>,
	options: {
		userLocation?: { lat: number; lng: number };
		sessionId?: string;
		userId?: string;
		userPreferences?: Record<string, unknown>;
	} = {}
): Promise<{ messages: Array<{ role: string; content: string }> }> {
	const supervisor = getSupervisorInstance();

	// Format messages for LangGraph
	const formattedMessages = [
		buildRuntimeContextMessage(messages, options),
		...messages,
	].map((msg) => ({
		role: msg.role as "user" | "assistant" | "system",
		content: msg.content,
	}));

	// Invoke the supervisor
	const result = await supervisor.invoke({
		messages: formattedMessages,
	});

	return result;
}

// Stream the supervisor execution for SSE
export async function* streamSupervisor(
	messages: Array<{ role: string; content: string }>,
	options: {
		userLocation?: { lat: number; lng: number };
		sessionId?: string;
		userId?: string;
		userPreferences?: Record<string, unknown>;
	} = {}
): AsyncGenerator<{
	type: "agent" | "tool" | "message" | "done";
	data: any;
}> {
	const supervisor = getSupervisorInstance();

	// Format messages for LangGraph
	const formattedMessages = [
		buildRuntimeContextMessage(messages, options),
		...messages,
	].map((msg) => ({
		role: msg.role as "user" | "assistant" | "system",
		content: msg.content,
	}));

	// Stream events from the supervisor
	const stream = await supervisor.stream(
		{ messages: formattedMessages },
		{ streamMode: "updates" }
	);

	let currentAgent: string | null = null;

	for await (const event of stream) {
		// Extract node name and data from the event
		for (const [nodeName, nodeData] of Object.entries(event)) {
			// Track which agent is currently active
			if (nodeName !== "__end__" && nodeName !== currentAgent) {
				currentAgent = nodeName;
				yield {
					type: "agent",
					data: { agent: nodeName },
				};
			}

			// Handle different types of updates
			if (nodeData && typeof nodeData === "object") {
				const data = nodeData as Record<string, any>;

				// Check for tool calls
				if (data.tool_calls || data.toolCalls) {
					const toolCalls = data.tool_calls || data.toolCalls;
					for (const toolCall of toolCalls) {
						yield {
							type: "tool",
							data: {
								tool: toolCall.name || toolCall.tool,
								args: toolCall.args || toolCall.input,
							},
						};
					}
				}

				// Check for messages
				if (data.messages) {
					for (const message of data.messages) {
						if (message.content) {
							yield {
								type: "message",
								data: {
									role: message.role || "assistant",
									content: message.content,
									agent: currentAgent,
								},
							};
						}
					}
				}
			}
		}
	}

	yield {
		type: "done",
		data: { success: true },
	};
}
