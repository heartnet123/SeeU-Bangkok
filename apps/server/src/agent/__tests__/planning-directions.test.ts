import { afterEach, beforeEach, describe, expect, test } from "bun:test";

const originalFetch = globalThis.fetch;
const originalEnv = {
	SUPABASE_URL: process.env.SUPABASE_URL,
	SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
	SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
	MAPBOX_ACCESS_TOKEN: process.env.MAPBOX_ACCESS_TOKEN,
	NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN: process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN,
};

const candidates = [
	{
		id: "wat-arun",
		name: "Wat Arun",
		slug: "wat-arun",
		lat: 13.7437,
		lng: 100.4889,
		tags: ["temple"],
		description: "Riverside temple",
	},
	{
		id: "wat-pho",
		name: "Wat Pho",
		slug: "wat-pho",
		lat: 13.7465,
		lng: 100.493,
		tags: ["temple"],
		description: "Reclining Buddha",
	},
];

describe("planning tools with Mapbox Directions", () => {
	beforeEach(() => {
		process.env.SUPABASE_URL = "https://example.supabase.co";
		process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
		process.env.SUPABASE_ANON_KEY = "anon-key";
		process.env.MAPBOX_ACCESS_TOKEN = "pk.test-token";
		process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN = "pk.test-token";
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
		process.env.SUPABASE_URL = originalEnv.SUPABASE_URL;
		process.env.SUPABASE_SERVICE_ROLE_KEY = originalEnv.SUPABASE_SERVICE_ROLE_KEY;
		process.env.SUPABASE_ANON_KEY = originalEnv.SUPABASE_ANON_KEY;
		process.env.MAPBOX_ACCESS_TOKEN = originalEnv.MAPBOX_ACCESS_TOKEN;
		process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN = originalEnv.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
	});

	test("build_route calls Mapbox Directions API and uses its leg metrics", async () => {
		const fetchCalls: string[] = [];

		globalThis.fetch = (async (input: RequestInfo | URL) => {
			const url = String(input);
			fetchCalls.push(url);

			if (url.includes("directions-matrix")) {
				return new Response(
					JSON.stringify({
						code: "Ok",
						distances: [
							[0, 900],
							[900, 0],
						],
						durations: [
							[0, 180],
							[180, 0],
						],
					}),
					{ status: 200, headers: { "Content-Type": "application/json" } }
				);
			}

			if (url.includes("directions/v5")) {
				return new Response(
					JSON.stringify({
						code: "Ok",
						routes: [
							{
								distance: 1250,
								duration: 660,
								legs: [
									{
										distance: 1250,
										duration: 660,
									},
								],
							},
						],
					}),
					{ status: 200, headers: { "Content-Type": "application/json" } }
				);
			}

			return new Response("not found", { status: 404 });
		}) as typeof fetch;

		const { build_route } = await import("../tools/planning");
		const route = await build_route({ places: candidates });

		expect(fetchCalls.some((url) => url.includes("directions/v5/mapbox/driving"))).toBe(true);
		expect(route.legs[0]?.distance_km).toBe(1.3);
		expect(route.legs[0]?.duration_min).toBe(11);
		expect(route.total_km).toBe(1.3);
		expect(route.total_mins).toBe(11);
	});

	test("plan_itinerary populates TripDraft travel times from Mapbox route data", async () => {
		globalThis.fetch = (async (input: RequestInfo | URL) => {
			const url = String(input);

			if (url.includes("directions-matrix")) {
				return new Response(
					JSON.stringify({
						code: "Ok",
						distances: [
							[0, 900],
							[900, 0],
						],
						durations: [
							[0, 180],
							[180, 0],
						],
					}),
					{ status: 200, headers: { "Content-Type": "application/json" } }
				);
			}

			if (url.includes("directions/v5")) {
				return new Response(
					JSON.stringify({
						code: "Ok",
						routes: [
							{
								distance: 1250,
								duration: 660,
								legs: [
									{
										distance: 1250,
										duration: 660,
									},
								],
							},
						],
					}),
					{ status: 200, headers: { "Content-Type": "application/json" } }
				);
			}

			return new Response("not found", { status: 404 });
		}) as typeof fetch;

		const { plan_itinerary } = await import("../tools/planning");
		const draft = await plan_itinerary({
			places: candidates,
			constraints: {
				durationMinutes: 180,
				maxStops: 2,
				budgetLevel: "medium",
				groupType: "solo",
				themes: ["temple"],
			},
		});

		expect(draft.stops).toHaveLength(2);
		expect(draft.stops[1]?.travel_time_from_prev_min).toBe(11);
		expect(draft.stops[1]?.distance_from_prev_km).toBe(1.3);
		expect(draft.total_distance_km).toBe(1.3);
		expect(draft.total_minutes).toBe(131);
	});
});
