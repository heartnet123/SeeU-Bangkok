// Tool exports - will be implemented in Wave 2
// Re-exports from lib/tools.ts
// export { search_places, nearby_places } from "./search";
// export { retrieveDocuments } from "./retrieval";
// export { build_route, plan_itinerary } from "./planning";
// export { validate_itinerary } from "./validation";

// Tool registry for LangGraph
export const TOOL_NAMES = {
	SEARCH_PLACES: "search_places",
	NEARBY_PLACES: "nearby_places",
	VECTOR_SEARCH: "vector_search",
	BUILD_ROUTE: "build_route",
	PLAN_ITINERARY: "plan_itinerary",
	VALIDATE_ITINERARY: "validate_itinerary",
} as const;
