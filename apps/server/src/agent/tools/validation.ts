// Validation tools - Itinerary validation for Critic agent
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { traceable } from "langsmith/traceable";
import { computeTripValidation } from "../domain/planning";
import { TripDraftSchema, type Itinerary } from "../state";

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
		const validation = computeTripValidation(itinerary);
		const stops = itinerary.stops || [];
		const totalStops = stops.length;
		const totalDistance = itinerary.total_distance_km || 0;
		const totalTime = itinerary.total_minutes || 0;
		const averageTimePerStop = totalStops > 0 ? totalTime / totalStops : 0;
		const maxDistanceBetweenStops = Math.max(
			0,
			...stops.map((stop) => stop.distance_from_prev_km || 0)
		);

		return {
			isValid: validation.isValid,
			score: validation.score,
			warnings: validation.warnings,
			suggestions: validation.suggestions,
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
			"Validate a trip draft for feasibility, checking timing, distances, and providing improvement suggestions.",
		schema: z.object({
			itinerary: TripDraftSchema,
		}),
	}
);
