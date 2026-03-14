import type { WorkflowStepType } from "./types";

export const QUICK_SUGGESTIONS = [
	"Show me temples",
	"Find cafes near me",
	"Plan a day trip",
	"Hidden gems in Bangkok",
];

export function uid(): string {
	return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function humanizeAgent(agentName: string): string {
	if (agentName.includes("researcher")) return "Searching for places...";
	if (agentName.includes("planner")) return "Building your route...";
	if (agentName.includes("critic")) return "Reviewing the plan...";
	return "Working...";
}

export function agentStepType(agentName: string): WorkflowStepType {
	if (agentName.includes("researcher")) return "search";
	if (agentName.includes("planner")) return "route";
	if (agentName.includes("critic")) return "reasoning";
	return "planner";
}
