import { describe, expect, test } from "bun:test";
import {
	classifySupervisorIntent,
	isCriticRequested,
} from "../intent-classification";
import { normalizeSupervisorInvocationResult } from "../response-normalization";
import { deriveSupervisorRoutingPolicy } from "../routing-policy";
import {
	buildScopeRefusalPayload,
	classifyScope,
	classifyScopeWithResolution,
} from "../scope-policy";
import type { TripDraft } from "../state";

const draft: TripDraft = {
	title: "Bangkok temple loop",
	summary: "Three-stop temple day trip.",
	constraints: {
		durationMinutes: 360,
		maxStops: 4,
		budgetLevel: "medium",
		groupType: "solo",
		themes: ["culture"],
	},
	places: [],
	stops: [
		{
			id: "1",
			place_id: "wat-arun",
			slug: "wat-arun",
			name: "Wat Arun",
			suggested_time_min: 60,
			notes: "Start here",
			distance_from_prev_km: 0,
			travel_time_from_prev_min: 0,
		},
	],
	total_distance_km: 0,
	total_minutes: 60,
	warnings: [],
	validation: {
		isValid: true,
		score: 0.9,
		warnings: [],
		suggestions: [],
	},
};

describe("supervisor intent classification", () => {
	test("classifies place discovery as informational", () => {
		expect(
			classifySupervisorIntent({
				messages: [{ role: "user", content: "What temples are in Bangkok?" }],
			})
		).toBe("informational");
	});

	test("classifies trip planning as itinerary", () => {
		expect(
			classifySupervisorIntent({
				messages: [{ role: "user", content: "Plan a half-day temple tour" }],
			})
		).toBe("itinerary");
	});

	test("treats draft revision as itinerary", () => {
		expect(
			classifySupervisorIntent({
				messages: [{ role: "user", content: "Please improve this itinerary" }],
				currentTripDraft: draft,
			})
		).toBe("itinerary");
	});
});

describe("supervisor routing policy", () => {
	test("uses researcher only for informational requests", () => {
		expect(
			deriveSupervisorRoutingPolicy({
				messages: [{ role: "user", content: "Find street food near Siam" }],
			})
		).toEqual({
			intent: "informational",
			requiresResearch: true,
			requiresPlanning: false,
			useCritic: false,
			supervisorMode: "researcher_only",
			responseFormat: "researcher_json",
		});
	});

	test("uses researcher and planner for itinerary requests without critic escalation", () => {
		expect(
			deriveSupervisorRoutingPolicy({
				messages: [{ role: "user", content: "Plan a day trip to 3 temples" }],
			})
		).toMatchObject({
			supervisorMode: "researcher_planner",
			useCritic: false,
			intent: "itinerary",
		});
	});

	test("escalates to critic for explicit validation requests", () => {
		expect(
			isCriticRequested({
				messages: [{ role: "user", content: "Review this itinerary and improve it" }],
				currentTripDraft: draft,
			})
		).toBe(true);

		expect(
			deriveSupervisorRoutingPolicy({
				messages: [{ role: "user", content: "Review this itinerary and improve it" }],
				currentTripDraft: draft,
			})
		).toMatchObject({
			supervisorMode: "researcher_planner_critic",
			useCritic: true,
		});
	});
});

describe("scope policy", () => {
	test("accepts old town aliases as in scope", () => {
		expect(
			classifyScope({
				messages: [{ role: "user", content: "Plan an old town walk near Sanam Luang" }],
			})
		).toMatchObject({
			classification: "in_scope",
		});
	});

	test("treats underspecified tourism requests as implicitly in scope", () => {
		expect(
			classifyScope({
				messages: [{ role: "user", content: "Recommend 3 historical places" }],
			})
		).toMatchObject({
			classification: "implicit_in_scope",
		});
	});

	test("rejects out-of-scope area requests", () => {
		expect(
			classifyScope({
				messages: [{ role: "user", content: "Recommend 3 cafés in Thonglor" }],
			})
		).toMatchObject({
			classification: "out_of_scope_place",
			reasonCode: "OUT_OF_SCOPE",
		});
	});

	test("rejects resolved out-of-scope areas without hardcoded blacklist terms", async () => {
		await expect(
			classifyScopeWithResolution(
				{
					messages: [{ role: "user", content: "Recommend 3 cafés in Ekkamai" }],
				},
				{
					extractAreas: async () => ["Ekkamai"],
					resolveArea: async () => ({
						label: "Ekkamai, Bangkok",
						lat: 13.7306,
						lng: 100.5854,
					}),
				}
			)
		).resolves.toMatchObject({
			classification: "out_of_scope_place",
			reasonCode: "OUT_OF_SCOPE",
			matchedTerms: ["Ekkamai"],
		});
	});

	test("keeps generic tourism requests implicitly in scope when no area is extracted", async () => {
		await expect(
			classifyScopeWithResolution(
				{
					messages: [{ role: "user", content: "Recommend 3 historical places" }],
				},
				{
					extractAreas: async () => [],
				}
			)
		).resolves.toMatchObject({
			classification: "implicit_in_scope",
		});
	});

	test("rejects impossible geography inside scope", () => {
		expect(
			classifyScope({
				messages: [{ role: "user", content: "Recommend a beachfront seafood restaurant on Rattanakosin Island" }],
			})
		).toMatchObject({
			classification: "impossible_geography",
			reasonCode: "IMPOSSIBLE_GEOGRAPHY",
		});
	});

	test("builds refusal payload in canonical ui format", () => {
		const payload = buildScopeRefusalPayload({
			classification: "out_of_scope_trip",
			sessionId: "session-1",
			matchedTerms: ["siam"],
		});

		expect(payload).toMatchObject({
			version: "1.0",
			intent: "refusal",
			sessionId: "session-1",
			places: [],
			tripDraft: null,
			warnings: ["OUT_OF_SCOPE"],
		});
	});

	test("streams a refusal message for out-of-scope requests", async () => {
		process.env.SUPABASE_URL ||= "https://example.supabase.co";
		process.env.SUPABASE_SERVICE_ROLE_KEY ||= "test-service-role-key";
		const { streamSupervisor } = await import("../supervisor");
		const events: Array<{ type: string; data: unknown }> = [];

		for await (const event of streamSupervisor([
			{ role: "user", content: "Recommend 3 cafés in Chiang Mai" },
		])) {
			events.push(event);
		}

		const messageEvent = events.find((event) => event.type === "message");
		expect(messageEvent).toBeDefined();
		expect(messageEvent?.data).toMatchObject({
			role: "assistant",
			content: expect.stringContaining("\"intent\":\"refusal\""),
		});
	});
});

describe("supervisor response normalization", () => {
	test("normalizes non-string message content to strings", () => {
		expect(
			normalizeSupervisorInvocationResult({
				messages: [{ role: "assistant", content: { ok: true } }],
			})
		).toEqual({
			messages: [{ role: "assistant", content: JSON.stringify({ ok: true }), name: undefined }],
		});
	});

	test("keeps structured assistant json payload string intact", () => {
		const content = JSON.stringify({
			intent: "place_recommendation",
			summary: "Top picks",
			places: [],
		});

		expect(
			normalizeSupervisorInvocationResult({
				messages: [{ role: "assistant", content }],
			}).messages[0]?.content
		).toBe(content);
	});
});
