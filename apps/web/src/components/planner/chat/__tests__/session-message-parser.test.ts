import { describe, expect, test } from "bun:test";
import { parseStoredAssistantMessage } from "../lib/session-message-parser";

describe("parseStoredAssistantMessage", () => {
	test("hydrates structured ui payload from stored assistant message", () => {
		const parsed = parseStoredAssistantMessage(
			JSON.stringify({
				version: "1.0",
				intent: "itinerary",
				sessionId: "session-123",
				summary: "Draft ready",
				places: [
					{
						id: "wat-arun",
						name: "Wat Arun",
						slug: "wat-arun",
						tags: ["temple"],
					},
				],
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
				actions: [{ type: "preview_itinerary", label: "Preview itinerary on map" }],
				warnings: [],
				raw_text: "Draft ready",
			}),
		);

		expect(parsed.text).toBe("Draft ready");
		expect(parsed.suggestions).toHaveLength(1);
		expect(parsed.tripDraft?.title).toBe("Temple Draft");
		expect(parsed.ui?.intent).toBe("itinerary");
	});

	test("falls back to plain assistant text when content is not structured json", () => {
		const parsed = parseStoredAssistantMessage("Simple assistant reply");

		expect(parsed.text).toBe("Simple assistant reply");
		expect(parsed.suggestions).toEqual([]);
		expect(parsed.tripDraft).toBeNull();
		expect(parsed.ui).toBeUndefined();
	});
});
