// Search tools - Re-exports from lib/tools.ts with LangGraph tool wrappers
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import {
	search_places as searchPlacesImpl,
	nearby_places as nearbyPlacesImpl,
} from "@/lib/tools";

// Search places tool for LangGraph
export const searchPlacesTool = tool(
	async (input) => {
		const results = await searchPlacesImpl({
			query: input.query,
			categories: input.categories,
			limit: input.limit,
		});
		return JSON.stringify(results);
	},
	{
		name: "search_places",
		description:
			"Search for places only within the Rattanakosin area by name, description, or categories. Returns empty results for out-of-scope areas.",
		schema: z.object({
			query: z.string().describe("Search query text"),
			categories: z
				.array(z.string())
				.optional()
				.describe("Optional categories to filter by (e.g., 'temple', 'restaurant', 'market')"),
			limit: z
				.number()
				.optional()
				.default(10)
				.describe("Maximum number of results to return"),
		}),
	}
);

// Nearby places tool for LangGraph
export const nearbyPlacesTool = tool(
	async (input) => {
		const results = await nearbyPlacesImpl({
			location: input.location,
			radius_km: input.radius_km,
			limit: input.limit,
		});
		return JSON.stringify(results);
	},
	{
		name: "nearby_places",
		description:
			"Find places near a specific location only within the Rattanakosin area. Useful for 'near me' requests when the location is inside the supported area.",
		schema: z.object({
			location: z
				.object({
					lat: z.number(),
					lng: z.number(),
				})
				.describe("Center location coordinates"),
			radius_km: z
				.number()
				.optional()
				.default(5)
				.describe("Search radius in kilometers"),
			limit: z
				.number()
				.optional()
				.default(10)
				.describe("Maximum number of results to return"),
		}),
	}
);

// Re-export the raw implementations for direct use
export { searchPlacesImpl as search_places, nearbyPlacesImpl as nearby_places };
