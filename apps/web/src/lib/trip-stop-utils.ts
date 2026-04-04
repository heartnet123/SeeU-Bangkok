import type { Trip, TripStop } from "@/types/trip";

export interface TripPlaceCandidate {
	id: string;
	name: string;
	slug: string;
	lat?: number;
	lng?: number;
	tags?: string[];
	description?: string;
}

export type AppendPlaceToTripResult =
	| {
			status: "missing-trip" | "missing-location" | "duplicate";
			trips: Trip[];
			tripName?: string;
			addedStop?: undefined;
	  }
	| {
			status: "added";
			trips: Trip[];
			tripName: string;
			addedStop: TripStop;
	  };

function mapPlaceCategory(tag?: string): TripStop["category"] {
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

function isDuplicateStop(stop: TripStop, place: TripPlaceCandidate): boolean {
	if (stop.placeId && place.id && stop.placeId === place.id) {
		return true;
	}

	if (place.slug) {
		const stopAddress = stop.address.trim().toLowerCase();
		if (stopAddress.length > 0 && stopAddress === place.slug.trim().toLowerCase()) {
			return true;
		}
	}

	return stop.name.trim().toLowerCase() === place.name.trim().toLowerCase();
}

export function appendPlaceToTrip({
	trips,
	selectedTripId,
	place,
}: {
	trips: Trip[];
	selectedTripId: string | null;
	place: TripPlaceCandidate;
}): AppendPlaceToTripResult {
	if (!selectedTripId) {
		return { status: "missing-trip", trips };
	}

	if (typeof place.lat !== "number" || typeof place.lng !== "number") {
		return { status: "missing-location", trips };
	}

	const targetTrip = trips.find((trip) => trip.id === selectedTripId);
	if (!targetTrip) {
		return { status: "missing-trip", trips };
	}

	if (targetTrip.stops.some((stop) => isDuplicateStop(stop, place))) {
		return { status: "duplicate", trips, tripName: targetTrip.name };
	}

	const addedStop: TripStop = {
		id: `stop-${Date.now()}`,
		placeId: place.id,
		name: place.name,
		address: place.slug || "Address not available",
		category: mapPlaceCategory(place.tags?.[0]),
		suggestedDurationMin: 60,
		lat: place.lat,
		lng: place.lng,
		notes: place.description,
	};

	const updatedTrips = trips.map((trip) => {
		if (trip.id !== selectedTripId) {
			return trip;
		}

		const stops = [...trip.stops, addedStop];
		return {
			...trip,
			stops,
			totalDurationMin: stops.reduce(
				(sum, stop) => sum + stop.suggestedDurationMin,
				0
			),
		};
	});

	return {
		status: "added",
		trips: updatedTrips,
		tripName: targetTrip.name,
		addedStop,
	};
}
