"use client";
import { useState } from "react";
import { TripListColumn } from "@/components/planner/TripListColumn";
import { MapDetailsColumn } from "@/components/planner/MapDetailsColumn";
import { ItineraryColumn } from "@/components/planner/ItineraryColumn";
import type { Trip } from "@/components/planner/mock-data";
import { mockTrips } from "@/components/planner/mock-data";
export default function TripPlannerPage() {
  const [trips, setTrips] = useState<Trip[]>(mockTrips);
  const [selectedTripId, setSelectedTripId] = useState<string | null>(mockTrips[0]?.id || null);

  const selectedTrip = trips.find((t) => t.id === selectedTripId) || null;

  return (
    <div className="bg-gray-50 min-h-screen p-4 md:p-6">
      <div className="w-full max-w-[1920px] mx-auto h-[calc(100vh-3rem)] grid grid-cols-1 lg:grid-cols-[350px_1fr_400px] gap-6">
        {/* Trip List */}
        <TripListColumn 
            trips={trips} 
            selectedTripId={selectedTripId}
            onSelectTrip={setSelectedTripId}
        />

        {/* Map & Details */}
        <MapDetailsColumn trip={selectedTrip} />

        {/* Itinerary */}
        <ItineraryColumn trip={selectedTrip} />
      </div>
    </div>
  );
}