import { describe, expect, test } from "bun:test";
import { handleStreamEvent } from "../ChatStreamHandler";
import type { PendingTurn } from "../types";

function createPendingTurn(): PendingTurn {
	return {
		workflowSteps: [],
		text: "",
		suggestions: [],
		tripDraft: null,
		errors: [],
		ui: undefined,
	};
}

describe("ChatStreamHandler tripDraft parsing", () => {
	test("ui event hydrates tripDraft as the canonical preview model", () => {
		let pending = createPendingTurn();

		handleStreamEvent(
			"ui",
			JSON.stringify({
				version: "1.0",
				intent: "itinerary",
				sessionId: "session-123",
				summary: "Draft ready",
				places: [],
				tripDraft: {
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
			}),
			(update) => {
				pending = update(pending);
			},
			() => undefined
		);

		expect(pending.ui?.tripDraft).not.toBeNull();
		expect(pending.tripDraft?.title).toBe("Temple Draft");
	});
});
