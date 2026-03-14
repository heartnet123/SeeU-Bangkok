// Long-term memory - manages user preferences and persistent knowledge
import { supabase } from "@/lib/supabase";
import type { UserPreference } from "./index";

/**
 * Long-term Memory Manager
 * Handles persistent user preferences and learned knowledge
 */
export class LongTermMemory {
	/**
	 * Get a user preference by key
	 */
	static async getPreference(userId: string, key: string): Promise<any | null> {
		const { data, error } = await supabase
			.from("agent_memory")
			.select("value")
			.eq("user_id", userId)
			.eq("key", key)
			.single();

		if (error) {
			if (error.code === "PGRST116") {
				return null; // Not found
			}
			throw new Error(`Failed to get preference: ${error.message}`);
		}

		return data.value;
	}

	/**
	 * Set a user preference
	 */
	static async setPreference(
		userId: string,
		key: string,
		value: any
	): Promise<void> {
		const { error } = await supabase
			.from("agent_memory")
			.upsert(
				{
					user_id: userId,
					key,
					value,
				},
				{
					onConflict: "user_id,key",
				}
			);

		if (error) {
			throw new Error(`Failed to set preference: ${error.message}`);
		}
	}

	/**
	 * Delete a user preference
	 */
	static async deletePreference(userId: string, key: string): Promise<void> {
		const { error } = await supabase
			.from("agent_memory")
			.delete()
			.eq("user_id", userId)
			.eq("key", key);

		if (error) {
			throw new Error(`Failed to delete preference: ${error.message}`);
		}
	}

	/**
	 * Get all preferences for a user
	 */
	static async getAllPreferences(
		userId: string
	): Promise<Record<string, any>> {
		const { data, error } = await supabase
			.from("agent_memory")
			.select("key, value")
			.eq("user_id", userId);

		if (error) {
			throw new Error(`Failed to get preferences: ${error.message}`);
		}

		const preferences: Record<string, any> = {};
		for (const row of data) {
			preferences[row.key] = row.value;
		}

		return preferences;
	}

	/**
	 * Get specific preferences by keys
	 */
	static async getPreferences(
		userId: string,
		keys: string[]
	): Promise<Record<string, any>> {
		const { data, error } = await supabase
			.from("agent_memory")
			.select("key, value")
			.eq("user_id", userId)
			.in("key", keys);

		if (error) {
			throw new Error(`Failed to get preferences: ${error.message}`);
		}

		const preferences: Record<string, any> = {};
		for (const row of data) {
			preferences[row.key] = row.value;
		}

		return preferences;
	}

	/**
	 * Batch set multiple preferences
	 */
	static async setPreferences(
		userId: string,
		preferences: Record<string, any>
	): Promise<void> {
		const records = Object.entries(preferences).map(([key, value]) => ({
			user_id: userId,
			key,
			value,
		}));

		const { error } = await supabase
			.from("agent_memory")
			.upsert(records, { onConflict: "user_id,key" });

		if (error) {
			throw new Error(`Failed to set preferences: ${error.message}`);
		}
	}

	/**
	 * Clear all preferences for a user
	 */
	static async clearAllPreferences(userId: string): Promise<void> {
		const { error } = await supabase
			.from("agent_memory")
			.delete()
			.eq("user_id", userId);

		if (error) {
			throw new Error(`Failed to clear preferences: ${error.message}`);
		}
	}

	// Common preference keys for trip planning
	static readonly PREFERENCE_KEYS = {
		FAVORITE_PLACES: "favorite_places",
		TRAVEL_STYLE: "travel_style", // e.g., "relaxed", "adventurous", "cultural"
		BUDGET_PREFERENCE: "budget_preference", // e.g., "budget", "mid-range", "luxury"
		DIETARY_RESTRICTIONS: "dietary_restrictions",
		MOBILITY_REQUIREMENTS: "mobility_requirements",
		PREFERRED_TRANSPORT: "preferred_transport",
		INTERESTS: "interests", // e.g., ["temples", "food", "nightlife"]
		PREVIOUS_VISITS: "previous_visits", // places already visited
		LANGUAGE_PREFERENCE: "language_preference",
	} as const;
}
