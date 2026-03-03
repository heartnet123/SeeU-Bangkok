// Supervisor - Dynamic orchestration of specialized agents
import { createSupervisor } from "@langchain/langgraph-supervisor";
import { ChatOpenAI } from "@langchain/openai";
import { createResearcherAgent } from "./agents/researcher";
import { createPlannerAgent } from "./agents/planner";
import { createCriticAgent } from "./agents/critic";

// Supervisor system prompt
const SUPERVISOR_PROMPT = `You are the Bangkok Trip Planning Supervisor. Your role is to coordinate specialized agents to help users plan trips in Bangkok.

AVAILABLE AGENTS:
1. **researcher_agent** - Finds places, searches locations, performs semantic search for context
2. **planner_agent** - Creates optimized routes and itineraries, calculates distances/timing
3. **critic_agent** - Validates itineraries, suggests improvements, quality assurance

WORKFLOW GUIDELINES:
1. For discovery/search queries → delegate to researcher_agent first
2. For ANY itinerary, route, plan, or trip requests (e.g., "half-day", "family of 4", "trip to X") → you MUST use researcher_agent to find real places FIRST, then planner_agent to create the routes. 
3. For validation requests → use critic_agent to validate existing itineraries
4. For complex requests → chain agents: researcher → planner → critic

DELEGATION RULES:
- Always gather information (researcher) before planning (planner)
- Always validate (critic) after planning for quality itineraries
- If user asks simple questions about places, researcher alone is sufficient
- If user wants a trip, tour, or route planned, use full flow: researcher → planner → critic
- CRITICAL: DO NOT explicitly answer itinerary or place-related requests using your pre-trained knowledge. You MUST route them to the specialized agents, even if the query is general (e.g. "kid-friendly activities").

RESPONSE GUIDELINES:
- Synthesize results from all agents into a cohesive response
- CRITICAL: When presenting an itinerary created by the planner_agent, you MUST use the exact markdown template and exact numeric coordinates it provides. Do NOT rewrite, summarize, or abbreviate the itinerary stops.
- CRITICAL: You MUST include ALL 4 fields ('- Location:', '- Duration:', '- Distance from previous:', '- Description:') for EVERY SINGLE STOP in the final response. Omitting any of these will fatally break the frontend map rendering. Include the 'Total Duration' and 'Total Distance' fields as well.
- Include relevant context about places and timing outside of the main itinerary block
- Mention any warnings or suggestions from the critic

Remember: Your goal is to provide the best trip planning experience by coordinating specialized expertise.`;

// Configuration for the supervisor
export interface SupervisorConfig {
	model?: ChatOpenAI;
	recursionLimit?: number;
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
	} = {}
): Promise<{ messages: Array<{ role: string; content: string }> }> {
	const supervisor = getSupervisorInstance();

	// Format messages for LangGraph
	const formattedMessages = messages.map((msg) => ({
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
	} = {}
): AsyncGenerator<{
	type: "agent" | "tool" | "message" | "done";
	data: any;
}> {
	const supervisor = getSupervisorInstance();

	// Format messages for LangGraph
	const formattedMessages = messages.map((msg) => ({
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
