import type { TripDraft } from "../types";

export function buildTripDraftSavePayload(tripDraft: TripDraft) {
	return {
		title: tripDraft.title,
		total_minutes: tripDraft.total_minutes,
		total_distance_km: tripDraft.total_distance_km,
		context: {
			summary: tripDraft.summary,
			warnings: tripDraft.warnings,
			constraints: tripDraft.constraints,
		},
		stops: tripDraft.stops.map((stop) => ({
			place_id: stop.place_id,
			suggested_time_min: stop.suggested_time_min,
			notes: stop.notes ?? "",
			distance_from_prev_km: stop.distance_from_prev_km,
		})),
	};
}
