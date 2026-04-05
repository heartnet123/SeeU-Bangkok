import { StateGraph, START, END, Annotation } from "@langchain/langgraph";
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
import {
	buildScopeRefusalPayload,
	classifyScopeWithResolution,
} from "./scope-policy";
import { validateItineraryImpl } from "./tools/validation";
import type {
	CandidatePlace,
	CritiqueStageOutput,
	PlanningStageOutput,
	PlanningConstraints,
	ResearchStageOutput,
	TripDraft,
	TripValidation,
	UiResponsePayload,
	WorkflowState,
	ResearchState,
	PlanningState,
	CritiqueState,
	UiState,
	TelemetryState
} from "./state";
import {
	CritiqueStageOutputSchema,
	PlanningStageOutputSchema,
	ResearchStageOutputSchema,
} from "./state";

const SUPERVISOR_PROMPT = `You are the Rattanakosin Trip Planning Supervisor...`;

export interface SupervisorConfig {
	model?: ChatOpenAI;
	recursionLimit?: number;
}

export const WorkflowStateAnnotation = Annotation.Root({
	messages: Annotation<any[]>({
		reducer: (x, y) => x.concat(y),
		default: () => [],
	}),
	userLocation: Annotation<any>({ reducer: (x, y) => y ?? x }),
	sessionId: Annotation<string | undefined>({ reducer: (x, y) => y ?? x }),
	userId: Annotation<string | undefined>({ reducer: (x, y) => y ?? x }),
	userPreferences: Annotation<any>({ reducer: (x, y) => y ?? x, default: () => ({}) }),
	workflow: Annotation<WorkflowState, Partial<WorkflowState>>({
		reducer: (x, y) => ({ ...x, ...y }),
		default: () => ({ stage: "intake", status: "idle", iteration: 0, maxIterations: 3 }),
	}),
	research: Annotation<ResearchState, Partial<ResearchState>>({
		reducer: (x, y) => ({ ...x, ...y }),
		default: () => ({ querySummary: undefined, candidatePlaces: [], evidence: [], coverageGaps: [] }),
	}),
	planning: Annotation<PlanningState, Partial<PlanningState>>({
		reducer: (x, y) => ({ ...x, ...y }),
		default: () => ({ constraints: undefined, draft: undefined, assumptions: [], droppedPlaces: [] }),
	}),
	critique: Annotation<CritiqueState, Partial<CritiqueState>>({
		reducer: (x, y) => ({ ...x, ...y }),
		default: () => ({ hardViolations: [], softWarnings: [], revisionInstructions: [], history: [] }),
	}),
	ui: Annotation<UiState, Partial<UiState>>({
		reducer: (x, y) => ({ ...x, ...y }),
		default: () => ({ previewPlaces: [], statusLabel: "", progressStep: undefined, latestSummary: undefined, previewTripDraft: undefined }),
	}),
	telemetry: Annotation<TelemetryState, Partial<TelemetryState>>({
		reducer: (x, y) => ({ ...x, ...y, timings: { ...(x?.timings ?? {}), ...(y?.timings ?? {}) } }),
		default: () => ({ toolCalls: [], agentHistory: [], timings: {} }),
	}),
	policy: Annotation<SupervisorRoutingPolicy>({ reducer: (x, y) => y ?? x }),
	finalPayload: Annotation<UiResponsePayload | null>({ reducer: (x, y) => y ?? x, default: () => null }),
	finalResponse: Annotation<string | null>({ reducer: (x, y) => y ?? x, default: () => null }),
	collector: Annotation<any>({ reducer: (x, y) => y ?? x }),
	llm: Annotation<any>({ reducer: (x, y) => y ?? x })
});

function parseResearchStageOutput(text: string): ResearchStageOutput | null {
	try {
		const parsed = JSON.parse(text) as Record<string, unknown>;
		return ResearchStageOutputSchema.parse({
			summary: typeof parsed.summary === "string" ? parsed.summary : "",
			querySummary: typeof parsed.summary === "string" ? parsed.summary : undefined,
			places: Array.isArray(parsed.places) ? parsed.places : [],
			planningConstraints: parsed.planningConstraints,
			evidence: [],
			coverageGaps: [],
		});
	} catch {
		return null;
	}
}

