import { describe, expect, test } from "bun:test";
import {
	CritiqueStageOutputSchema,
	PlanningStageOutputSchema,
	ResearchStageOutputSchema,
} from "../state";

describe("stateful pipeline contracts", () => {
	test("parses research stage output schema", () => {
		const parsed = ResearchStageOutputSchema.parse({
			summary: "Found three places",
			querySummary: "historical places",
			places: [],
			evidence: [],
			coverageGaps: [],
		});

		expect(parsed.summary).toBe("Found three places");
	});

	test("parses planning stage output schema", () => {
		const parsed = PlanningStageOutputSchema.parse({
			summary: "Draft ready",
			tripDraft: {
				title: "Old Town Walk",
				summary: "Three-stop walking itinerary",
				constraints: {
					durationMinutes: 180,
					maxStops: 3,
					budgetLevel: "medium",
					groupType: "solo",
					themes: ["history"],
				},
				places: [],
				stops: [],
				total_distance_km: 2,
				total_minutes: 180,
				warnings: [],
				validation: {
					isValid: true,
					score: 90,
					warnings: [],
					suggestions: [],
				},
			},
			assumptions: [],
			droppedPlaces: [],
		});

		expect(parsed.tripDraft.title).toBe("Old Town Walk");
	});

	test("parses critique stage output schema", () => {
		const parsed = CritiqueStageOutputSchema.parse({
			validation: {
				isValid: false,
				score: 72,
				warnings: ["Too much walking"],
				suggestions: ["Shorten the route"],
			},
			hardViolations: [],
			softWarnings: ["Too much walking"],
			revisionInstructions: ["Reduce walking distance"],
		});

		expect(parsed.revisionInstructions[0]).toBe("Reduce walking distance");
	});
});
