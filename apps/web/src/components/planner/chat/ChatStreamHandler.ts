import { agentStepType, humanizeAgent } from "./constants";
import type { PendingTurn, PlaceItem } from "./types";

export interface SseEventBlock {
	event: string;
	data: string;
}

type UpdateLocal = (updater: (prev: PendingTurn) => PendingTurn) => void;

function parseJson<T>(input: string, fallback: T): T {
	try {
		return JSON.parse(input) as T;
	} catch {
		return fallback;
	}
}

export function parseSseEventBlock(chunk: string): SseEventBlock | null {
	const lines = chunk.split(/\r?\n/).filter((line) => line.length > 0);
	let event: string | null = null;
	const data: string[] = [];

	for (const line of lines) {
		if (line.startsWith("event:")) event = line.slice(6).trim();
		if (line.startsWith("data:")) data.push(line.slice(5).trim());
	}

	if (!event) return null;
	return { event, data: data.join("\n") };
}

export function handleStreamEvent(
	event: string,
	joined: string,
	updateLocal: UpdateLocal,
	commitCurrent: () => void,
) {
	switch (event) {
		case "start":
			updateLocal((prev) => ({
				...prev,
				workflowSteps: [
					{
						type: "planner",
						label: "Analyzing your request...",
						status: "loading",
					},
				],
			}));
			break;

		case "agent": {
			const parsed = parseJson<{ agent: string }>(joined, { agent: "agent" });
			const agentName = parsed.agent;
			updateLocal((prev) => ({
				...prev,
				workflowSteps: [
					...prev.workflowSteps.map((s) => ({ ...s, status: "complete" as const })),
					{
						type: agentStepType(agentName),
						label: humanizeAgent(agentName),
						status: "loading" as const,
					},
				],
			}));
			break;
		}

		case "tools": {
			const parsed = parseJson<{ tools?: { tool: string }[] }>(joined, { tools: [] });
			const toolNames = (parsed.tools ?? []).map((tool) => tool.tool);
			updateLocal((prev) => ({
				...prev,
				workflowSteps: [
					...prev.workflowSteps.map((s) => ({ ...s, status: "complete" as const })),
					{
						type: "search",
						label: "Calling tools",
						badges: toolNames,
						status: "complete" as const,
					},
				],
			}));
			break;
		}

		case "context": {
			const parsed = parseJson<{ documents?: number }>(joined, { documents: 0 });
			const docs = parsed.documents ?? 0;
			updateLocal((prev) => ({
				...prev,
				workflowSteps: [
					...prev.workflowSteps.map((s) => ({ ...s, status: "complete" as const })),
					{
						type: "retrieve",
						label: `Found ${docs} relevant place${docs !== 1 ? "s" : ""}`,
						status: "complete" as const,
					},
				],
			}));
			break;
		}

		case "suggestions": {
			const parsed = parseJson<{ places?: PlaceItem[] }>(joined, { places: [] });
			const places = parsed.places ?? [];
			updateLocal((prev) => ({
				...prev,
				suggestions: places,
				workflowSteps: [
					...prev.workflowSteps.map((s) => ({ ...s, status: "complete" as const })),
					{
						type: "location",
						label: `${places.length} place${places.length !== 1 ? "s" : ""} matched`,
						badges: places.slice(0, 3).map((p) => p.name),
						status: "complete" as const,
					},
				],
			}));
			break;
		}

		case "itinerary": {
			const itinerary = parseJson<unknown>(joined, null);
			if (itinerary !== null) {
				const itineraryObj = itinerary as { title?: string; stops?: unknown[] };
				updateLocal((prev) => ({
					...prev,
					itinerary,
					workflowSteps: [
						...prev.workflowSteps.map((s) => ({ ...s, status: "complete" as const })),
						{
							type: "route",
							label: `Route created: ${itineraryObj.title ?? "Trip Plan"}`,
							badges: [`${itineraryObj.stops?.length ?? 0} stops`],
							status: "complete" as const,
						},
					],
				}));
			}
			break;
		}

		case "message":
			updateLocal((prev) => ({ ...prev, text: joined }));
			break;

		case "error":
			updateLocal((prev) => ({ ...prev, errors: [...prev.errors, joined] }));
			break;

		case "done":
			commitCurrent();
			break;

		default:
			break;
	}
}
