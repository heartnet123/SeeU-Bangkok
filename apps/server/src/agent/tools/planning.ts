import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { traceable } from "langsmith/traceable";
import { build_route as buildRouteImpl } from "@/lib/tools";
import {
	CandidatePlaceSchema,
	LocationSchema,
	PlanningConstraintsSchema,
	type CandidatePlace,
	type PlanningConstraints,
	type TripDraft,
} from "../state";
import {
	buildTripDraftFromRoute,
	buildTripDraftFromCandidates,
	extractPlanningConstraints,
	selectTripCandidates,
} from "../domain/planning";

interface BuildRouteParams {
	places: CandidatePlace[];
	origin?: { lat: number; lng: number };
}

export const build_route = traceable(
	async ({ places, origin }: BuildRouteParams) => {
		const routePlaces = places
			.filter(
				(place) =>
					typeof place.lat === "number" && typeof place.lng === "number"
			)
			.map((place) => ({
				id: place.id,
				name: place.name,
				slug: place.slug,
				lat: place.lat,
				lng: place.lng,
				tags: place.tags || [],
				price: place.price,
				image_url: place.image_url || "",
			}));

		return buildRouteImpl({ places: routePlaces, origin });
	},
	{ name: "tools.build_route", run_type: "tool" }
);

interface PlanTripDraftParams {
	places: CandidatePlace[];
	constraints: PlanningConstraints;
	origin?: { lat: number; lng: number };
	title?: string;
	summary?: string;
	userQuery?: string;
}

export const plan_itinerary = traceable(
	async ({
		places,
		constraints,
		origin,
		title,
		summary,
		userQuery,
	}: PlanTripDraftParams): Promise<TripDraft> => {
		const mergedConstraints = PlanningConstraintsSchema.parse({
			...constraints,
			...(userQuery
				? extractPlanningConstraints(userQuery, {
					userLocation: constraints.locationBias?.origin || origin,
				})
				: {}),
			...constraints,
		});

		const planningOrigin =
			mergedConstraints.locationBias?.mode === "near_user"
				? mergedConstraints.locationBias.origin || origin
				: origin;

		const selectedCandidates = selectTripCandidates(
			places,
			mergedConstraints,
			planningOrigin
		);

		const routeEligibleCandidates = selectedCandidates.filter(
			(place) =>
				typeof place.lat === "number" && typeof place.lng === "number"
		);

		if (routeEligibleCandidates.length < 2) {
			return buildTripDraftFromCandidates({
				title,
				summary,
				candidates: selectedCandidates,
				constraints: mergedConstraints,
				origin: planningOrigin,
			});
		}

		const route = await build_route({
			places: routeEligibleCandidates,
			origin: planningOrigin,
		});

		if (route.order.length === 0) {
			return buildTripDraftFromCandidates({
				title,
				summary,
				candidates: selectedCandidates,
				constraints: mergedConstraints,
				origin: planningOrigin,
			});
		}

		return buildTripDraftFromRoute({
			title,
			summary,
			candidates: routeEligibleCandidates,
			constraints: mergedConstraints,
			route,
		});
	},
	{ name: "tools.plan_itinerary", run_type: "tool" }
);

const candidatePlacesField = z.array(CandidatePlaceSchema).min(1);

export const buildRouteTool = tool(
	async (input) => {
		const result = await build_route({ places: input.places, origin: input.origin });
		return JSON.stringify(result);
	},
	{
		name: "build_route",
		description:
			"Build an optimized route through provided candidate places. Use exact place objects from previous agent output.",
		schema: z.object({
			places: candidatePlacesField.describe("Candidate places to route through"),
			origin: LocationSchema.optional().describe("Optional starting location"),
		}),
	}
);

export const planItineraryTool = tool(
	async (input) => {
		const result = await plan_itinerary({
			places: input.places,
			constraints: input.constraints,
			origin: input.origin,
			title: input.title,
			summary: input.summary,
			userQuery: input.userQuery,
		});
		return JSON.stringify(result);
	},
	{
		name: "plan_itinerary",
		description:
			"Build a canonical TripDraft from candidate places and normalized planning constraints. This is the source of truth for map preview and save actions.",
		schema: z.object({
			places: candidatePlacesField.describe("Candidate places selected for this trip"),
			constraints: PlanningConstraintsSchema.describe("Normalized planning constraints"),
			origin: LocationSchema.optional().describe("Optional user origin for local-first trips"),
			title: z.string().optional().describe("Optional title for the trip draft"),
			summary: z.string().optional().describe("Optional summary for the trip draft"),
			userQuery: z.string().optional().describe("Original user query for fallback constraint extraction"),
		}),
	}
);
