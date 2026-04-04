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
	source: "planner" | "researcher" | "ui" | "partial" | "text";
}

function normalizeGroupTypeAlias(value: unknown): unknown {
	if (!value || typeof value !== "object") {
		return value;
	}

	const normalized = { ...(value as Record<string, unknown>) };

	const normalizeConstraints = (constraints: unknown) => {
		if (!constraints || typeof constraints !== "object") {
			return constraints;
		}

		const next = { ...(constraints as Record<string, unknown>) };
		if (next.groupType === "friends") {
			next.groupType = "group";
		}
		return next;
	};

	if ("planningConstraints" in normalized) {
		normalized.planningConstraints = normalizeConstraints(normalized.planningConstraints);
	}

	if ("tripDraft" in normalized && normalized.tripDraft && typeof normalized.tripDraft === "object") {
		const tripDraft = { ...(normalized.tripDraft as Record<string, unknown>) };
		tripDraft.constraints = normalizeConstraints(tripDraft.constraints);
		normalized.tripDraft = tripDraft;
	}

	return normalized;
}

function salvageCandidatePlaces(value: unknown): CandidatePlace[] {
	if (!Array.isArray(value)) {
		return [];
	}

	return value.flatMap((place) => {
		if (!place || typeof place !== "object") {
			return [];
		}

		const record = place as Record<string, unknown>;
		if (
			typeof record.id !== "string" ||
			typeof record.name !== "string" ||
			typeof record.slug !== "string"
		) {
			return [];
		}

		return [{
			id: record.id,
			name: record.name,
			slug: record.slug,
			lat: typeof record.lat === "number" ? record.lat : undefined,
			lng: typeof record.lng === "number" ? record.lng : undefined,
			tags: Array.isArray(record.tags)
				? record.tags.filter((tag): tag is string => typeof tag === "string")
				: [],
			price: typeof record.price === "number" ? record.price : undefined,
			image_url: typeof record.image_url === "string" ? record.image_url : undefined,
			description: typeof record.description === "string" ? record.description : undefined,
			address: typeof record.address === "string" ? record.address : undefined,
		} satisfies CandidatePlace];
	});
}

export function parseAssistantPayload(content: string): ParsedAgentPayload {
	try {
		const parsedJson = normalizeGroupTypeAlias(JSON.parse(content));

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

		if (parsedJson && typeof parsedJson === "object") {
			const record = parsedJson as Record<string, unknown>;
			if (typeof record.summary === "string") {
				return {
					summary: record.summary,
					places: salvageCandidatePlaces(record.places),
					tripDraft: null,
					warnings: [],
					uiPayload: null,
					rawText: record.summary,
					source: "partial",
				};
			}
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
