import { describe, expect, test } from "bun:test";
import { buildTripDraftSavePayload } from "../lib/trip-draft";

describe("buildTripDraftSavePayload", () => {
	test("uses place_id from the draft instead of reconstructing slugs from names", () => {
		const payload = buildTripDraftSavePayload({
			title: "Temple Draft",
			summary: "A short temple loop",
			constraints: {
				durationMinutes: 180,
				maxStops: 2,
				budgetLevel: "medium",
				groupType: "solo",
				themes: ["temple"],
			},
			places: [],
			stops: [
				{
					id: "wat-arun",
					place_id: "wat-arun",
					slug: "wat-arun",
					name: "Wat Arun",
					lat: 13.7437,
					lng: 100.4889,
					suggested_time_min: 60,
					travel_time_from_prev_min: 0,
					distance_from_prev_km: 0,
					notes: "Start here",
				},
			],
			total_distance_km: 0,
			total_minutes: 60,
			warnings: [],
			validation: {
				isValid: true,
				score: 100,
				warnings: [],
				suggestions: [],
			},
		});

		expect(payload.stops[0]?.place_id).toBe("wat-arun");
		expect("slug" in (payload.stops[0] ?? {})).toBe(false);
	});
});
