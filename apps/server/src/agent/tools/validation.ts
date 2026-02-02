// Validation tools - Itinerary validation for Critic agent
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { traceable } from "langsmith/traceable";
import { haversineKm } from "@/lib/tools";
import type { Itinerary, ItineraryStop } from "../state";

// Validation result type
export interface ValidationResult {
	isValid: boolean;
	score: number; // 0-100
	warnings: string[];
	suggestions: string[];
	details: {
		totalStops: number;
		totalDistance: number;
		totalTime: number;
		averageTimePerStop: number;
		maxDistanceBetweenStops: number;
	};
}

// Validate itinerary implementation
export const validateItineraryImpl = traceable(
	async (itinerary: Itinerary): Promise<ValidationResult> => {
		const warnings: string[] = [];
		const suggestions: string[] = [];
		let score = 100;

		const stops = itinerary.stops || [];
		const totalStops = stops.length;
		const totalDistance = itinerary.total_distance_km || 0;
		const totalTime = itinerary.total_minutes || 0;

		// Calculate average time per stop
		const averageTimePerStop = totalStops > 0 ? totalTime / totalStops : 0;

		// Find max distance between consecutive stops
		let maxDistanceBetweenStops = 0;
		for (let i = 1; i < stops.length; i++) {
			const prev = stops[i - 1];
			const curr = stops[i];
			if (prev.lat && prev.lng && curr.lat && curr.lng) {
				const dist = haversineKm(
					{ lat: prev.lat, lng: prev.lng },
					{ lat: curr.lat, lng: curr.lng }
				);
				maxDistanceBetweenStops = Math.max(maxDistanceBetweenStops, dist);
			}
		}

		// Validation rules

		// Rule 1: Check if there are enough stops
		if (totalStops < 2) {
			warnings.push("Itinerary has fewer than 2 stops");
			suggestions.push("Consider adding more places to make the trip worthwhile");
			score -= 20;
		}

		// Rule 2: Check if too many stops for a day trip
		if (totalStops > 8) {
			warnings.push(`${totalStops} stops may be too many for a single day`);
			suggestions.push("Consider splitting into multiple days or removing some stops");
			score -= 10;
		}

		// Rule 3: Check time allocation
		if (averageTimePerStop < 30 && totalStops > 0) {
			warnings.push("Average time per stop is less than 30 minutes");
			suggestions.push("Consider allocating more time for each location");
			score -= 15;
		}

		// Rule 4: Check if any leg is too long
		if (maxDistanceBetweenStops > 10) {
			warnings.push(
				`One segment is ${maxDistanceBetweenStops.toFixed(1)}km - quite far apart`
			);
			suggestions.push("Consider adding stops between distant locations or reordering");
			score -= 10;
		}

		// Rule 5: Check total distance
		if (totalDistance > 50) {
			warnings.push(`Total distance of ${totalDistance}km is quite long`);
			suggestions.push("Consider reducing the number of stops or focusing on one area");
			score -= 15;
		}

		// Rule 6: Check total time
		if (totalTime > 600) {
			// More than 10 hours
			warnings.push(`Total time of ${Math.round(totalTime / 60)} hours is very long`);
			suggestions.push("This might be exhausting - consider a more relaxed pace");
			score -= 10;
		}

		// Rule 7: Check for missing coordinates
		const stopsWithoutCoords = stops.filter((s) => !s.lat || !s.lng);
		if (stopsWithoutCoords.length > 0) {
			warnings.push(
				`${stopsWithoutCoords.length} stop(s) are missing location data`
			);
			score -= 5 * stopsWithoutCoords.length;
		}

		// Ensure score doesn't go below 0
		score = Math.max(0, score);

		return {
			isValid: score >= 50,
			score,
			warnings,
			suggestions,
			details: {
				totalStops,
				totalDistance,
				totalTime,
				averageTimePerStop,
				maxDistanceBetweenStops,
			},
		};
	},
	{ name: "tools.validate_itinerary", run_type: "tool" }
);

// Validate itinerary tool for LangGraph
export const validateItineraryTool = tool(
	async (input) => {
		const result = await validateItineraryImpl(input.itinerary);
		return JSON.stringify(result);
	},
	{
		name: "validate_itinerary",
		description:
			"Validate an itinerary for feasibility, checking timing, distances, and providing improvement suggestions. Use this to ensure quality before presenting to user.",
		schema: z.object({
			itinerary: z.object({
				title: z.string(),
				stops: z.array(
					z.object({
						slug: z.string(),
						name: z.string(),
						lat: z.number().optional(),
						lng: z.number().optional(),
						suggested_time_min: z.number(),
						notes: z.string(),
						distance_from_prev_km: z.number(),
					})
				),
				total_distance_km: z.number(),
				total_minutes: z.number(),
			}),
		}),
	}
);