function parsePlanningStageOutput(text: string): PlanningStageOutput | null {
	try {
		const parsed = JSON.parse(text) as Record<string, unknown>;
		if (!(parsed.tripDraft && typeof parsed.tripDraft === "object")) {
			return null;
		}
		return PlanningStageOutputSchema.parse({
			summary: typeof parsed.summary === "string" ? parsed.summary : "",
			tripDraft: parsed.tripDraft,
			assumptions: Array.isArray(parsed.assumptions) ? parsed.assumptions : [],
			droppedPlaces: Array.isArray(parsed.droppedPlaces) ? parsed.droppedPlaces : [],
		});
	} catch {
		return null;
	}
}

function deriveHardViolations(validation: Awaited<ReturnType<typeof validateItineraryImpl>>): string[] {
	const hardViolations: string[] = [];
	if (validation.details.totalStops < 2) hardViolations.push("Need at least 2 stops for a valid itinerary.");
	if (validation.details.totalStops > 8) hardViolations.push("Too many stops for one trip.");
	if (validation.details.totalTime > 600) hardViolations.push("Total trip duration is too long.");
	if (validation.details.totalDistance > 50) hardViolations.push("Total travel distance is too long for this trip.");
	return hardViolations;
}

function parseCritiqueStageOutput(
	text: string,
	fallbackValidation?: TripValidation | null,
	fallbackHardViolations: string[] = []
): CritiqueStageOutput | null {
	try {
		const parsed = JSON.parse(text) as Record<string, unknown>;
		return CritiqueStageOutputSchema.parse({
			validation: parsed.validation ?? fallbackValidation,
			hardViolations: Array.isArray(parsed.hardViolations) ? parsed.hardViolations : fallbackHardViolations,
			softWarnings: Array.isArray(parsed.softWarnings) ? parsed.softWarnings : [],
			revisionInstructions: Array.isArray(parsed.revisionInstructions) ? parsed.revisionInstructions : [],
			summary: typeof parsed.summary === "string" ? parsed.summary : undefined,
		});
	} catch {
		if (!fallbackValidation) {
			return null;
		}
		return {
			validation: fallbackValidation,
			hardViolations: fallbackHardViolations,
			softWarnings: fallbackValidation.warnings,
			revisionInstructions: fallbackValidation.suggestions,
			summary: undefined,
		};
	}
}

function createFinalPayload(state: typeof WorkflowStateAnnotation.State): UiResponsePayload {
	return {
		version: "1.0",
		intent: state.policy.requiresPlanning ? "itinerary" : "place_recommendation",
		sessionId: state.sessionId,
		summary: state.ui?.latestSummary || state.finalResponse || "",
		places: state.research?.candidatePlaces || [],
		tripDraft: state.planning?.draft ?? null,
		actions: state.planning?.draft
			? [
				{ type: "preview_itinerary", label: "Preview itinerary" },
				{ type: "save_trip_draft", label: "Save trip draft" },
			]
			: state.research?.candidatePlaces?.length
				? [{ type: "add_all_to_trip", label: "Add all to trip" }]
				: [],
		warnings: [
			...(state.planning?.draft?.warnings ?? []),
			...(state.critique?.softWarnings ?? []),
		],
		raw_text: state.finalResponse || state.ui?.latestSummary || "",
	};
}

