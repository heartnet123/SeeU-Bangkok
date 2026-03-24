import type { TripDraft } from "./state";
import {
	classifySupervisorIntent,
	isCriticRequested,
	type SupervisorIntent,
} from "./intent-classification";

export type SupervisorMode =
	| "researcher_only"
	| "researcher_planner"
	| "researcher_planner_critic";

export interface SupervisorRoutingPolicy {
	intent: SupervisorIntent;
	requiresResearch: boolean;
	requiresPlanning: boolean;
	useCritic: boolean;
	supervisorMode: SupervisorMode;
	responseFormat: "researcher_json" | "planner_json";
}

export function deriveSupervisorRoutingPolicy(input: {
	messages: Array<{ role: string; content: string }>;
	currentTripDraft?: TripDraft;
}): SupervisorRoutingPolicy {
	const intent = classifySupervisorIntent(input);
	const useCritic = isCriticRequested(input);
	const requiresPlanning = intent === "itinerary";

	if (!requiresPlanning) {
		return {
			intent,
			requiresResearch: true,
			requiresPlanning: false,
			useCritic: false,
			supervisorMode: "researcher_only",
			responseFormat: "researcher_json",
		};
	}

	return {
		intent,
		requiresResearch: true,
		requiresPlanning: true,
		useCritic,
		supervisorMode: useCritic
			? "researcher_planner_critic"
			: "researcher_planner",
		responseFormat: "planner_json",
	};
}
