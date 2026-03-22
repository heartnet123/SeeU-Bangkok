import type { CandidatePlace, PlanningConstraints } from "./state";

export type SilentPace = "relaxed" | "balanced" | "packed";
export type PreferredTransport = "walk" | "bike" | "public" | "grab";

export interface UserProfileSnapshot {
	travel_style?: string[] | null;
	mobility?: PreferredTransport | null;
	budget_per_day?: number | null;
	languages?: string[] | null;
	onboarding_preferences?: Record<string, unknown> | null;
}

export interface PersonalizationDefaults {
	budgetLevel: "low" | "medium" | "high" | "flexible";
	pace: SilentPace;
	preferredTransport: PreferredTransport;
	themes: string[];
	culinaryPreferences: string[];
	avoidList: string[];
	languagePreference?: string;
}

export function applyPersonalizationDefaultsToConstraints(
	constraints: PlanningConstraints,
	defaults?: PersonalizationDefaults | null,
): PlanningConstraints {
	if (!defaults) return constraints;

	const paceDerivedMaxStops =
		defaults.pace === "relaxed"
			? Math.min(constraints.maxStops, 3)
			: defaults.pace === "packed"
				? Math.min(Math.max(constraints.maxStops, 5), 8)
				: constraints.maxStops;

	return {
		...constraints,
		budgetLevel:
			constraints.budgetLevel === "medium" ? defaults.budgetLevel : constraints.budgetLevel,
		maxStops:
			constraints.maxStops === 4 ? paceDerivedMaxStops : constraints.maxStops,
		themes: constraints.themes.length > 0 ? constraints.themes : defaults.themes,
	};
}

function normalizeStringArray(values: unknown): string[] {
	if (!Array.isArray(values)) return [];
	return values
		.filter((value) => value != null)
		.map((value) => String(value).trim().toLowerCase())
		.filter(Boolean);
}

function deriveBudgetLevel(
	profile: UserProfileSnapshot | null | undefined,
	userPreferences: Record<string, unknown>,
): PersonalizationDefaults["budgetLevel"] {
	const memoryBudget = String(userPreferences.budget_preference || "").toLowerCase();
	if (memoryBudget.includes("budget") || memoryBudget.includes("low")) return "low";
	if (memoryBudget.includes("luxury") || memoryBudget.includes("high")) return "high";
	if (memoryBudget.includes("flex")) return "flexible";

	const dailyBudget = profile?.budget_per_day;
	if (typeof dailyBudget === "number") {
		if (dailyBudget <= 1200) return "low";
		if (dailyBudget >= 3000) return "high";
		return "medium";
	}

	return "medium";
}

function derivePace(onboardingPreferences: Record<string, unknown> | null | undefined): SilentPace {
	const rawPace = onboardingPreferences?.pace;
	if (typeof rawPace === "number") {
		if (rawPace <= 35) return "relaxed";
		if (rawPace >= 70) return "packed";
	}
	return "balanced";
}

function derivePreferredTransport(
	profile: UserProfileSnapshot | null | undefined,
	onboardingPreferences: Record<string, unknown> | null | undefined,
	userPreferences: Record<string, unknown>,
): PreferredTransport {
	const memoryTransport = String(userPreferences.preferred_transport || "").toLowerCase();
	if (memoryTransport.includes("walk")) return "walk";
	if (memoryTransport.includes("bike")) return "bike";
	if (memoryTransport.includes("grab") || memoryTransport.includes("taxi")) return "grab";
	if (memoryTransport.includes("public") || memoryTransport.includes("rail")) return "public";

	if (profile?.mobility) return profile.mobility;

	const transit = normalizeStringArray(onboardingPreferences?.transit);
	if (transit.some((item) => item.includes("grab") || item.includes("private rides"))) return "grab";
	if (transit.some((item) => item.includes("walk") || item.includes("pedestrian"))) return "walk";
	if (transit.some((item) => item.includes("bike"))) return "bike";
	return "public";
}

function mapTravelStylesToThemes(travelStyles: string[]): string[] {
	const themes = new Set<string>();
	for (const style of travelStyles) {
		if (style.includes("history") || style.includes("archivist")) {
			themes.add("temple");
			themes.add("museum");
		}
		if (style.includes("foodie") || style.includes("epicurean")) {
			themes.add("restaurant");
			themes.add("cafe");
		}
		if (style.includes("instagram") || style.includes("synthesizer")) {
			themes.add("attraction");
			themes.add("cafe");
		}
		if (style.includes("slow-life") || style.includes("flaneur")) {
			themes.add("park");
			themes.add("temple");
		}
		if (style.includes("budget")) {
			themes.add("market");
		}
	}
	return [...themes];
}