function hasMaterialDraftChange(previousDraft?: TripDraft, nextDraft?: TripDraft): boolean {
	if (!previousDraft || !nextDraft) {
		return true;
	}
	return JSON.stringify(previousDraft.stops) !== JSON.stringify(nextDraft.stops)
		|| previousDraft.total_minutes !== nextDraft.total_minutes
		|| previousDraft.total_distance_km !== nextDraft.total_distance_km;
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
				? [`If the user does not specify an area, assume they mean ${options.defaultArea} and continue helping within that area.`]
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

async function invokeGraphAgentNode(
	agent: any,
	agentName: string,
	state: typeof WorkflowStateAnnotation.State,
): Promise<{ assistantMessages: any[], latestAssistantText: string | null }> {
	const collector = state.collector;
	await collector?.onAgent?.(agentName);

	const stream = await agent.stream(
		{ messages: state.messages },
		{ streamMode: "updates" }
	);

	const assistantMessages: any[] = [];
	let latestAssistantText: string | null = null;

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

			for (const message of data.messages as Array<{ role?: string; content: unknown; name?: string; }>) {
				const normalizedMessage = normalizeSupervisorMessage(message);
				if (normalizedMessage.role === "assistant") {
					assistantMessages.push(normalizedMessage);
					if (typeof normalizedMessage.content === "string") {
						latestAssistantText = normalizedMessage.content;
					}
				}

				await collector?.onMessage?.({
					role: normalizedMessage.role,
					content: normalizedMessage.content,
					agent: agentName,
				});
			}
		}
	}

	return { assistantMessages, latestAssistantText };
}

// Nodes
async function scopeCheckNode(state: typeof WorkflowStateAnnotation.State) {
	const scope = await classifyScopeWithResolution({ messages: state.messages });
	if (scope.classification !== "in_scope" && scope.classification !== "implicit_in_scope") {
		const payload = buildScopeRefusalPayload({
			classification: scope.classification,
			sessionId: state.sessionId,
			matchedTerms: scope.matchedTerms,
		});
		return {
			finalPayload: payload,
			finalResponse: JSON.stringify(payload),
			messages: [{ role: "assistant", content: JSON.stringify(payload) }],
			workflow: { stage: "done", status: "completed" }
		};
	}
	return { workflow: { stage: "intake" } };
}

async function hydrateContextNode(state: typeof WorkflowStateAnnotation.State) {
	const mapped = [
		buildRuntimeContextMessage(
			state.messages.filter((m) => m.role !== "system"),
			{
				userLocation: state.userLocation,
				sessionId: state.sessionId,
				userId: state.userId,
				userPreferences: state.userPreferences,
				defaultArea: "Rattanakosin",
			},
			state.planning?.draft || parseLatestTripDraft(state.messages),
			state.policy
		),
		...state.messages.filter((m) => m.role !== "system"),
	].map((msg) => ({
		role: msg.role as "user" | "assistant" | "system",
		content: msg.content,
	}));

	return { messages: mapped };
}

async function researchNode(state: typeof WorkflowStateAnnotation.State) {
	state.collector?.onStage?.("research_started");
	const startedAt = Date.now();
	const agent = createResearcherAgent(state.llm);
	const { assistantMessages, latestAssistantText } = await invokeGraphAgentNode(agent, "researcher_agent", state);
	
	const updates: Partial<typeof WorkflowStateAnnotation.State> = {
		messages: assistantMessages,
		finalResponse: latestAssistantText,
		workflow: { ...state.workflow, stage: "research" },
		telemetry: {
			toolCalls: state.telemetry?.toolCalls ?? [],
			agentHistory: [...(state.telemetry?.agentHistory ?? []), "researcher_agent"],
			timings: { researchMs: Date.now() - startedAt },
		}
	};

	if (latestAssistantText) {
		const parsed = parseResearchStageOutput(latestAssistantText);
		if (parsed) {
			updates.research = {
				querySummary: parsed.querySummary,
				candidatePlaces: parsed.places,
				evidence: parsed.evidence,
				coverageGaps: parsed.coverageGaps,
			};
			updates.ui = {
				previewPlaces: parsed.places,
				statusLabel: "Research completed",
				progressStep: 1,
				latestSummary: parsed.summary,
				previewTripDraft: state.ui?.previewTripDraft,
			};
			if (parsed.planningConstraints) {
				updates.planning = { ...state.planning, constraints: parsed.planningConstraints };
			}
		}
	}

	state.collector?.onStage?.("research_completed");
	return updates;
}

