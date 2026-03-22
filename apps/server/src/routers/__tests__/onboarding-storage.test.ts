import { describe, expect, test } from "bun:test";
import {
	buildOnboardingState,
	hydrateOnboardingState,
	isOnboardingProfileSchemaError,
} from "../onboarding-storage";

describe("onboarding storage helpers", () => {
	test("buildOnboardingState marks skipped onboarding correctly", () => {
		const now = "2026-03-17T04:00:00.000Z";
		const state = buildOnboardingState(
			{
				vibes: [],
				travelStyle: "",
				pace: 50,
				transit: [],
				culinary: [],
				boundaries: [],
				skipped: true,
			},
			now
		);

		expect(state.completed).toBe(false);
		expect(state.completed_at).toBeNull();
		expect(state.skipped_at).toBe(now);
		expect(state.preferences?.travelStyle).toBe("");
	});

	test("hydrateOnboardingState falls back to memory when profile row is absent", () => {
		const state = hydrateOnboardingState({
			profile: null,
			memoryStatus: {
				completed: false,
				completedAt: null,
				skippedAt: "2026-03-17T04:00:00.000Z",
			},
			memoryPreferences: {
				vibes: [],
				travelStyle: "",
				pace: 50,
				transit: [],
				culinary: [],
				boundaries: [],
			},
		});

		expect(state.completed).toBe(false);
		expect(state.skipped_at).toBe("2026-03-17T04:00:00.000Z");
		expect(state.preferences?.pace).toBe(50);
	});

	test("isOnboardingProfileSchemaError detects missing onboarding columns", () => {
		expect(
			isOnboardingProfileSchemaError({
				code: "PGRST204",
				message:
					"Could not find the 'onboarding_completed' column of 'user_profiles' in the schema cache",
			})
		).toBe(true);
	});
});
