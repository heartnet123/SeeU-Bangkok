// Supervisor - Explicit graph-style orchestration of specialized agents
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
import { buildScopeRefusalPayload, classifyScope } from "./scope-policy";
import type {
	CandidatePlace,
	PlanningConstraints,
	TripDraft,
	UiResponsePayload,
} from "./state";

// Supervisor system prompt
const SUPERVISOR_PROMPT = `You are the Rattanakosin Trip Planning Supervisor. Your role is to coordinate specialized agents to help users plan trips only within the Rattanakosin area of Bangkok.

SUPPORTED AREA EXAMPLES:
- Rattanakosin / Bangkok Old Town / Phra Nakhon
- Sanam Luang, Grand Palace, Wat Phra Kaew, Wat Pho, Khao San Road, Museum Siam

OUT OF SCOPE EXAMPLES:
- Siam, Ari, Thonglor, Sukhumvit, Chiang Mai, Pattaya, Phuket

- Delegate all place discovery to researcher_agent.
- Delegate all itinerary construction to planner_agent after research is complete.
- Use critic_agent only when runtime policy explicitly permits validation or revision.
- Prefer the minimum agent chain required by runtime policy.
- Do not answer place or itinerary requests from your own knowledge.
- Return the final agent output as valid JSON and do not convert it to markdown.
- Refuse requests that are outside tourism in the Rattanakosin scope.
- If the user asks about places outside Rattanakosin or unrelated topics, return a concise refusal and redirect them to Rattanakosin travel planning.
- If the user asks for impossible geography within Rattanakosin, such as beach, beachfront, sea, mountain, or snow, state truthfully that it does not exist in this area.

Remember: Your goal is to provide the best trip planning experience by coordinating specialized expertise.`;

// Configuration for the supervisor
export interface SupervisorConfig {
	model?: ChatOpenAI;
	recursionLimit?: number;
}

interface GraphAgentMessage {
	role: string;
	content: string;
	name?: string;
}

interface SupervisorGraphState {
	messages: GraphAgentMessage[];
	userLocation?: { lat: number; lng: number };
	sessionId?: string;
	userId?: string;
	userPreferences: Record<string, unknown>;
	currentTripDraft?: TripDraft;
	planningConstraints?: PlanningConstraints;
	policy: SupervisorRoutingPolicy;
	finalPayload: UiResponsePayload | null;
	finalResponse: string | null;
	suggestedPlaces: CandidatePlace[];
	validation:
		| {
				isValid: boolean;
				score: number;
				warnings: string[];
				suggestions: string[];
			}
		| null;
	revisionCount: number;
	maxRevisions: number;
}

interface StreamCollector {
	onAgent?: (agent: string) => Promise<void>;
	onTool?: (tool: string, args: unknown) => Promise<void>;
	onMessage?: (message: { role: string; content: string; agent: string | null }) => Promise<void>;
}