function deriveThemes(
	profile: UserProfileSnapshot | null | undefined,
	onboardingPreferences: Record<string, unknown> | null | undefined,
): string[] {
	const themeSet = new Set<string>();
	for (const theme of mapTravelStylesToThemes(normalizeStringArray(profile?.travel_style))) {
		themeSet.add(theme);
	}
	for (const theme of mapTravelStylesToThemes(normalizeStringArray(onboardingPreferences?.travelStyle ? [onboardingPreferences.travelStyle] : []))) {
		themeSet.add(theme);
	}
	for (const item of normalizeStringArray(onboardingPreferences?.culinary)) {
		if (item.includes("cafe")) themeSet.add("cafe");
		if (item.includes("street") || item.includes("food")) themeSet.add("restaurant");
	}
	return [...themeSet];
}

export function normalizePersonalizationDefaults(options: {
	profile?: UserProfileSnapshot | null;
	userPreferences?: Record<string, unknown>;
}): PersonalizationDefaults {
	const userPreferences = options.userPreferences || {};
	const onboardingPreferences =
		(options.profile?.onboarding_preferences as Record<string, unknown> | null | undefined) ||
		(userPreferences.onboarding_preferences as Record<string, unknown> | null | undefined) ||
		null;

	return {
		budgetLevel: deriveBudgetLevel(options.profile, userPreferences),
		pace: derivePace(onboardingPreferences),
		preferredTransport: derivePreferredTransport(options.profile, onboardingPreferences, userPreferences),
		themes: deriveThemes(options.profile, onboardingPreferences),
		culinaryPreferences: normalizeStringArray(onboardingPreferences?.culinary),
		avoidList: normalizeStringArray(onboardingPreferences?.boundaries),
		languagePreference:
			String(userPreferences.language_preference || "").trim() ||
			options.profile?.languages?.find((language) => Boolean(language)) ||
			undefined,
	};
}

type PersonalizablePlace = Pick<CandidatePlace, "name" | "description" | "tags">;

function scorePlaceForPersonalization(
	place: PersonalizablePlace,
	defaults: PersonalizationDefaults,
): number {
	let score = 0;
	const tags = new Set((place.tags || []).map((tag) => tag.toLowerCase()));
	const haystack = `${place.name} ${place.description || ""}`.toLowerCase();

	for (const theme of defaults.themes) {
		if (tags.has(theme) || haystack.includes(theme)) score += 20;
	}

	for (const preference of defaults.culinaryPreferences) {
		if (
			preference.includes("cafe") &&
			(tags.has("cafe") || haystack.includes("coffee"))
		) {
			score += 18;
		}
		if (
			(preference.includes("street") || preference.includes("food")) &&
			(tags.has("restaurant") || tags.has("market") || haystack.includes("food"))
		) {
			score += 14;
		}
	}

	for (const avoid of defaults.avoidList) {
		if (
			(avoid.includes("tourist") || avoid.includes("crowd")) &&
			(tags.has("market") || tags.has("shopping") || tags.has("nightlife"))
		) {
			score -= 30;
		}
		if (avoid.includes("chain") && haystack.includes("chain")) {
			score -= 20;
		}
	}

	return score;
}

export function rerankPlacesByPersonalization<T extends PersonalizablePlace>(
	places: T[],
	defaults?: PersonalizationDefaults | null,
): T[] {
	if (!defaults) return [...places];
	return [...places].sort(
		(a, b) => scorePlaceForPersonalization(b, defaults) - scorePlaceForPersonalization(a, defaults),
	);
}

export async function loadUserProfileSnapshot(
	userId: string,
): Promise<UserProfileSnapshot | null> {
	const { supabase } = await import("@/lib/supabase");
	const { data, error } = await supabase
		.from("user_profiles")
		.select("travel_style,mobility,budget_per_day,languages,onboarding_preferences")
		.eq("user_id", userId)
		.maybeSingle();

	if (error) {
		if (error.code === "PGRST101" || error.code === "PGRST116") {
			return null;
		}
		throw new Error(`Failed to load user profile snapshot: ${error.message}`);
	}

	return data || null;
}
