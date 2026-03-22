import { describe, expect, test } from "bun:test";
import { mapSavedTripFromDraft, mapServerTripToTrip } from "../trip-mappers";
import type { TripDraft } from "@/components/planner/chat/types";

const tripDraft: TripDraft = {
	title: "Temple Draft",
	summary: "A short temple route",
	constraints: {
		durationMinutes: 180,
		maxStops: 2,
		budgetLevel: "medium",
		groupType: "solo",
		themes: ["temple"],
	},
	places: [
		{
			id: "wat-arun",
			name: "Wat Arun",
			slug: "wat-arun",
			lat: 13.7437,
			lng: 100.4889,
			tags: ["Temple"],
		},
	],
	stops: [
		{
			id: "stop-1",
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
	total_distance_km: 4.5,
	total_minutes: 60,
	warnings: [],
	validation: {
		isValid: true,
		score: 100,
		warnings: [],
		suggestions: [],
	},
};

describe("trip mappers", () => {
	test("mapSavedTripFromDraft creates a saved trip that can render in My Trips immediately", () => {
		const savedTrip = mapSavedTripFromDraft({
			tripDraft,
			savedTrip: {
				id: "trip-123",
				title: "Temple Draft",
				created_at: "2026-03-17T10:30:00.000Z",
			},
		});

		expect(savedTrip.id).toBe("trip-123");
		expect(savedTrip.name).toBe("Temple Draft");
		expect(savedTrip.source).toBe("saved");
		expect(savedTrip.stops).toHaveLength(1);
		expect(savedTrip.stops[0]?.placeId).toBe("wat-arun");
		expect(savedTrip.stops[0]?.name).toBe("Wat Arun");
		expect(savedTrip.stops[0]?.category).toBe("Temple");
		expect(savedTrip.totalDistanceKm).toBe(4.5);
	});

	test("mapServerTripToTrip keeps persisted stop metadata when loading saved trips", () => {
		const trip = mapServerTripToTrip({
			id: "trip-456",
			title: "Saved Trip",
			total_minutes: 90,
			total_distance_km: 8,
			created_at: "2026-03-17T10:30:00.000Z",
			stops: [
				{
					id: "stop-a",
					place_id: "grand-palace",
					suggested_time_min: 90,
					distance_from_prev_km: 1.2,
					notes: "Crowded after noon",
					place: {
						id: "grand-palace",
						name: "Grand Palace",
						lat: 13.75,
						lng: 100.49,
						tags: ["Temple"],
					},
				},
			],
		});

		expect(trip.name).toBe("Saved Trip");
		expect(trip.stops[0]?.placeId).toBe("grand-palace");
		expect(trip.stops[0]?.notes).toBe("Crowded after noon");
		expect(trip.stops[0]?.category).toBe("Temple");
	});
});
