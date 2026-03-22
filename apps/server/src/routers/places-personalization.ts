import {
	loadUserProfileSnapshot,
	normalizePersonalizationDefaults,
	type PersonalizationDefaults,
	type UserProfileSnapshot,
} from "../agent/personalization";

interface PersonalizationLoaders {
	loadProfile?: (userId: string) => Promise<UserProfileSnapshot | null>;
	loadUserPreferences?: (userId: string) => Promise<Record<string, unknown>>;
}

export async function resolvePlacePersonalizationDefaults(
	userId?: string | null,
	loaders: PersonalizationLoaders = {},
): Promise<PersonalizationDefaults | null> {
	if (!userId) {
		return null;
	}

	const loadProfile = loaders.loadProfile ?? loadUserProfileSnapshot;
	const loadUserPreferences =
		loaders.loadUserPreferences ??
		(async (id: string) => {
			const { MemoryManager } = await import("../agent/memory");
			return new MemoryManager({ userId: id }).getUserPreferences();
		});

	try {
		const [profile, userPreferences] = await Promise.all([
			loadProfile(userId),
			loadUserPreferences(userId),
		]);

		return normalizePersonalizationDefaults({
			profile,
			userPreferences,
		});
	} catch (error) {
		console.warn("Failed to load place personalization defaults:", error);
		return null;
	}
}
