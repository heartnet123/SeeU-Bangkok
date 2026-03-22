import { describe, expect, test } from "bun:test";
import {
	PlannerAgentOutputSchema,
	PlanningConstraintsSchema,
	TripDraftSchema,
	UiResponsePayloadSchema,
} from "../state";

describe("TripDraft contract", () => {
	test("PlannerAgentOutputSchema accepts canonical trip draft responses", () => {
		const parsed = PlannerAgentOutputSchema.safeParse({
			intent: "itinerary",
			summary: "A relaxed half-day temple route near the river.",
			tripDraft: {
				title: "Half-Day Riverside Temples",
				summary: "Three nearby temples with a manageable walking route.",
				constraints: {
					durationMinutes: 240,
					maxStops: 3,
					budgetLevel: "low",
					groupType: "couple",
					themes: ["temple"],
				},
				places: [
					{
						id: "wat-arun",
						name: "Wat Arun",
						slug: "wat-arun",
						lat: 13.7437,
						lng: 100.4889,
						tags: ["temple", "riverside"],
						description: "Riverside temple",
					},
				],
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
						notes: "Start early to avoid crowds.",
					},
				],
				total_distance_km: 0,
				total_minutes: 60,
				warnings: [],
				validation: {
					isValid: true,
					score: 92,
					warnings: [],
					suggestions: [],
				},
			},
		});

		expect(parsed.success).toBe(true);
	});

	test("UiResponsePayloadSchema accepts tripDraft as the canonical itinerary payload", () => {
		const parsed = UiResponsePayloadSchema.safeParse({
			version: "1.0",
			intent: "itinerary",
			sessionId: "session-123",
			summary: "Draft ready",
			places: [],
			tripDraft: {
				title: "Draft",
				summary: "Draft summary",
				constraints: {
					durationMinutes: 180,
					maxStops: 2,
					budgetLevel: "medium",
					groupType: "solo",
					themes: ["cafe"],
				},
				places: [],
				stops: [],
				total_distance_km: 0,
				total_minutes: 0,
				warnings: [],
				validation: {
					isValid: true,
					score: 100,
					warnings: [],
					suggestions: [],
				},
			},
			actions: [{ type: "save_trip_draft", label: "Save trip" }],
			warnings: [],
			raw_text: "Draft ready",
		});

		expect(parsed.success).toBe(true);
	});

	test("PlanningConstraintsSchema normalizes core planning inputs", () => {
		const parsed = PlanningConstraintsSchema.safeParse({
			durationMinutes: 240,
			maxStops: 4,
			budgetLevel: "low",
			groupType: "family",
			themes: ["kid-friendly", "temple"],
			locationBias: {
				mode: "near_user",
				origin: { lat: 13.7563, lng: 100.5018 },
			},
		});

		expect(parsed.success).toBe(true);
	});

	test("TripDraftSchema requires canonical stop identifiers for persistence", () => {
		const parsed = TripDraftSchema.safeParse({
			title: "Missing ids",
			summary: "Bad draft",
			constraints: {
				durationMinutes: 120,
				maxStops: 2,
				budgetLevel: "medium",
				groupType: "solo",
				themes: [],
			},
			places: [],
			stops: [
				{
					name: "Wat Arun",
					slug: "wat-arun",
					suggested_time_min: 60,
					travel_time_from_prev_min: 0,
					distance_from_prev_km: 0,
					notes: "",
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

		expect(parsed.success).toBe(false);
	});
});