async function planNode(state: typeof WorkflowStateAnnotation.State) {
	state.collector?.onStage?.("planning_started");
	const startedAt = Date.now();
	const previousDraft = state.planning?.draft;
	const agent = createPlannerAgent(state.llm);
	const { assistantMessages, latestAssistantText } = await invokeGraphAgentNode(agent, "planner_agent", state);
	
	const updates: Partial<typeof WorkflowStateAnnotation.State> = {
		messages: assistantMessages,
		finalResponse: latestAssistantText,
		workflow: { ...state.workflow, stage: "planning" },
		telemetry: {
			toolCalls: state.telemetry?.toolCalls ?? [],
			agentHistory: [...(state.telemetry?.agentHistory ?? []), "planner_agent"],
			timings: { planningMs: Date.now() - startedAt },
		}
	};

	if (latestAssistantText) {
		const parsed = parsePlanningStageOutput(latestAssistantText);
		if (parsed) {
			updates.planning = {
				constraints: state.planning?.constraints,
				draft: parsed.tripDraft,
				assumptions: parsed.assumptions,
				droppedPlaces: parsed.droppedPlaces,
			};
			updates.ui = {
				previewPlaces: state.ui?.previewPlaces || [],
				previewTripDraft: parsed.tripDraft,
				statusLabel: "Planning itinerary",
				progressStep: state.workflow.stage === "revision" ? 4 : 2,
				latestSummary: parsed.summary,
			};
			updates.workflow = {
				...(updates.workflow ?? state.workflow),
				status: hasMaterialDraftChange(previousDraft, parsed.tripDraft) ? "running" : "waiting_revision",
			};
		}
	}
	
	state.collector?.onStage?.("planning_completed");
	return updates;
}

async function validateNode(state: typeof WorkflowStateAnnotation.State) {
	const currentDraft = state.planning?.draft;
	let validationFindings = null;
	let deterministicHardViolations: string[] = [];
	
	if (currentDraft) {
		validationFindings = await validateItineraryImpl(currentDraft);
		deterministicHardViolations = deriveHardViolations(validationFindings);
	}

	const agent = createCriticAgent(state.llm);
	state.collector?.onStage?.(validationFindings ? "validation_started" : "critique_started");
	
	const stateWithFindings = {
		...state,
		messages: validationFindings ? [
			...state.messages,
			{ role: "user", content: `Please review this draft against these deterministic validation findings: ${JSON.stringify(validationFindings, null, 2)}. Return the final validation JSON.` }
		] : state.messages
	};
	
	const { assistantMessages, latestAssistantText } = await invokeGraphAgentNode(agent, "critic_agent", stateWithFindings);
	
	const updates: Partial<typeof WorkflowStateAnnotation.State> = {
		// Note on reducer: `messages` is configured to `x.concat(y)`, so this appends safely
		messages: assistantMessages,
		workflow: { ...state.workflow, stage: "critique" },
		critique: { ...state.critique },
		telemetry: {
			toolCalls: state.telemetry?.toolCalls ?? [],
			agentHistory: [...(state.telemetry?.agentHistory ?? []), "critic_agent"],
			timings: state.telemetry?.timings ?? {},
		}
	};
	
	let parsedCritique: CritiqueStageOutput | null = null;
	if (latestAssistantText) {
		parsedCritique = parseCritiqueStageOutput(
			latestAssistantText,
			validationFindings,
			deterministicHardViolations
		);
	}
	
	const validationResult = (parsedCritique?.validation || validationFindings || currentDraft?.validation) as TripValidation | null | undefined;
	if (parsedCritique && validationResult) {
		updates.critique = {
			result: validationResult,
			isValid: validationResult.isValid,
			score: validationResult.score,
			hardViolations: parsedCritique.hardViolations,
			softWarnings: parsedCritique.softWarnings.length ? parsedCritique.softWarnings : validationResult.warnings,
			revisionInstructions: parsedCritique.revisionInstructions.length ? parsedCritique.revisionInstructions : validationResult.suggestions,
			history: [...(state.critique?.history ?? []), parsedCritique],
		};
		updates.ui = {
			previewPlaces: state.ui?.previewPlaces || [],
			previewTripDraft: state.ui?.previewTripDraft,
			statusLabel: "Reviewing plan",
			progressStep: 3,
			latestSummary: parsedCritique.summary || state.ui?.latestSummary,
		};
	}
	
	if (validationResult) {
		const hardViolations = parsedCritique?.hardViolations ?? deterministicHardViolations;
		const willRevise = hardViolations.length > 0 || !validationResult.isValid || (validationResult.score && validationResult.score < 80);
		const iters = state.workflow.iteration || 0;
		const maxIters = state.workflow.maxIterations || 2;
		
		const hasProgress = state.workflow.stage !== "revision" || hasMaterialDraftChange(undefined, currentDraft);
		
		if (willRevise && iters < maxIters && hasProgress) {
			updates.workflow = { ...state.workflow, stage: "revision", iteration: iters + 1 };
			state.collector?.onStage?.("revision_started");
			// Appends revision instruction
			updates.messages = [
				...updates.messages || [],
				{
					role: "system",
					content: JSON.stringify({
						type: "revision_request",
						revisionCount: iters + 1,
						validation: validationResult,
						instruction: (parsedCritique?.revisionInstructions ?? validationResult.suggestions).join(" ") || "Revise the itinerary to address validation warnings.",
					}),
				}
			];
		} else if (willRevise && iters >= maxIters) {
			updates.workflow = { ...state.workflow, stage: "finalize", status: "completed" };
			updates.ui = {
				previewPlaces: updates.ui?.previewPlaces ?? state.ui?.previewPlaces ?? [],
				previewTripDraft: updates.ui?.previewTripDraft ?? state.ui?.previewTripDraft,
				statusLabel: "Finalizing with warnings",
				progressStep: 5,
				latestSummary: updates.ui?.latestSummary ?? state.ui?.latestSummary,
			};
		}
	}
	
	state.collector?.onStage?.("critique_completed");
	return updates;
}

