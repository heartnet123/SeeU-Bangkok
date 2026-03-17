import { describe, expect, test } from "bun:test";
import { resolvePlacePersonalizationDefaults } from "../places-personalization";

describe("resolvePlacePersonalizationDefaults", () => {
	test("returns null defaults when personalization sources fail", async () => {
		const defaults = await resolvePlacePersonalizationDefaults("user-123", {
			loadProfile: async () => {
				throw new Error("user_profiles missing");
			},
			loadUserPreferences: async () => {
				throw new Error("agent_memory missing");
			},
		});

		expect(defaults).toBeNull();
	});

	test("normalizes defaults when profile and preferences load successfully", async () => {
		const defaults = await resolvePlacePersonalizationDefaults("user-123", {
			loadProfile: async () => ({
				budget_per_day: 900,
				mobility: "public",
				travel_style: ["foodie"],
				languages: ["th"],
				onboarding_preferences: {
					pace: 25,
					culinary: ["Street Food"],
				},
			}),
			loadUserPreferences: async () => ({
				language_preference: "th",
			}),
		});

		expect(defaults).not.toBeNull();
		expect(defaults?.budgetLevel).toBe("low");
		expect(defaults?.preferredTransport).toBe("public");
		expect(defaults?.themes).toContain("restaurant");
		expect(defaults?.culinaryPreferences).toContain("street food");
	});
});
