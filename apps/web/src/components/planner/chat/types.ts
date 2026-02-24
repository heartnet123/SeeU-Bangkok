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
	itinerary: unknown;
	errors: string[];
	id: string;
}

export type Turn = UserTurn | AssistantTurn;

export interface PendingTurn {
	workflowSteps: WorkflowStepData[];
	text: string;
	suggestions: PlaceItem[];
	itinerary: unknown;
	errors: string[];
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
	}>;
	total_distance_km: number;
	total_minutes: number;
}

export interface ChatPanelProps {
	onPlacesFound?: (places: PlaceItem[]) => void;
	onAddPlaceToTrip?: (place: PlaceItem) => void;
	onItineraryCreated?: (itinerary: unknown) => void;
	onPreviewItinerary?: (itinerary: any) => void;
	userLocation?: { lat: number; lng: number };
	defaultOpen?: boolean;
}
