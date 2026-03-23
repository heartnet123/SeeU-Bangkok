import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { authMiddleware } from "../middleware/auth";
import { supabase, supabaseAuth } from "../lib/supabase";
import { LongTermMemory } from "../agent/memory/longterm";
import {
	buildOnboardingState,
	hydrateOnboardingState,
	isOnboardingProfileSchemaError,
	type OnboardingPreferencesPayload,
	type OnboardingState,
} from "./onboarding-storage";

const auth = new Hono();

const loginSchema = z.object({
	email: z.string().email(),
	password: z.string().min(6),
});

const registerSchema = z.object({
	email: z.string().email(),
	password: z.string().min(6),
	display_name: z.string().optional(),
});

const resetPasswordSchema = z.object({
	email: z.string().email(),
});

const updateProfileSchema = z.object({
	nick_name: z.string().optional(),
	avatar_url: z.string().url().optional().or(z.literal("")),
	birth_year: z.number().int().min(1900).max(2010).optional(),
	travel_style: z
		.array(z.enum(["slow-life", "budget", "instagram", "foodie", "history"]))
		.optional(),
	mobility: z.enum(["walk", "bike", "public", "grab"]).optional(),
	budget_per_day: z.number().int().positive().optional(),
	languages: z.array(z.string()).optional(),
	onboarding_completed: z.boolean().optional(),
	onboarding_completed_at: z.string().optional(),
	onboarding_skipped_at: z.string().optional(),
	onboarding_preferences: z.unknown().optional(),
});

const onboardingSchema = z.object({
	vibes: z.array(z.string()).default([]),
	travelStyle: z.string().optional().default(""),
	pace: z.number().int().min(0).max(100).default(50),
	transit: z.array(z.string()).default([]),
	culinary: z.array(z.string()).default([]),
	boundaries: z.array(z.string()).default([]),
	skipped: z.boolean().default(false),
});

interface OnboardingProfileRow {
	onboarding_completed?: boolean | null;
	onboarding_completed_at?: string | null;
	onboarding_skipped_at?: string | null;
	onboarding_preferences?: unknown;
}

