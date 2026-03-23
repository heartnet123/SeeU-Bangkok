// Supervisor - Dynamic orchestration of specialized agents
import { createSupervisor } from "@langchain/langgraph-supervisor";
import { ChatOpenAI } from "@langchain/openai";
import { createResearcherAgent } from "./agents/researcher";
import { createPlannerAgent } from "./agents/planner";
import { createCriticAgent } from "./agents/critic";
import { UiResponsePayloadSchema, type TripDraft } from "./state";
import { DEFAULT_AGENT_MODEL } from "./config";

interface CompiledSupervisorGraph {
	invoke(input: { messages: unknown[] }): Promise<{ messages: Array<{ role: string; content: string }> }>;
	stream(input: { messages: unknown[] }, options?: { streamMode?: string }): Promise<AsyncIterable<Record<string, unknown>>>;
}

export type AgentExecutionIntent = "informational" | "itinerary";

export interface AgentExecutionPlan {
	mode: "direct_researcher" | "supervisor";
	intent: AgentExecutionIntent;
	includeCritic: boolean;
}

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
Before writing your response, you MUST classify the user's intent.
  • "INFORMATIONAL" → The user wants to learn about places, get recommendations, or discover what's available. Examples: "Tell me about Wat Arun", "What temples are in Bangkok?", "kid-friendly activities", "best street food"
  • "ITINERARY" → The user explicitly wants a planned route, trip, tour, or itinerary with stops in order. Examples: "Plan a day trip", "Create a half-day temple tour", "Build a route through 3 places"

If INFORMATIONAL, delegate to researcher_agent and output its JSON.
If ITINERARY, delegate to planner_agent and output its JSON.

Do not reformat JSON into markdown. Return valid JSON only.

Remember: Your goal is to provide the best trip planning experience by coordinating specialized expertise.`;

// Configuration for the supervisor
export interface SupervisorConfig {
	model?: ChatOpenAI;
	recursionLimit?: number;
	includeCritic?: boolean;
}

function getLatestUserMessage(
	messages: Array<{ role: string; content: string }>
): string {
	for (const message of [...messages].reverse()) {
		if (message.role === "user" && typeof message.content === "string") {
			return message.content;
		}
	}

	return "";
}

export function classifyIntent(input: string): AgentExecutionIntent {
	const normalized = input.trim().toLowerCase();
	if (!normalized) {
		return "informational";
	}

	const itineraryPattern =
		/\b(plan|create|build|arrange|design|itinerary|route|trip|tour|schedule)\b/;
	return itineraryPattern.test(normalized) ? "itinerary" : "informational";
}

export function shouldUseCriticAgent(input: string): boolean {
	const normalized = input.trim().toLowerCase();
	if (!normalized) {
		return false;
	}

	return /\b(validate|validation|review|revise|revision|improve|check|audit)\b/.test(normalized);
}

export function resolveAgentExecutionPlan(
	messages: Array<{ role: string; content: string }>
): AgentExecutionPlan {
	const latestUserMessage = getLatestUserMessage(messages);
	const intent = classifyIntent(latestUserMessage);
	const includeCritic = shouldUseCriticAgent(latestUserMessage);

	return {
		mode: intent === "informational" ? "direct_researcher" : "supervisor",
		intent,
		includeCritic,
	};
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

export function buildExecutionMessages(
	messages: Array<{ role: string; content: string }>,
	options: {
		userLocation?: { lat: number; lng: number };
		sessionId?: string;
		userId?: string;
		userPreferences?: Record<string, unknown>;
	}
): Array<{ role: "user" | "assistant" | "system"; content: string }> {
	return [
		buildRuntimeContextMessage(messages, options),
		...messages,
	].map((msg) => ({
		role: msg.role as "user" | "assistant" | "system",
		content: msg.content,
	}));
}

// Create the multi-agent supervisor graph
export function createTripPlannerSupervisor(config: SupervisorConfig = {}): CompiledSupervisorGraph {
	const llm = config.model || new ChatOpenAI({
		modelName: DEFAULT_AGENT_MODEL,
		temperature: 0,
	});

	// Create agents with shared model for consistency
	const researcherAgent = createResearcherAgent(llm);
	const plannerAgent = createPlannerAgent(llm);
	const agents = config.includeCritic
		? [researcherAgent, plannerAgent, createCriticAgent(llm)]
		: [researcherAgent, plannerAgent];

	// Create supervisor workflow
	const supervisor = createSupervisor({
		agents,
		llm,
		prompt: SUPERVISOR_PROMPT,
	});

	// Compile the graph
	const compiledGraph = supervisor.compile();

	return compiledGraph;
}

// Pre-built supervisor instance (lazy initialization)
let _supervisorInstance: CompiledSupervisorGraph | null = null;

export function getSupervisorInstance(): CompiledSupervisorGraph {
	if (!_supervisorInstance) {
		_supervisorInstance = createTripPlannerSupervisor({ includeCritic: false });
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
		includeCritic?: boolean;
	} = {}
): Promise<{ messages: Array<{ role: string; content: string }> }> {
	const supervisor =
		options.includeCritic === undefined
			? getSupervisorInstance()
			: createTripPlannerSupervisor({ includeCritic: options.includeCritic });

	// Format messages for LangGraph
	const formattedMessages = buildExecutionMessages(messages, options);

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
		includeCritic?: boolean;
	} = {}
): AsyncGenerator<{
	type: "agent" | "tool" | "message" | "done";
	data: Record<string, unknown>;
}> {
	const supervisor =
		options.includeCritic === undefined
			? getSupervisorInstance()
			: createTripPlannerSupervisor({ includeCritic: options.includeCritic });

	// Format messages for LangGraph
	const formattedMessages = buildExecutionMessages(messages, options);

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
				const data = nodeData as Record<string, unknown>;

				// Check for tool calls
				const toolCalls = Array.isArray(data.tool_calls)
					? data.tool_calls
					: Array.isArray(data.toolCalls)
						? data.toolCalls
						: null;
				if (toolCalls) {
					for (const toolCall of toolCalls) {
						if (toolCall && typeof toolCall === "object") {
							const tc = toolCall as Record<string, unknown>;
							yield {
								type: "tool",
								data: {
									tool: tc.name ?? tc.tool ?? "",
									args: tc.args ?? tc.input ?? {},
								},
							};
						}
					}
				}

				// Check for messages
				if (Array.isArray(data.messages)) {
					for (const message of data.messages) {
						if (message && typeof message === "object") {
							const msg = message as Record<string, unknown>;
							if (msg.content) {
								yield {
									type: "message",
									data: {
										role: msg.role ?? "assistant",
										content: msg.content,
										agent: currentAgent,
									},
								};
							}
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