function buildRuntimeContextMessage(
	messages: Array<{ role: string; content: string }>,
	options: {
		userLocation?: { lat: number; lng: number };
		sessionId?: string;
		userId?: string;
		userPreferences?: Record<string, unknown>;
		defaultArea?: string;
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
			defaultArea: options.defaultArea ?? null,
			instructions: options.defaultArea
				? [
					`If the user does not specify an area, assume they mean ${options.defaultArea} and continue helping within that area.`,
				]
				: [],
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

function createInitialGraphState(
	messages: Array<{ role: string; content: string }>,
	options: {
		userLocation?: { lat: number; lng: number };
		sessionId?: string;
		userId?: string;
		userPreferences?: Record<string, unknown>;
		defaultArea?: string;
	},
	policy: SupervisorRoutingPolicy,
	currentTripDraft = parseLatestTripDraft(messages)
): SupervisorGraphState {
	return {
		messages: formatSupervisorMessages(messages, options, policy, currentTripDraft),
		userLocation: options.userLocation,
		sessionId: options.sessionId,
		userId: options.userId,
		userPreferences: options.userPreferences ?? {},
		currentTripDraft,
		planningConstraints: undefined,
		policy,
		finalPayload: null,
		finalResponse: null,
		suggestedPlaces: [],
		validation: null,
		revisionCount: 0,
		maxRevisions: 2,
	};
}

function updateStateFromAssistantMessages(
	state: SupervisorGraphState,
	messages: GraphAgentMessage[]
): void {
	for (const message of messages) {
		state.messages.push(message);
	}

	const latestAssistant = [...messages].reverse().find((message) => message.role === "assistant");
	if (!latestAssistant?.content) {
		return;
	}

	state.finalResponse = latestAssistant.content;

	try {
		const parsed = JSON.parse(latestAssistant.content) as Record<string, unknown>;

		if (Array.isArray(parsed.places)) {
			state.suggestedPlaces = parsed.places as CandidatePlace[];
		}

		if (parsed.planningConstraints && typeof parsed.planningConstraints === "object") {
			state.planningConstraints = parsed.planningConstraints as PlanningConstraints;
		}

		if (parsed.tripDraft && typeof parsed.tripDraft === "object") {
			state.currentTripDraft = parsed.tripDraft as TripDraft;
		}

		if (
			typeof parsed.summary === "string" &&
			"version" in parsed &&
			"raw_text" in parsed
		) {
			state.finalPayload = parsed as unknown as UiResponsePayload;
		}
	} catch {
		// Plain text assistant responses are allowed.
	}
}

async function invokeGraphAgentNode(
	agent: any,
	agentName: string,
	state: SupervisorGraphState,
	collector?: StreamCollector
): Promise<void> {
	await collector?.onAgent?.(agentName);

	const stream = await agent.stream(
		{ messages: state.messages },
		{ streamMode: "updates" }
	);

	const assistantMessages: GraphAgentMessage[] = [];

	for await (const event of stream) {
		for (const [nodeName, nodeData] of Object.entries(event)) {
			if (nodeName !== "__end__" && nodeName !== agentName) {
				await collector?.onAgent?.(nodeName);
			}

			if (!nodeData || typeof nodeData !== "object") {
				continue;
			}

			const data = nodeData as Record<string, unknown>;
			const toolCalls = Array.isArray(data.tool_calls)
				? data.tool_calls
				: Array.isArray(data.toolCalls)
					? data.toolCalls
					: [];

			for (const toolCall of toolCalls as Array<Record<string, unknown>>) {
				await collector?.onTool?.(
					String(toolCall.name || toolCall.tool || "unknown_tool"),
					toolCall.args || toolCall.input || null
				);
			}

			if (!Array.isArray(data.messages)) {
				continue;
			}

			for (const message of data.messages as Array<{
				role?: string;
				content: unknown;
				name?: string;
			}>) {
				const normalizedMessage = normalizeSupervisorMessage(message);
				if (normalizedMessage.role === "assistant") {
					assistantMessages.push(normalizedMessage);
				}

				await collector?.onMessage?.({
					role: normalizedMessage.role,
					content: normalizedMessage.content,
					agent: agentName,
				});
			}
		}
	}

	updateStateFromAssistantMessages(state, assistantMessages);
}

function shouldPlan(state: SupervisorGraphState): boolean {
	return state.policy.requiresPlanning;
}

function shouldValidate(state: SupervisorGraphState): boolean {
	return state.policy.useCritic && Boolean(state.currentTripDraft);
}

function shouldRevise(state: SupervisorGraphState): boolean {
	if (!state.validation || !state.currentTripDraft) {
		return false;
	}

	if (state.revisionCount >= state.maxRevisions) {
		return false;
	}

	return !state.validation.isValid || state.validation.score < 80;
}

async function hydrateContextNode(state: SupervisorGraphState): Promise<void> {
	state.messages = [
		buildRuntimeContextMessage(
			state.messages.filter((message) => message.role !== "system"),
			{
				userLocation: state.userLocation,
				sessionId: state.sessionId,
				userId: state.userId,
				userPreferences: state.userPreferences,
				defaultArea: "Rattanakosin",
			},
			state.currentTripDraft,
			state.policy
		),
		...state.messages.filter((message) => message.role !== "system"),
	];
}

async function researchNode(
	state: SupervisorGraphState,
	llm: ChatOpenAI,
	collector?: StreamCollector
): Promise<void> {
	await invokeGraphAgentNode(createResearcherAgent(llm), "researcher_agent", state, collector);
}

async function planNode(
	state: SupervisorGraphState,
	llm: ChatOpenAI,
	collector?: StreamCollector
): Promise<void> {
	await invokeGraphAgentNode(createPlannerAgent(llm), "planner_agent", state, collector);
}

async function validateNode(
	state: SupervisorGraphState,
	llm: ChatOpenAI,
	collector?: StreamCollector
): Promise<void> {
	await invokeGraphAgentNode(createCriticAgent(llm), "critic_agent", state, collector);

	if (!state.currentTripDraft) {
		return;
	}

	state.validation = state.currentTripDraft.validation;
	if (shouldRevise(state)) {
		state.revisionCount += 1;
		state.messages.push({
			role: "system",
			content: JSON.stringify({
				type: "revision_request",
				revisionCount: state.revisionCount,
				validation: state.validation,
				instruction:
					"Revise the itinerary to address validation warnings and improve the quality score.",
			}),
		});
	}
}

async function finalizeNode(state: SupervisorGraphState): Promise<void> {
	if (state.finalPayload) {
		state.finalResponse = JSON.stringify(state.finalPayload);
		return;
	}

	if (!state.finalResponse) {
		state.finalResponse = JSON.stringify({
			intent: state.policy.requiresPlanning ? "itinerary" : "place_recommendation",
			summary: "",
			places: state.suggestedPlaces,
			tripDraft: state.currentTripDraft ?? null,
		});
	}
}

function finalizeScopeRefusalState(
	state: SupervisorGraphState,
	classification: Exclude<
		ReturnType<typeof classifyScope>["classification"],
		"in_scope" | "implicit_in_scope"
	>,
	sessionId?: string,
	matchedTerms?: string[]
): void {
	const payload = buildScopeRefusalPayload({
		classification,
		sessionId,
		matchedTerms,
	});
	state.finalPayload = payload;
	state.finalResponse = JSON.stringify(payload);
	state.messages.push({
		role: "assistant",
		content: JSON.stringify(payload),
	});
}

async function runSupervisorGraph(
	messages: Array<{ role: string; content: string }>,
	options: {
		userLocation?: { lat: number; lng: number };
		sessionId?: string;
		userId?: string;
		userPreferences?: Record<string, unknown>;
	} = {},
	collector?: StreamCollector
): Promise<SupervisorGraphState> {
	const currentTripDraft = parseLatestTripDraft(messages);
	const policy = deriveSupervisorRoutingPolicy({ messages, currentTripDraft });
	const scope = classifyScope({ messages });
	const llm = new ChatOpenAI({
		modelName: "gpt-4o-mini",
		temperature: 0,
	});
	const state = createInitialGraphState(messages, options, policy, currentTripDraft);

	if (
		scope.classification !== "in_scope" &&
		scope.classification !== "implicit_in_scope"
	) {
		finalizeScopeRefusalState(
			state,
			scope.classification,
			options.sessionId,
			scope.matchedTerms
		);
		return state;
	}

	await hydrateContextNode(state);
	await researchNode(state, llm, collector);

	if (shouldPlan(state)) {
		await planNode(state, llm, collector);
	}

	if (shouldValidate(state)) {
		await validateNode(state, llm, collector);
		while (shouldRevise(state)) {
			await planNode(state, llm, collector);
			await validateNode(state, llm, collector);
		}
	}

	await finalizeNode(state);
	return state;
}

function formatSupervisorMessages(
	messages: Array<{ role: string; content: string }>,
	options: {
		userLocation?: { lat: number; lng: number };
		sessionId?: string;
		userId?: string;
		userPreferences?: Record<string, unknown>;
		defaultArea?: string;
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

	const agents = createAgentsForMode(llm, mode);

	return {
		mode,
		prompt: SUPERVISOR_PROMPT,
		agents,
		async invoke(input: { messages: Array<{ role: string; content: string }> }) {
			const state = await runSupervisorGraph(input.messages);
			return {
				messages: state.messages,
			};
		},
		async stream(
			input: { messages: Array<{ role: string; content: string }> },
			_options?: { streamMode?: string }
		) {
			async function* generate() {
				const events: Array<Record<string, unknown>> = [];
				await runSupervisorGraph(input.messages, {}, {
					onAgent: async (agent) => {
						events.push({ [agent]: { messages: [] } });
					},
					onTool: async (tool, args) => {
						events.push({ tool_event: { tool_calls: [{ name: tool, args }] } });
					},
					onMessage: async (message) => {
						events.push({
							[message.agent || "assistant"]: {
								messages: [
									{ role: message.role, content: message.content },
								],
							},
						});
					},
				});

				for (const event of events) {
					yield event;
				}
				yield { __end__: { success: true } };
			}

			return generate();
		},
	};
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
	const state = await runSupervisorGraph(messages, options);
	return normalizeSupervisorInvocationResult({ messages: state.messages });
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
	const bufferedEvents: Array<{
		type: "agent" | "tool" | "message";
		data: any;
	}> = [];

	await runSupervisorGraph(messages, options, {
		onAgent: async (agent) => {
			bufferedEvents.push({
				type: "agent",
				data: { agent },
			});
		},
		onTool: async (tool, args) => {
			bufferedEvents.push({
				type: "tool",
				data: { tool, args },
			});
		},
		onMessage: async (message) => {
			bufferedEvents.push({
				type: "message",
				data: message,
			});
		},
	});

	for (const event of bufferedEvents) {
		yield event;
	}

	yield {
		type: "done",
		data: { success: true },
	};
}
