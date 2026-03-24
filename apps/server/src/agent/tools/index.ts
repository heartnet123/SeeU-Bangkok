// Tool exports for the agent module
// Re-exports LangGraph-compatible tools from each module

export {
	searchPlacesTool,
	nearbyPlacesTool,
	search_places,
	nearby_places,
} from "./search";

export {
	vectorSearchTool,
	retrieveDocuments,
} from "./retrieval";

export {
	buildRouteTool,
	planItineraryTool,
	build_route,
	plan_itinerary,
} from "./planning";

export {
	validateItineraryTool,
	validateItineraryImpl,
	type ValidationResult,
} from "./validation";

// Tool registry for easy access
import { searchPlacesTool, nearbyPlacesTool } from "./search";
import { vectorSearchTool } from "./retrieval";
import { buildRouteTool, planItineraryTool } from "./planning";
import { validateItineraryTool } from "./validation";

// All tools grouped by agent specialty
export const RESEARCHER_TOOLS: [
	typeof searchPlacesTool,
	typeof nearbyPlacesTool,
	typeof vectorSearchTool,
] = [
	searchPlacesTool,
	nearbyPlacesTool,
	vectorSearchTool,
];

export const PLANNER_TOOLS: [
	typeof buildRouteTool,
	typeof planItineraryTool,
] = [
	buildRouteTool,
	planItineraryTool,
];

export const CRITIC_TOOLS: [typeof validateItineraryTool] = [
	validateItineraryTool,
];

// All tools combined
export const ALL_TOOLS: Array<
	| typeof searchPlacesTool
	| typeof nearbyPlacesTool
	| typeof vectorSearchTool
	| typeof buildRouteTool
	| typeof planItineraryTool
	| typeof validateItineraryTool
> = [
	...RESEARCHER_TOOLS,
	...PLANNER_TOOLS,
	...CRITIC_TOOLS,
];

// Tool names enum
export const TOOL_NAMES = {
	SEARCH_PLACES: "search_places",
	NEARBY_PLACES: "nearby_places",
	VECTOR_SEARCH: "vector_search",
	BUILD_ROUTE: "build_route",
	PLAN_ITINERARY: "plan_itinerary",
	VALIDATE_ITINERARY: "validate_itinerary",
} as const;

export type ToolName = (typeof TOOL_NAMES)[keyof typeof TOOL_NAMES];
