import { describe, expect, test } from "bun:test";
import { handleStreamEvent } from "./ChatStreamHandler";
import type { PendingTurn } from "./types";

function createPendingTurn(): PendingTurn {
	return {
		workflowSteps: [],
		text: "",
		suggestions: [],
		tripDraft: null,
		errors: [],
	};
}

describe("handleStreamEvent", () => {
	test("handles stage events with workflow progress labels", () => {
		let current = createPendingTurn();
		handleStreamEvent(
			"stage",
			JSON.stringify({ stage: "research_started" }),
			(updater) => {
				current = updater(current);
			},
			() => {}
		);

		expect(current.workflowSteps.at(-1)).toMatchObject({
			label: "Searching places",
			status: "loading",
		});
	});

	test("uses summary instead of raw json during pending message updates", () => {
		let current = createPendingTurn();
		handleStreamEvent(
			"message",
			JSON.stringify({
				intent: "place_recommendation",
				summary: "Minimal walking ideas",
				places: [],
				planningConstraints: {
					durationMinutes: 120,
					maxStops: 3,
					budgetLevel: "medium",
					groupType: "group",
					themes: ["cultural"],
				},
			}),
			(updater) => {
				current = updater(current);
			},
			() => {}
		);

		expect(current.text).toBe("Minimal walking ideas");
	});

	test("ignores opaque json blobs during pending message updates", () => {
		let current = createPendingTurn();
		handleStreamEvent(
			"message",
			"{\"broken\":true,\"nested\":{\"value\":1}}",
			(updater) => {
				current = updater(current);
			},
			() => {}
		);

		expect(current.text).toBe("");
	});
});
