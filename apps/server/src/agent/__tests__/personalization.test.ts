import { describe, expect, test } from "bun:test";
import type { CandidatePlace } from "../state";
import {
	normalizePersonalizationDefaults,
	rerankPlacesByPersonalization,
	type UserProfileSnapshot,
} from "../personalization";
import { extractPlanningConstraints } from "../domain/planning";

const places: CandidatePlace[] = [
	{
		id: "wat-arun",
		name: "Wat Arun",
		slug: "wat-arun",
		tags: ["temple", "historic"],
		description: "Historic riverside temple",
	},
	{
		id: "cafe-hopping",
		name: "Cafe Hopping Lab",
		slug: "cafe-hopping-lab",
		tags: ["cafe", "restaurant"],
		description: "Specialty coffee and dessert bar",
	},
	{
		id: "chatuchak-market",
		name: "Chatuchak Market",
		slug: "chatuchak-market",
		tags: ["market", "shopping"],
		description: "Large weekend market with crowds",
	},
];

describe("silent personalization", () => {
	test("normalizes defaults from profile, onboarding, and memory", () => {
		const profile: UserProfileSnapshot = {
			budget_per_day: 900,
			mobility: "public",
			travel_style: ["history"],
			languages: ["en", "th"],
		};

		const defaults = normalizePersonalizationDefaults({
			profile,
			userPreferences: {
				onboarding_preferences: {
					pace: 20,
					culinary: ["Street Carts"],
					boundaries: ["Tourist Traps"],
				},
			},
		});

		expect(defaults.budgetLevel).toBe("low");
		expect(defaults.pace).toBe("relaxed");
		expect(defaults.preferredTransport).toBe("public");
		expect(defaults.themes).toContain("temple");
		expect(defaults.culinaryPreferences).toContain("street carts");
		expect(defaults.avoidList).toContain("tourist traps");
		expect(defaults.languagePreference).toBe("en");
	});

	test("reranks places differently based on personalization defaults", () => {
		const foodie = rerankPlacesByPersonalization(places, {
			budgetLevel: "medium",
			pace: "balanced",
			preferredTransport: "public",
			themes: ["cafe", "restaurant"],
			culinaryPreferences: ["specialty cafes"],
			avoidList: [],
			languagePreference: "en",
		});

		const history = rerankPlacesByPersonalization(places, {
			budgetLevel: "medium",
			pace: "balanced",
			preferredTransport: "public",
			themes: ["temple", "museum"],
			culinaryPreferences: [],
			avoidList: ["tourist traps"],
			languagePreference: "en",
		});

		expect(foodie[0]?.id).toBe("cafe-hopping");
		expect(history[0]?.id).toBe("wat-arun");
		expect(history[history.length - 1]?.id).toBe("chatuchak-market");
	});

	test("query overrides stored personalization defaults in planning constraints", () => {
		const defaults = normalizePersonalizationDefaults({
			profile: {
				budget_per_day: 900,
				travel_style: ["foodie"],
				mobility: "public",
			},
			userPreferences: {
				onboarding_preferences: {
					pace: 10,
				},
			},
		});

		const constraints = extractPlanningConstraints("Plan a luxury temple trip", {
			defaults,
		});

		expect(constraints.budgetLevel).toBe("high");
		expect(constraints.themes).toContain("temple");
		expect(constraints.maxStops).toBeLessThanOrEqual(3);
	});
});
