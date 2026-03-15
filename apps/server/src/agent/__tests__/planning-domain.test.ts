import { describe, expect, test } from "bun:test";
import {
	buildTripDraftFromCandidates,
	extractPlanningConstraints,
} from "../domain/planning";

const candidates = [
	{
		id: "wat-arun",
		name: "Wat Arun",
		slug: "wat-arun",
		lat: 13.7437,
		lng: 100.4889,
		tags: ["temple", "riverside"],
		description: "Riverside temple",
	},
	{
		id: "wat-pho",
		name: "Wat Pho",
		slug: "wat-pho",
		lat: 13.7465,
		lng: 100.493,
		tags: ["temple", "historic"],
		description: "Reclining Buddha",
	},
	{
		id: "museum-siam",
		name: "Museum Siam",
		slug: "museum-siam",
		lat: 13.7447,
		lng: 100.4968,
		tags: ["museum"],
		description: "Interactive museum",
	},
];

describe("planning domain", () => {
	test("extractPlanningConstraints infers half-day, low-budget, family-friendly inputs", () => {
		const constraints = extractPlanningConstraints(
			"Plan a half-day low budget kid-friendly trip near me"
		);

		expect(constraints.durationMinutes).toBe(240);
		expect(constraints.budgetLevel).toBe("low");
		expect(constraints.groupType).toBe("family");
		expect(constraints.locationBias?.mode).toBe("near_user");
	});

	test("buildTripDraftFromCandidates limits stops and computes validation", () => {
		const draft = buildTripDraftFromCandidates({
			title: "Temple sampler",
			candidates,
			constraints: {
				durationMinutes: 180,
				maxStops: 2,
				budgetLevel: "medium",
				groupType: "solo",
				themes: ["temple"],
			},
			origin: { lat: 13.7563, lng: 100.5018 },
		});

		expect(draft.stops).toHaveLength(2);
		expect(draft.stops[0]?.place_id).toBeTruthy();
		expect(draft.total_minutes).toBeGreaterThan(0);
		expect(draft.validation.score).toBeGreaterThan(0);
	});
});
