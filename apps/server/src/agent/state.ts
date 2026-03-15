import { z } from "zod";

export const MessageSchema = z.object({
	role: z.enum(["system", "user", "assistant", "tool"]),
	content: z.string(),
	name: z.string().optional(),
});

export type Message = z.infer<typeof MessageSchema>;

export const LocationSchema = z.object({
	lat: z.number(),
	lng: z.number(),
});

export type Location = z.infer<typeof LocationSchema>;

export const ToolCallSchema = z.object({
	tool: z.string(),
	args: z.unknown(),
	result: z.unknown().optional(),
});

export type ToolCall = z.infer<typeof ToolCallSchema>;

export const RetrievedDocSchema = z.object({
	content: z.string(),
	metadata: z.unknown(),
	score: z.number().optional(),
});

export type RetrievedDoc = z.infer<typeof RetrievedDocSchema>;

export const CandidatePlaceSchema = z.object({
	id: z.string(),
	name: z.string(),
	slug: z.string(),
	lat: z.number().optional(),
	lng: z.number().optional(),
	tags: z.array(z.string()).default([]),
	price: z.number().optional(),
	image_url: z.string().optional(),
	description: z.string().optional(),
	address: z.string().optional(),
}).strict();

export type CandidatePlace = z.infer<typeof CandidatePlaceSchema>;
export const PlaceSuggestionSchema = CandidatePlaceSchema;
export type PlaceSuggestion = CandidatePlace;

export const LocationBiasSchema = z.object({
	mode: z.enum(["none", "near_user", "near_area"]).default("none"),
	origin: LocationSchema.optional(),
	label: z.string().optional(),
}).strict();

export const PlanningConstraintsSchema = z.object({
	durationMinutes: z.number().int().positive().default(360),
	maxStops: z.number().int().min(1).max(8).default(4),
	budgetLevel: z.enum(["low", "medium", "high", "flexible"]).default("medium"),
	groupType: z.enum(["solo", "couple", "family", "group"]).default("solo"),
	themes: z.array(z.string()).default([]),
	locationBias: LocationBiasSchema.optional(),
}).strict();

export type PlanningConstraints = z.infer<typeof PlanningConstraintsSchema>;

export const TripValidationSchema = z.object({
	isValid: z.boolean(),
	score: z.number(),
	warnings: z.array(z.string()).default([]),
	suggestions: z.array(z.string()).default([]),
}).strict();

export type TripValidation = z.infer<typeof TripValidationSchema>;

export const TripDraftStopSchema = z.object({
	id: z.string(),
	place_id: z.string(),
	slug: z.string(),
	name: z.string(),
	lat: z.number().optional(),
	lng: z.number().optional(),
	suggested_time_min: z.number(),
	notes: z.string(),
	distance_from_prev_km: z.number(),
	travel_time_from_prev_min: z.number(),
}).strict();

export type TripDraftStop = z.infer<typeof TripDraftStopSchema>;

export const TripDraftSchema = z.object({
	title: z.string(),
	summary: z.string(),
	constraints: PlanningConstraintsSchema,
	places: z.array(CandidatePlaceSchema).default([]),
	stops: z.array(TripDraftStopSchema),
	total_distance_km: z.number(),
	total_minutes: z.number(),
	warnings: z.array(z.string()).default([]),
	validation: TripValidationSchema,
}).strict();

export type TripDraft = z.infer<typeof TripDraftSchema>;

// Backwards-compatible aliases for existing runtime consumers.
export const ItineraryStopSchema = TripDraftStopSchema;
export type ItineraryStop = TripDraftStop;
export const ItinerarySchema = TripDraftSchema;
export type Itinerary = TripDraft;

export const UiActionSchema = z.object({
	type: z.enum(["add_all_to_trip", "preview_itinerary", "save_trip_draft"]),
	label: z.string(),
}).strict();

export const UiResponsePayloadSchema = z.object({
	version: z.literal("1.0"),
	intent: z.enum(["chat", "place_recommendation", "itinerary"]),
	sessionId: z.string().optional(),
	summary: z.string(),
	places: z.array(CandidatePlaceSchema),
	tripDraft: TripDraftSchema.nullable(),
	actions: z.array(UiActionSchema),
	warnings: z.array(z.string()).default([]),
	raw_text: z.string(),
}).strict();

export type UiResponsePayload = z.infer<typeof UiResponsePayloadSchema>;

export const ResearcherAgentOutputSchema = z.object({
	intent: z.literal("place_recommendation"),
	summary: z.string(),
	places: z.array(CandidatePlaceSchema).default([]),
	planningConstraints: PlanningConstraintsSchema.optional(),
}).strict();

export const PlannerAgentOutputSchema = z.object({
	intent: z.literal("itinerary"),
	summary: z.string(),
	tripDraft: TripDraftSchema,
}).strict();

export type ResearcherAgentOutput = z.infer<typeof ResearcherAgentOutputSchema>;
export type PlannerAgentOutput = z.infer<typeof PlannerAgentOutputSchema>;

export const AgentStateSchema = z.object({
	messages: z.array(MessageSchema),
	userLocation: LocationSchema.optional(),
	sessionId: z.string().optional(),
	userId: z.string().optional(),
	currentAgent: z.string().optional(),
	agentHistory: z.array(z.string()).default([]),
	toolCalls: z.array(ToolCallSchema).default([]),
	retrievedDocs: z.array(RetrievedDocSchema).default([]),
	context: z.record(z.string(), z.unknown()).default({}),
	currentTripDraft: TripDraftSchema.optional(),
	planningConstraints: PlanningConstraintsSchema.optional(),
	finalResponse: z.string().optional(),
	error: z.string().optional(),
	userPreferences: z.record(z.string(), z.unknown()).default({}),
});

export type AgentState = z.infer<typeof AgentStateSchema>;

export function createInitialState(
	messages: Message[],
	options: {
		userLocation?: Location;
		sessionId?: string;
		userId?: string;
		userPreferences?: Record<string, unknown>;
		currentTripDraft?: TripDraft;
		planningConstraints?: PlanningConstraints;
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
		currentTripDraft: options.currentTripDraft,
		planningConstraints: options.planningConstraints,
		finalResponse: undefined,
		error: undefined,
		userPreferences: options.userPreferences || {},
	};
}
