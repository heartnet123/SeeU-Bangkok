// Planning tools - Route building and itinerary planning
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { traceable } from "langsmith/traceable";
import {
	build_route as buildRouteImpl,
	plan_itinerary as planItineraryImpl,
	haversineKm,
	type PlaceItem,
} from "@/lib/tools";
import { supabase } from "@/lib/supabase";

// Build route tool for LangGraph
export const buildRouteTool = tool(
	async (input) => {
		// First fetch the places by slugs/IDs
		const { data: places, error } = await supabase
			.from("bangkok_unseen")
			.select("*")
			.in("id", input.place_slugs);

		if (error || !places) {
			return JSON.stringify({ error: "Failed to fetch places" });
		}

		const placeItems: PlaceItem[] = places.map((p) => ({
			id: p.id,
			name: p.name,
			slug: p.id,
			lat: p.lat,
			lng: p.lng,
			tags: p.tags || [],
			price: p.price,
			image_url: p.image_url || "",
		}));

		const result = await buildRouteImpl({ places: placeItems, origin: input.origin });
		return JSON.stringify(result);
	},
	{
		name: "build_route",
		description:
			"Build an optimized route through multiple places using nearest-neighbor algorithm. Returns the optimal order to visit places and total distance.",
		schema: z.object({
			place_slugs: z
				.array(z.string())
				.describe("Array of place IDs to route through"),
			origin: z
				.object({
					lat: z.number(),
					lng: z.number(),
				})
				.optional()
				.describe("Optional starting location"),
		}),
	}
);

// Plan itinerary tool for LangGraph
export const planItineraryTool = tool(
	async (input) => {
		const result = await planItineraryImpl({
			place_slugs: input.place_slugs,
			title: input.title,
		});
		return JSON.stringify(result);
	},
	{
		name: "plan_itinerary",
		description:
			"Plan a complete itinerary by building an optimized route through selected places. Returns a structured itinerary with stops, timing, and distances.",
		schema: z.object({
			place_slugs: z
				.array(z.string())
				.describe("Array of place IDs to include in the itinerary"),
			title: z
				.string()
				.optional()
				.default("Suggested Trip")
				.describe("Title for the itinerary"),
		}),
	}
);

// Re-export implementations and utilities
export { buildRouteImpl as build_route, planItineraryImpl as plan_itinerary, haversineKm };
