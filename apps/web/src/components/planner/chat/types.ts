export interface PlaceItem {
	id: string;
	name: string;
	slug: string;
	lat?: number;
	lng?: number;
	tags?: string[];
	price?: number;
	image_url?: string;
	description?: string;
}

export interface PlanningConstraints {
	durationMinutes: number;
	maxStops: number;
	budgetLevel: "low" | "medium" | "high" | "flexible";
	groupType: "solo" | "couple" | "family" | "group";
	themes: string[];
	locationBias?: {
		mode: "none" | "near_user" | "near_area";
		origin?: { lat: number; lng: number };
		label?: string;
	};
}

export interface TripValidation {
	isValid: boolean;
	score: number;
	warnings: string[];
	suggestions: string[];
}

export interface TripDraftStop {
	id: string;
	place_id: string;
	slug: string;
	name: string;
	lat?: number;
	lng?: number;
	suggested_time_min: number;
	travel_time_from_prev_min: number;
	distance_from_prev_km: number;
	notes: string;
}

export interface TripDraft {
	title: string;
	summary: string;
	constraints: PlanningConstraints;
	places: PlaceItem[];
	stops: TripDraftStop[];
	total_distance_km: number;
	total_minutes: number;
	warnings: string[];
	validation: TripValidation;
}

export type WorkflowStepType =
	| "planner"
	| "search"
	| "retrieve"
	| "reasoning"
	| "route"
	| "location";

export interface WorkflowStepData {
	type: WorkflowStepType | string;
	label: string;
	badges?: string[];
	status: "complete" | "loading" | "pending";
}

export interface UserTurn {
	role: "user";
	text: string;
	id: string;
}

export interface AssistantTurn {
	role: "assistant";
	text: string;
	workflowSteps: WorkflowStepData[];
	latency?: number;
	suggestions: PlaceItem[];
	tripDraft: TripDraft | null;
	errors: string[];
	ui?: UiResponsePayload;
	id: string;
}

export type Turn = UserTurn | AssistantTurn;

export interface UiResponsePayload {
	version: "1.0";
	intent: "chat" | "place_recommendation" | "itinerary";
	sessionId?: string;
	summary: string;
	places: PlaceItem[];
	tripDraft: TripDraft | null;
	actions: Array<{ type: string; label: string }>;
	warnings: string[];
	raw_text: string;
}

export interface PendingTurn {
	workflowSteps: WorkflowStepData[];
	text: string;
	suggestions: PlaceItem[];
	tripDraft: TripDraft | null;
	errors: string[];
	ui?: UiResponsePayload;
}

export interface ParsedPlace {
	name: string;
	description: string;
	lat?: number;
	lng?: number;
}

export interface ParsedItinerary {
	title: string;
	stops: Array<{
		name: string;
		suggested_time_min: number;
		distance_from_prev_km: number;
		notes: string;
		lat?: number;
		lng?: number;
	}>;
	total_distance_km: number;
	total_minutes: number;
}

export interface ChatPanelProps {
	onPlacesFound?: (places: PlaceItem[]) => void;
	onAddPlaceToTrip?: (place: PlaceItem) => void;
	onTripDraftCreated?: (tripDraft: TripDraft) => void;
	onPreviewTripDraft?: (tripDraft: TripDraft) => void;
	userLocation?: { lat: number; lng: number };
	defaultOpen?: boolean;
	sessionId?: string | null;
	authToken?: string;
	onSessionCreated?: (id: string | null) => void;
	sessionMessages?: Array<{ role: string; content: string }> | null;
	contextPlaces?: Array<{ id: string; name: string; slug?: string; tags?: string[] }>;
}