interface OnboardingMemoryStatus {
	completed?: boolean | null;
	completedAt?: string | null;
	skippedAt?: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function readStringArray(value: unknown): string[] {
	if (!Array.isArray(value)) {
		return [];
	}

	return value.filter((item): item is string => typeof item === "string");
}

function readOnboardingPreferences(
	value: unknown
): OnboardingPreferencesPayload | null {
	if (!isRecord(value)) {
		return null;
	}

	return {
		vibes: readStringArray(value.vibes),
		travelStyle:
			typeof value.travelStyle === "string" ? value.travelStyle : "",
		pace: typeof value.pace === "number" ? Math.min(100, Math.max(0, value.pace)) : 50,
		transit: readStringArray(value.transit),
		culinary: readStringArray(value.culinary),
		boundaries: readStringArray(value.boundaries),
	};
}

function readOnboardingMemoryStatus(
	value: unknown
): OnboardingMemoryStatus | null {
	if (!isRecord(value)) {
		return null;
	}

	return {
		completed:
			typeof value.completed === "boolean" ? value.completed : null,
		completedAt:
			typeof value.completedAt === "string" ? value.completedAt : null,
		skippedAt:
			typeof value.skippedAt === "string" ? value.skippedAt : null,
	};
}

function profileRowToOnboardingState(
	profile: OnboardingProfileRow
): OnboardingState {
	return hydrateOnboardingState({
		profile: {
			completed: profile.onboarding_completed ?? false,
			completed_at: profile.onboarding_completed_at ?? null,
			skipped_at: profile.onboarding_skipped_at ?? null,
			preferences: readOnboardingPreferences(profile.onboarding_preferences),
		},
	});
}

async function loadOnboardingFromMemory(userId: string): Promise<OnboardingState> {
	try {
		const memoryStatusRaw = await LongTermMemory.getPreference(
			userId,
			"onboarding_status"
		);
		const memoryPreferencesRaw = await LongTermMemory.getPreference(
			userId,
			"onboarding_preferences"
		);

		return hydrateOnboardingState({
			memoryStatus: readOnboardingMemoryStatus(memoryStatusRaw),
			memoryPreferences: readOnboardingPreferences(memoryPreferencesRaw),
		});
	} catch (error) {
		console.error("Failed to fetch onboarding from agent_memory:", error);
		return hydrateOnboardingState({});
	}
}

auth.get("/me", authMiddleware, async (c) => {
	const user = c.get("user");

	try {
		const { data: profile, error } = await supabase
			.from("user_profiles")
			.select("*")
			.eq("user_id", user.id)
			.single();

		if (error) {
			if (error.code === "PGRST116" || error.code === "PGRST101") {
				return c.json({
					user: {
						id: user.id,
						email: user.email,
						...user.user_metadata,
						profile: null,
					},
					message:
						error.code === "PGRST101"
							? "Profile table not set up yet"
							: null,
				});
			}

			console.error("Database error in /me endpoint:", error);
			return c.json({ error: "Failed to fetch profile" }, 500);
		}

		return c.json({
			user: {
				id: user.id,
				email: user.email,
				...user.user_metadata,
				profile: profile || null,
			},
		});
	} catch (error) {
		console.error("Unexpected error in /me endpoint:", error);
		return c.json({ error: "Internal server error" }, 500);
	}
});

auth.put("/profile", authMiddleware, zValidator("json", updateProfileSchema), async (c) => {
	const user = c.get("user");
	const profileData = c.req.valid("json");

	try {
		const { data, error } = await supabase
			.from("user_profiles")
			.upsert({
				user_id: user.id,
				...profileData,
				updated_at: new Date().toISOString(),
			})
			.select()
			.single();

		if (error) {
			if (error.code === "PGRST101") {
				return c.json(
					{
						error: "Profile table not set up. Please run the database setup first.",
					},
					400
				);
			}

			console.error("Database error in /profile endpoint:", error);
			return c.json({ error: "Failed to update profile" }, 500);
		}

		return c.json({ profile: data });
	} catch (error) {
		console.error("Unexpected error in /profile endpoint:", error);
		return c.json({ error: "Internal server error" }, 500);
	}
});

auth.get("/onboarding", authMiddleware, async (c) => {
	const user = c.get("user");

	try {
		const { data: profile, error } = await supabase
			.from("user_profiles")
			.select(
				"onboarding_completed,onboarding_completed_at,onboarding_skipped_at,onboarding_preferences"
			)
			.eq("user_id", user.id)
			.maybeSingle();

		if (error) {
			if (error.code !== "PGRST101" && !isOnboardingProfileSchemaError(error)) {
				console.error("Database error in /onboarding endpoint:", error);
				return c.json({ error: "Failed to fetch onboarding" }, 500);
			}
		} else if (profile) {
			return c.json({ onboarding: profileRowToOnboardingState(profile) });
		}

		const onboarding = await loadOnboardingFromMemory(user.id);
		return c.json({ onboarding });
	} catch (error) {
		console.error("Unexpected error in GET /onboarding endpoint:", error);
		return c.json({ error: "Internal server error" }, 500);
	}
});

auth.put("/onboarding", authMiddleware, zValidator("json", onboardingSchema), async (c) => {
	const user = c.get("user");
	const onboardingData = c.req.valid("json");

	try {
		const now = new Date().toISOString();
		let onboardingPayload = buildOnboardingState(onboardingData, now);

		const { data: profileRow, error: profileLookupError } = await supabase
			.from("user_profiles")
			.select("user_id")
			.eq("user_id", user.id)
			.maybeSingle();

		if (profileLookupError && profileLookupError.code !== "PGRST101") {
			console.error(
				"Database error while checking onboarding profile row:",
				profileLookupError
			);
			return c.json({ error: "Failed to save onboarding" }, 500);
		}

		if (profileRow) {
			const { data, error } = await supabase
				.from("user_profiles")
				.update({
					onboarding_completed: onboardingPayload.completed,
					onboarding_completed_at: onboardingPayload.completed_at,
					onboarding_skipped_at: onboardingPayload.skipped_at,
					onboarding_preferences: onboardingPayload.preferences,
					updated_at: now,
				})
				.eq("user_id", user.id)
				.select(
					"onboarding_completed,onboarding_completed_at,onboarding_skipped_at,onboarding_preferences"
				)
				.single();

			if (error) {
				if (!isOnboardingProfileSchemaError(error)) {
					console.error("Database error in PUT /onboarding endpoint:", error);
					return c.json({ error: "Failed to save onboarding" }, 500);
				}
			} else {
				onboardingPayload = profileRowToOnboardingState(data);
			}
		}

		try {
			await LongTermMemory.setPreferences(user.id, {
				onboarding_status: {
					completed: onboardingPayload.completed,
					completedAt: onboardingPayload.completed_at,
					skippedAt: onboardingPayload.skipped_at,
				},
				onboarding_preferences: onboardingPayload.preferences,
			});
		} catch (error) {
			console.error("Failed to save onboarding to agent_memory:", error);
		}

		return c.json({ onboarding: onboardingPayload });
	} catch (error) {
		console.error("Unexpected error in PUT /onboarding endpoint:", error);
		return c.json({ error: "Internal server error" }, 500);
	}
});

auth.post("/verify", async (c) => {
	const authHeader = c.req.header("Authorization");

	if (!authHeader || !authHeader.startsWith("Bearer ")) {
		return c.json({ error: "Missing authorization header" }, 401);
	}

	const token = authHeader.substring(7);

	try {
		const {
			data: { user },
			error,
		} = await supabaseAuth.auth.getUser(token);

		if (error || !user) {
			return c.json({ error: "Invalid token" }, 401);
		}

		return c.json({
			valid: true,
			user: {
				id: user.id,
				email: user.email,
				...user.user_metadata,
			},
		});
	} catch (error) {
		return c.json({ error: "Token verification failed" }, 401);
	}
});

auth.get("/health", (c) => {
	return c.json({ status: "ok", service: "auth" });
});

export default auth;
