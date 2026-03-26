import { UiResponsePayloadSchema, type CandidatePlace, type TripDraft, type UiResponsePayload } from "./state";

export type UiAction = {
	type: "add_all_to_trip" | "preview_itinerary" | "save_trip_draft";
	label: string;
};

export function dedupeCandidatePlaces(places: CandidatePlace[]): CandidatePlace[] {
	return Array.from(
		new Map(
			places
				.filter((place) => place && (place.id || place.slug || place.name))
				.map((place) => [String(place.id || place.slug || place.name), place])
		).values()
	);
}

export function deriveUiActions(options: {
	places: CandidatePlace[];
	tripDraft: TripDraft | null;
}): UiAction[] {
	return [
		...(options.places.length > 0 ? [{ type: "add_all_to_trip", label: "Add all to trip" } as const] : []),
		...(options.tripDraft ? [{ type: "preview_itinerary", label: "Preview itinerary on map" } as const] : []),
		...(options.tripDraft ? [{ type: "save_trip_draft", label: "Save trip" } as const] : []),
	];
}

export function buildUiPayload(options: {
	sessionId?: string;
	summary: string;
	rawText: string;
	places: CandidatePlace[];
	tripDraft: TripDraft | null;
	warnings: string[];
}): UiResponsePayload {
	const uniquePlaces = dedupeCandidatePlaces(options.places);
	const rawUiPayload: UiResponsePayload = {
		version: "1.0",
		intent: options.tripDraft
			? "itinerary"
			: uniquePlaces.length > 0
				? "place_recommendation"
				: "chat",
		sessionId: options.sessionId,
		summary: options.summary,
		places: uniquePlaces,
		tripDraft: options.tripDraft,
		actions: deriveUiActions({
			places: uniquePlaces,
			tripDraft: options.tripDraft,
		}),
		warnings: options.warnings,
		raw_text: options.rawText,
	};

	const validatedUi = UiResponsePayloadSchema.safeParse(rawUiPayload);
	if (validatedUi.success) {
		return validatedUi.data;
	}

	return {
		version: "1.0",
		intent: "chat",
		sessionId: options.sessionId,
		summary: options.summary,
		places: [],
		tripDraft: null,
		actions: [],
		warnings: [],
		raw_text: options.rawText,
	};
}
