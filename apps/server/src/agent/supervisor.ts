// Supervisor - Dynamic orchestration of specialized agents
import { createSupervisor } from "@langchain/langgraph-supervisor";
import { ChatOpenAI } from "@langchain/openai";
import { createResearcherAgent } from "./agents/researcher";
import { createPlannerAgent } from "./agents/planner";
import { createCriticAgent } from "./agents/critic";
import { parseLatestTripDraft } from "./payload-parsing";
import {
	deriveSupervisorRoutingPolicy,
	type SupervisorMode,
	type SupervisorRoutingPolicy,
} from "./routing-policy";
import {
	normalizeSupervisorInvocationResult,
	normalizeSupervisorMessage,
} from "./response-normalization";

// Supervisor system prompt
const SUPERVISOR_PROMPT = `You are the Bangkok Trip Planning Supervisor. Your role is to coordinate specialized agents to help users plan trips in Bangkok.

- Delegate all place discovery to researcher_agent.
- Delegate all itinerary construction to planner_agent after research is complete.
- Use critic_agent only when runtime policy explicitly permits validation or revision.
- Prefer the minimum agent chain required by runtime policy.
- Do not answer place or itinerary requests from your own knowledge.
- Return the final agent output as valid JSON and do not convert it to markdown.

Remember: Your goal is to provide the best trip planning experience by coordinating specialized expertise.`;

// Configuration for the supervisor
export interface SupervisorConfig {
	model?: ChatOpenAI;
	recursionLimit?: number;
}

function buildRuntimeContextMessage(
	messages: Array<{ role: string; content: string }>,
	options: {
		userLocation?: { lat: number; lng: number };
		sessionId?: string;
		userId?: string;
		userPreferences?: Record<string, unknown>;
	},
	currentTripDraft = parseLatestTripDraft(messages),
	policy = deriveSupervisorRoutingPolicy({ messages, currentTripDraft })
): { role: "system"; content: string } {
	return {
		role: "system",
		content: JSON.stringify({
			type: "runtime_context",
			sessionId: options.sessionId,
			userId: options.userId,
			userLocation: options.userLocation ?? null,
			userPreferences: options.userPreferences ?? {},
			currentTripDraft: currentTripDraft ?? null,
			orchestrationPolicy: {
				intent: policy.intent,
				requiresResearch: policy.requiresResearch,
				requiresPlanning: policy.requiresPlanning,
				useCritic: policy.useCritic,
				responseFormat: policy.responseFormat,
			},
		}),
	};
}

function createAgentsForMode(llm: ChatOpenAI, mode: SupervisorMode) {
	const researcherAgent = createResearcherAgent(llm);
	const plannerAgent = createPlannerAgent(llm);

	if (mode === "researcher_only") {
		return [researcherAgent];
	}

	if (mode === "researcher_planner") {
		return [researcherAgent, plannerAgent];
	}

	const criticAgent = createCriticAgent(llm);
	return [researcherAgent, plannerAgent, criticAgent];
}

function formatSupervisorMessages(
	messages: Array<{ role: string; content: string }>,
	options: {
		userLocation?: { lat: number; lng: number };
		sessionId?: string;
		userId?: string;
		userPreferences?: Record<string, unknown>;
	},
	policy: SupervisorRoutingPolicy,
	currentTripDraft = parseLatestTripDraft(messages)
) {
	return [
		buildRuntimeContextMessage(messages, options, currentTripDraft, policy),
		...messages,
	].map((msg) => ({
		role: msg.role as "user" | "assistant" | "system",
		content: msg.content,
	}));
}

// Create the multi-agent supervisor graph
// Using explicit 'any' return type to avoid bun's cross-module type resolution issues
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createTripPlannerSupervisor(
	config: SupervisorConfig = {},
	mode: SupervisorMode = "researcher_planner_critic"
): any {
	const llm = config.model || new ChatOpenAI({
		modelName: "gpt-4o-mini",
		temperature: 0,
	});

	// Create supervisor workflow
	const supervisor = createSupervisor({
		agents: createAgentsForMode(llm, mode),
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
const _supervisorInstances: Partial<Record<SupervisorMode, any>> = {};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getSupervisorInstance(
	mode: SupervisorMode = "researcher_planner_critic"
): any {
	if (!_supervisorInstances[mode]) {
		_supervisorInstances[mode] = createTripPlannerSupervisor({}, mode);
	}
	return _supervisorInstances[mode];
}

// Reset supervisor (useful for testing or reconfiguration)
export function resetSupervisor(): void {
	delete _supervisorInstances.researcher_only;
	delete _supervisorInstances.researcher_planner;
	delete _supervisorInstances.researcher_planner_critic;
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
	const currentTripDraft = parseLatestTripDraft(messages);
	const policy = deriveSupervisorRoutingPolicy({ messages, currentTripDraft });
	const supervisor = getSupervisorInstance(policy.supervisorMode);
	const formattedMessages = formatSupervisorMessages(
		messages,
		options,
		policy,
		currentTripDraft
	);

	// Invoke the supervisor
	const result = await supervisor.invoke({
		messages: formattedMessages,
	});

	return normalizeSupervisorInvocationResult(result);
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
	const currentTripDraft = parseLatestTripDraft(messages);
	const policy = deriveSupervisorRoutingPolicy({ messages, currentTripDraft });
	const supervisor = getSupervisorInstance(policy.supervisorMode);
	const formattedMessages = formatSupervisorMessages(
		messages,
		options,
		policy,
		currentTripDraft
	);

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
							const normalizedMessage = normalizeSupervisorMessage(message as {
								role?: string;
								content: unknown;
								name?: string;
							});
							yield {
								type: "message",
								data: {
									role: normalizedMessage.role,
									content: normalizedMessage.content,
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
