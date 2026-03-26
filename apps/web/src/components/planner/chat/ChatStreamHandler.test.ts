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
});
