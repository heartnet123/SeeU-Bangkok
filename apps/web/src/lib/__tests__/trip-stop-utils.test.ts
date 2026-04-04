import { describe, expect, test } from "bun:test";
import { appendPlaceToTrip } from "../trip-stop-utils";
import type { Trip } from "@/types/trip";

const baseTrip: Trip = {
	id: "trip-1",
	name: "Bangkok Day",
	date: "2026-04-05",
	totalDurationMin: 60,
	totalDistanceKm: 0,
	estimatedBudget: 0,
	notes: "",
	stops: [
		{
			id: "stop-1",
			placeId: "place-1",
			name: "Wat Arun",
			address: "wat-arun",
			category: "Temple",
			suggestedDurationMin: 60,
			lat: 13.7437,
			lng: 100.4889,
		},
	],
};

describe("appendPlaceToTrip", () => {
	test("returns missing-trip when no trip is selected", () => {
		const result = appendPlaceToTrip({
			trips: [baseTrip],
			selectedTripId: null,
			place: {
				id: "place-2",
				name: "Grand Palace",
				slug: "grand-palace",
				lat: 13.75,
				lng: 100.49,
				tags: ["Temple"],
			},
		});

		expect(result.status).toBe("missing-trip");
		expect(result.trips).toEqual([baseTrip]);
	});

	test("prevents duplicates by place id before falling back to name", () => {
		const result = appendPlaceToTrip({
			trips: [baseTrip],
			selectedTripId: "trip-1",
			place: {
				id: "place-1",
				name: "Wat Arun (duplicate label)",
				slug: "wat-arun",
				lat: 13.7437,
				lng: 100.4889,
				tags: ["Temple"],
			},
		});

		expect(result.status).toBe("duplicate");
		expect(result.trips[0]?.stops).toHaveLength(1);
	});

	test("appends a mapped stop and recomputes total duration", () => {
		const result = appendPlaceToTrip({
			trips: [baseTrip],
			selectedTripId: "trip-1",
			place: {
				id: "place-2",
				name: "Grand Palace",
				slug: "grand-palace",
				lat: 13.75,
				lng: 100.49,
				tags: ["Shopping"],
				description: "Historic site",
			},
		});

		expect(result.status).toBe("added");
		expect(result.addedStop?.placeId).toBe("place-2");
		expect(result.trips[0]?.stops).toHaveLength(2);
		expect(result.trips[0]?.stops[1]).toMatchObject({
			name: "Grand Palace",
			address: "grand-palace",
			category: "Shopping",
			notes: "Historic site",
		});
		expect(result.trips[0]?.totalDurationMin).toBe(120);
	});
});
