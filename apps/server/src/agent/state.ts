import { z } from "zod";

// Message schema
export const MessageSchema = z.object({
	role: z.enum(["system", "user", "assistant", "tool"]),
	content: z.string(),
	name: z.string().optional(),
});

export type Message = z.infer<typeof MessageSchema>;

// Location schema
export const LocationSchema = z.object({
	lat: z.number(),
	lng: z.number(),
});

export type Location = z.infer<typeof LocationSchema>;

// Tool call schema
export const ToolCallSchema = z.object({
	tool: z.string(),
	args: z.any(),
	result: z.any().optional(),
});

export type ToolCall = z.infer<typeof ToolCallSchema>;

// Retrieved document schema
export const RetrievedDocSchema = z.object({
	content: z.string(),
	metadata: z.any(),
	score: z.number().optional(),
});

export type RetrievedDoc = z.infer<typeof RetrievedDocSchema>;

// Itinerary stop schema
export const ItineraryStopSchema = z.object({
	slug: z.string(),
	name: z.string(),
	lat: z.number().optional(),
	lng: z.number().optional(),
	suggested_time_min: z.number(),
	notes: z.string(),
	distance_from_prev_km: z.number(),
	travel_time_from_prev_min: z.number(),
}).strict();

export type ItineraryStop = z.infer<typeof ItineraryStopSchema>;

// Itinerary schema
export const ItinerarySchema = z.object({
	title: z.string(),
	stops: z.array(ItineraryStopSchema),
	total_distance_km: z.number(),
	total_minutes: z.number(),
	validation: z
		.object({
			isValid: z.boolean(),
			warnings: z.array(z.string()),
			suggestions: z.array(z.string()),
		})
		.optional(),
}).strict();

export type Itinerary = z.infer<typeof ItinerarySchema>;

// Place suggestion schema for UI payloads
export const PlaceSuggestionSchema = z.object({
	id: z.string(),
	name: z.string(),
	slug: z.string().optional().default(""),
	lat: z.number().optional(),
	lng: z.number().optional(),
	tags: z.array(z.string()).optional().default([]),
	price: z.number().optional(),
	image_url: z.string().optional(),
	description: z.string().optional(),
}).strict();

export type PlaceSuggestion = z.infer<typeof PlaceSuggestionSchema>;

export const UiActionSchema = z.object({
	type: z.enum(["add_all_to_trip", "preview_itinerary"]),
	label: z.string(),
}).strict();

export const UiResponsePayloadSchema = z.object({
	version: z.literal("1.0"),
	intent: z.enum(["chat", "place_recommendation", "itinerary"]),
	summary: z.string(),
	places: z.array(PlaceSuggestionSchema),
	itinerary: ItinerarySchema.nullable(),
	actions: z.array(UiActionSchema),
	raw_text: z.string(),
}).strict();

export type UiResponsePayload = z.infer<typeof UiResponsePayloadSchema>;

// Structured agent outputs expected from LLM messages
export const ResearcherAgentOutputSchema = z.object({
	intent: z.literal("place_recommendation"),
	summary: z.string(),
	places: z.array(PlaceSuggestionSchema).default([]),
}).strict();

export const PlannerAgentOutputSchema = z.object({
	intent: z.literal("itinerary"),
	summary: z.string(),
	itinerary: ItinerarySchema,
}).strict();

export type ResearcherAgentOutput = z.infer<typeof ResearcherAgentOutputSchema>;
export type PlannerAgentOutput = z.infer<typeof PlannerAgentOutputSchema>;

// Main Agent State schema for LangGraph
export const AgentStateSchema = z.object({
	// Core conversation
	messages: z.array(MessageSchema),
	userLocation: LocationSchema.optional(),
	sessionId: z.string().optional(),
	userId: z.string().optional(),

	// Agent routing
	currentAgent: z.string().optional(),
	agentHistory: z.array(z.string()).default([]),

	// Tool execution
	toolCalls: z.array(ToolCallSchema).default([]),

	// RAG context
	retrievedDocs: z.array(RetrievedDocSchema).default([]),
	context: z.record(z.string(), z.any()).default({}),

	// Output
	itinerary: ItinerarySchema.optional(),
	finalResponse: z.string().optional(),

	// Error handling
	error: z.string().optional(),

	// Memory
	userPreferences: z.record(z.string(), z.any()).default({}),
});

export type AgentState = z.infer<typeof AgentStateSchema>;

// Initial state factory
export function createInitialState(
	messages: Message[],
	options: {
		userLocation?: Location;
		sessionId?: string;
		userId?: string;
		userPreferences?: Record<string, any>;
	} = {}
): AgentState {
	return {
		messages,
		userLocation: options.userLocation,
		sessionId: options.sessionId,
		userId: options.userId,
		currentAgent: undefined,
		agentHistory: [],
		toolCalls: [],
		retrievedDocs: [],
		context: {},
		itinerary: undefined,
		finalResponse: undefined,
		error: undefined,
		userPreferences: options.userPreferences || {},
	};
}
