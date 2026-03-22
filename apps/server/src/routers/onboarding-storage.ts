export interface OnboardingPreferencesPayload {
	vibes: string[];
	travelStyle: string;
	pace: number;
	transit: string[];
	culinary: string[];
	boundaries: string[];
}

export interface OnboardingRequestPayload extends OnboardingPreferencesPayload {
	skipped: boolean;
}

export interface OnboardingState {
	completed: boolean;
	completed_at: string | null;
	skipped_at: string | null;
	preferences: OnboardingPreferencesPayload | null;
}

interface OnboardingMemoryStatus {
	completed?: boolean | null;
	completedAt?: string | null;
	skippedAt?: string | null;
}

interface PostgrestLikeError {
	code?: string;
	message?: string;
	details?: string;
	hint?: string;
}

const ONBOARDING_COLUMN_NAMES = [
	"onboarding_completed",
	"onboarding_completed_at",
	"onboarding_skipped_at",
	"onboarding_preferences",
];

export function buildOnboardingState(
	payload: OnboardingRequestPayload,
	now: string
): OnboardingState {
	const skipped = Boolean(payload.skipped);

	return {
		completed: !skipped,
		completed_at: skipped ? null : now,
		skipped_at: skipped ? now : null,
		preferences: {
			vibes: payload.vibes,
			travelStyle: payload.travelStyle,
			pace: payload.pace,
			transit: payload.transit,
			culinary: payload.culinary,
			boundaries: payload.boundaries,
		},
	};
}

export function hydrateOnboardingState({
	profile,
	memoryStatus,
	memoryPreferences,
}: {
	profile?: Partial<OnboardingState> | null;
	memoryStatus?: OnboardingMemoryStatus | null;
	memoryPreferences?: OnboardingPreferencesPayload | null;
}): OnboardingState {
	if (profile) {
		return {
			completed: Boolean(profile.completed),
			completed_at: profile.completed_at ?? null,
			skipped_at: profile.skipped_at ?? null,
			preferences: profile.preferences ?? memoryPreferences ?? null,
		};
	}

	return {
		completed: Boolean(memoryStatus?.completed),
		completed_at: memoryStatus?.completedAt ?? null,
		skipped_at: memoryStatus?.skippedAt ?? null,
		preferences: memoryPreferences ?? null,
	};
}

export function isOnboardingProfileSchemaError(
	error: PostgrestLikeError | null | undefined
): boolean {
	if (!error) {
		return false;
	}

	const text = `${error.message ?? ""} ${error.details ?? ""} ${error.hint ?? ""}`.toLowerCase();

	return (
		error.code === "PGRST204" ||
		error.code === "42703" ||
		ONBOARDING_COLUMN_NAMES.some((columnName) => text.includes(columnName))
	);
}
