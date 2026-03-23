import {
	PlannerAgentOutputSchema,
	ResearcherAgentOutputSchema,
	UiResponsePayloadSchema,
	type CandidatePlace,
	type TripDraft,
	type UiResponsePayload,
} from "./state";

export interface ParsedAgentPayload {
	summary: string;
	places: CandidatePlace[];
	tripDraft: TripDraft | null;
	warnings: string[];
	uiPayload: UiResponsePayload | null;
	rawText: string;
	source: "planner" | "researcher" | "ui" | "text";
}

export function parseAssistantPayload(content: string): ParsedAgentPayload {
	try {
		const parsedJson = JSON.parse(content);

		const uiParsed = UiResponsePayloadSchema.safeParse(parsedJson);
		if (uiParsed.success) {
			return {
				summary: uiParsed.data.summary,
				places: uiParsed.data.places,
				tripDraft: uiParsed.data.tripDraft,
				warnings: uiParsed.data.warnings,
				uiPayload: uiParsed.data,
				rawText: uiParsed.data.raw_text,
				source: "ui",
			};
		}

		const plannerParsed = PlannerAgentOutputSchema.safeParse(parsedJson);
		if (plannerParsed.success) {
			return {
				summary: plannerParsed.data.summary,
				places: plannerParsed.data.tripDraft.places,
				tripDraft: plannerParsed.data.tripDraft,
				warnings: plannerParsed.data.tripDraft.warnings,
				uiPayload: null,
				rawText: content,
				source: "planner",
			};
		}

		const researcherParsed = ResearcherAgentOutputSchema.safeParse(parsedJson);
		if (researcherParsed.success) {
			return {
				summary: researcherParsed.data.summary,
				places: researcherParsed.data.places,
				tripDraft: null,
				warnings: [],
				uiPayload: null,
				rawText: content,
				source: "researcher",
			};
		}
	} catch {
		// Keep plain text fallback.
	}

	return {
		summary: content,
		places: [],
		tripDraft: null,
		warnings: [],
		uiPayload: null,
		rawText: content,
		source: "text",
	};
}

export function parseToolPlacesPayload(content: string): CandidatePlace[] {
	try {
		const parsed = JSON.parse(content);
		if (!Array.isArray(parsed)) {
			return [];
		}

		return parsed.filter(
			(place) => place && typeof place === "object" && "id" in place
		) as CandidatePlace[];
	} catch {
		return [];
	}
}

export function parseLatestTripDraft(
	messages: Array<{ role: string; content: string }>
): TripDraft | undefined {
	for (const message of [...messages].reverse()) {
		if (message.role !== "assistant") continue;
		const parsed = parseAssistantPayload(message.content);
		if (parsed.tripDraft) {
			return parsed.tripDraft;
		}
	}

	return undefined;
}
