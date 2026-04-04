import { describe, expect, test } from "bun:test";
import { parseAssistantPayload, parseLatestTripDraft, parseToolPlacesPayload } from "../payload-parsing";
import { buildUiPayload, dedupeCandidatePlaces, deriveUiActions } from "../ui-payload";

const tripDraft = {
	title: "Temple Morning",
	summary: "Two temples by the river.",
	constraints: {
		durationMinutes: 180,
		maxStops: 2,
		budgetLevel: "low" as const,
		groupType: "solo" as const,
		themes: ["temple"],
	},
	places: [
		{
			id: "wat-arun",
			name: "Wat Arun",
			slug: "wat-arun",
			lat: 13.7437,
			lng: 100.4889,
			tags: ["temple"],
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
			notes: "Arrive early.",
			distance_from_prev_km: 0,
			travel_time_from_prev_min: 0,
		},
	],
	total_distance_km: 0,
	total_minutes: 60,
	warnings: ["Ferry queue may add time."],
	validation: {
		isValid: true,
		score: 92,
		warnings: [],
		suggestions: [],
	},
};

describe("agent payload helpers", () => {
	test("parseAssistantPayload extracts planner payload details", () => {
		const parsed = parseAssistantPayload(JSON.stringify({
			intent: "itinerary",
			summary: "Route ready",
			tripDraft,
		}));

		expect(parsed.source).toBe("planner");
		expect(parsed.summary).toBe("Route ready");
		expect(parsed.tripDraft?.title).toBe("Temple Morning");
		expect(parsed.warnings).toEqual(["Ferry queue may add time."]);
	});

	test("parseLatestTripDraft reads trip draft from stored ui payload", () => {
		const latestTripDraft = parseLatestTripDraft([
			{ role: "assistant", content: "plain text" },
			{
				role: "assistant",
				content: JSON.stringify({
					version: "1.0",
					intent: "itinerary",
					summary: "Saved draft",
					places: tripDraft.places,
					tripDraft,
					actions: [{ type: "save_trip_draft", label: "Save trip" }],
					warnings: tripDraft.warnings,
					raw_text: "Saved draft",
				}),
			},
		]);

		expect(latestTripDraft?.title).toBe("Temple Morning");
	});

	test("parseToolPlacesPayload returns candidate places from researcher tool output", () => {
		const places = parseToolPlacesPayload(JSON.stringify([
			{ id: "wat-arun", name: "Wat Arun", slug: "wat-arun", tags: [] },
			{ id: "wat-pho", name: "Wat Pho", slug: "wat-pho", tags: [] },
		]));

		expect(places).toHaveLength(2);
		expect(places[0]?.id).toBe("wat-arun");
	});

	test("parseAssistantPayload normalizes researcher groupType alias friends", () => {
		const parsed = parseAssistantPayload(JSON.stringify({
			intent: "place_recommendation",
			summary: "Minimal walking ideas",
			places: [
				{
					id: "wat-phra-kaew",
					name: "Wat Phra Kaew",
					slug: "wat-phra-kaew",
					lat: 13.75,
					lng: 100.4913,
					tags: ["temple", "cultural"],
					description: "A sacred temple complex.",
				},
			],
			planningConstraints: {
				durationMinutes: 120,
				maxStops: 3,
				budgetLevel: "medium",
				groupType: "friends",
				themes: ["cultural", "temple"],
			},
		}));

		expect(parsed.source).toBe("researcher");
		expect(parsed.summary).toBe("Minimal walking ideas");
		expect(parsed.places).toHaveLength(1);
	});

	test("parseAssistantPayload salvages malformed structured payload instead of falling back to raw text", () => {
		const parsed = parseAssistantPayload(JSON.stringify({
			intent: "place_recommendation",
			summary: "Minimal walking ideas",
			places: [
				{
					id: "wat-phra-kaew",
					name: "Wat Phra Kaew",
					lat: 13.75,
					lng: 100.4913,
				},
			],
			planningConstraints: {
				durationMinutes: 120,
				maxStops: 3,
				budgetLevel: "medium",
				groupType: "buddies",
				themes: ["cultural", "temple"],
			},
		}));

		expect(parsed.source).toBe("partial");
		expect(parsed.summary).toBe("Minimal walking ideas");
		expect(parsed.places).toEqual([]);
		expect(parsed.rawText).toBe("Minimal walking ideas");
	});

	test("buildUiPayload dedupes places and derives actions", () => {
		const uniquePlaces = dedupeCandidatePlaces([
			tripDraft.places[0],
			{ ...tripDraft.places[0] },
		]);
		const actions = deriveUiActions({ places: uniquePlaces, tripDraft });
		const uiPayload = buildUiPayload({
			sessionId: "session-123",
			summary: "Route ready",
			rawText: "Route ready",
			places: [tripDraft.places[0], { ...tripDraft.places[0] }],
			tripDraft,
			warnings: tripDraft.warnings,
		});

		expect(uniquePlaces).toHaveLength(1);
		expect(actions.map((action) => action.type)).toEqual([
			"add_all_to_trip",
			"preview_itinerary",
			"save_trip_draft",
		]);
		expect(uiPayload.intent).toBe("itinerary");
		expect(uiPayload.places).toHaveLength(1);
		expect(uiPayload.actions).toHaveLength(3);
	});
});