async function finalizeNode(state: typeof WorkflowStateAnnotation.State) {
	state.collector?.onStage?.("finalizing");
	if (state.finalPayload) {
		return { finalResponse: JSON.stringify(state.finalPayload), workflow: { stage: "done", status: "completed" } };
	}
	const finalPayload = createFinalPayload(state);
	return {
		finalPayload,
		finalResponse: JSON.stringify(finalPayload),
		ui: {
			previewPlaces: finalPayload.places,
			previewTripDraft: finalPayload.tripDraft ?? undefined,
			statusLabel: "Trip ready",
			progressStep: 5,
			latestSummary: finalPayload.summary,
		},
		workflow: { stage: "done", status: "completed" }
	};
}

const shouldProceed = (state: typeof WorkflowStateAnnotation.State) => {
	if (state.workflow?.stage === "done") return END;
	return "hydrateContext";
};

const routeAfterResearch = (state: typeof WorkflowStateAnnotation.State) => {
	if (state.policy.requiresPlanning) return "planStage";
	return "finalize";
};

const routeAfterPlan = (state: typeof WorkflowStateAnnotation.State) => {
	if (state.policy.useCritic) return "validateStage";
	return "finalize";
};

const routeAfterValidate = (state: typeof WorkflowStateAnnotation.State) => {
	if (state.workflow?.stage === "revision") return "planStage";
	return "finalize";
};

const builder = new StateGraph(WorkflowStateAnnotation)
	.addNode("scopeCheck", scopeCheckNode)
	.addNode("hydrateContext", hydrateContextNode)
	.addNode("researchStage", researchNode)
	.addNode("planStage", planNode)
	.addNode("validateStage", validateNode)
	.addNode("finalize", finalizeNode)

	.addEdge(START, "scopeCheck")
	.addConditionalEdges("scopeCheck", shouldProceed)
	.addEdge("hydrateContext", "researchStage")
	.addConditionalEdges("researchStage", routeAfterResearch)
	.addConditionalEdges("planStage", routeAfterPlan)
	.addConditionalEdges("validateStage", routeAfterValidate)
	.addEdge("finalize", END);

