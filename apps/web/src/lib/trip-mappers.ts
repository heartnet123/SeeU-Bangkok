import type { TripDraft } from "@/components/planner/chat/types";
import type { Trip, TripStop } from "@/types/trip";

type TripCategory = TripStop["category"];

interface ServerPlace {
	id?: string;
	name?: string;
	lat?: number;
	lng?: number;
	tags?: string[];
}

interface ServerStop {
	id?: string;
	place_id?: string;
	suggested_time_min?: number;
	distance_from_prev_km?: number;
	notes?: string;
	place?: ServerPlace;
}

interface ServerTrip {
	id: string;
	title?: string;
	total_minutes?: number;
	total_distance_km?: number;
	created_at?: string;
	stops?: ServerStop[];
}

interface SavedTripRef {
	id: string;
	title?: string;
	created_at?: string;
}

function mapCategory(tag?: string): TripCategory {
	switch (tag?.toLowerCase()) {
		case "temple":
			return "Temple";
		case "cafe":
			return "Cafe";
		case "restaurant":
			return "Restaurant";
		case "shopping":
			return "Shopping";
		default:
			return "Viewpoint";
	}
}

export function mapServerTripToTrip(trip: ServerTrip): Trip {
	return {
		id: trip.id,
		name: trip.title || "Unnamed Trip",
		date: trip.created_at ? new Date(trip.created_at).toLocaleDateString() : "No date",
		stops: (trip.stops || []).map((stop) => ({
			id: stop.id || stop.place_id || crypto.randomUUID(),
			placeId: stop.place_id || stop.place?.id,
			name: stop.place?.name || "Unknown Stop",
			address: stop.place?.name || "Address unknown",
			category: mapCategory(stop.place?.tags?.[0]),
			suggestedDurationMin: stop.suggested_time_min || 60,
			lat: stop.place?.lat || 0,
			lng: stop.place?.lng || 0,
			notes: stop.notes || "",
			distanceFromPrevKm: stop.distance_from_prev_km || 0,
		})),
		totalDurationMin: trip.total_minutes || 0,
		totalDistanceKm: trip.total_distance_km || 0,
		estimatedBudget: 0,
		notes: "",
		source: "saved",
	};
}

export function mapSavedTripFromDraft({
	tripDraft,
	savedTrip,
}: {
	tripDraft: TripDraft;
	savedTrip: SavedTripRef;
}): Trip {
	return {
		id: savedTrip.id,
		name: savedTrip.title || tripDraft.title,
		date: savedTrip.created_at ? new Date(savedTrip.created_at).toLocaleDateString() : "No date",
		stops: tripDraft.stops.map((stop) => {
			const place = tripDraft.places.find((item) => item.id === stop.place_id);

			return {
				id: stop.id,
				placeId: stop.place_id,
				name: stop.name,
				address: place?.name || stop.slug || stop.name,
				category: mapCategory(place?.tags?.[0]),
				suggestedDurationMin: stop.suggested_time_min || 60,
				lat: stop.lat || place?.lat || 0,
				lng: stop.lng || place?.lng || 0,
				notes: stop.notes || "",
				distanceFromPrevKm: stop.distance_from_prev_km || 0,
			};
		}),
		totalDurationMin: tripDraft.total_minutes || 0,
		totalDistanceKm: tripDraft.total_distance_km || 0,
		estimatedBudget: 0,
		notes: tripDraft.summary || "",
		source: "saved",
		warnings: tripDraft.warnings,
	};
}