export const supervisorGraph = builder.compile();

export function createTripPlannerSupervisor() {
	return {
		mode: "researcher_planner_critic",
		prompt: SUPERVISOR_PROMPT,
		async invoke(input: { messages: Array<{ role: string; content: string }> }) {
			const policy = deriveSupervisorRoutingPolicy({ messages: input.messages, currentTripDraft: parseLatestTripDraft(input.messages) });
			const state = await supervisorGraph.invoke({ messages: input.messages, policy, llm: new ChatOpenAI({ modelName: "gpt-4o-mini", temperature: 0 }) });
			return { messages: state.messages };
		},
	};
}

export function getSupervisorInstance(mode: SupervisorMode = "researcher_planner_critic") {
	return createTripPlannerSupervisor();
}

export function resetSupervisor(): void {}

export async function invokeSupervisor(
	messages: Array<{ role: string; content: string }>,
	options: any = {}
) {
	const currentTripDraft = parseLatestTripDraft(messages);
	const policy = deriveSupervisorRoutingPolicy({ messages, currentTripDraft });
	const state = await supervisorGraph.invoke({
		messages,
		userLocation: options.userLocation,
		sessionId: options.sessionId,
		userId: options.userId,
		userPreferences: options.userPreferences,
		policy,
		llm: new ChatOpenAI({ modelName: "gpt-4o-mini", temperature: 0 })
	});
	return normalizeSupervisorInvocationResult({ messages: state.messages });
}

export async function* streamSupervisor(
	messages: Array<{ role: string; content: string }>,
	options: any = {}
) {
	const currentTripDraft = parseLatestTripDraft(messages);
	const policy = deriveSupervisorRoutingPolicy({ messages, currentTripDraft });

	const queue: any[] = [];
	let isDone = false;
	let emittedAssistantMessage = false;
	let resolver: (() => void) | null = null;

	const pushEvent = (event: any) => {
		queue.push(event);
		if (resolver) {
			resolver();
			resolver = null;
		}
	};

	const graphPromise = supervisorGraph.invoke({
		messages,
		userLocation: options.userLocation,
		sessionId: options.sessionId,
		userId: options.userId,
		userPreferences: options.userPreferences,
		policy,
		llm: new ChatOpenAI({ modelName: "gpt-4o-mini", temperature: 0 }),
		collector: {
			onAgent: async (agent: string) => pushEvent({ type: "agent", data: { agent } }),
			onTool: async (tool: string, args: any) => pushEvent({ type: "tool", data: { tool, args } }),
			onMessage: async (message: any) => {
				if (message?.role === "assistant" && typeof message.content === "string" && message.content.trim().length > 0) {
					emittedAssistantMessage = true;
				}
				pushEvent({ type: "message", data: message });
			},
			onStage: async (stage: string) => pushEvent({ type: "stage", data: { stage } }),
		}
	}).then((state) => {
		if (!emittedAssistantMessage) {
			if (state.finalPayload) {
				pushEvent({
					type: "message",
					data: {
						role: "assistant",
						content: JSON.stringify(state.finalPayload),
					},
				});
			} else if (typeof state.finalResponse === "string" && state.finalResponse.trim().length > 0) {
				pushEvent({
					type: "message",
					data: {
						role: "assistant",
						content: state.finalResponse,
					},
				});
			}
		}
		isDone = true;
		if (resolver) resolver();
	}).catch((err) => {
		pushEvent({ type: "error", data: err });
		isDone = true;
		if (resolver) resolver();
	});

	while (!isDone || queue.length > 0) {
		if (queue.length > 0) {
			yield queue.shift();
		} else {
			await new Promise<void>((resolve) => { resolver = resolve; });
		}
	}

	yield { type: "done", data: { success: true } };
}
