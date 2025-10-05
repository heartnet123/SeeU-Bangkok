"use client";
import { useState, useEffect } from "react";
import { TripListColumn } from "@/components/planner/TripListColumn";
import { MapDetailsColumn } from "@/components/planner/MapDetailsColumn";
import { ItineraryColumn } from "@/components/planner/ItineraryColumn";
import { ChatPanel } from "@/components/planner/ChatPanel";
import type { Trip, TripStop } from "@/components/planner/mock-data";
import { mockTrips } from "@/components/planner/mock-data";
import { toast } from "sonner";

interface PlaceItem {
  id: string;
  name: string;
  slug: string;
  lat?: number;
  lng?: number;
  tags?: string[];
  price?: number;
}

export default function TripPlannerPage() {
  const [trips, setTrips] = useState<Trip[]>(mockTrips);
  const [selectedTripId, setSelectedTripId] = useState<string | null>(mockTrips[0]?.id || null);
  const [isLoading, setIsLoading] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | undefined>();
  const [foundPlaces, setFoundPlaces] = useState<PlaceItem[]>([]);

  const selectedTrip = trips.find((t) => t.id === selectedTripId) || null;

  // Get user location on mount
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        () => {
          // Silently fail - location is optional
        },
        { enableHighAccuracy: true, maximumAge: 30_000, timeout: 10_000 }
      );
    }
  }, []);

  const handlePlacesFound = (places: PlaceItem[]) => {
    setFoundPlaces(places);
    console.log("Found places from chat:", places);
  };

  const handleAddPlaceToTrip = (place: PlaceItem) => {
    if (!selectedTripId) {
      toast.error("Please select a trip first");
      return;
    }

    // Check if place has required location data
    if (!place.lat || !place.lng) {
      toast.error("This place doesn't have location data");
      return;
    }

    // Convert PlaceItem to TripStop
    const newStop: TripStop = {
      id: `stop-${Date.now()}`,
      name: place.name,
      address: place.slug || "Address not available",
      category: (place.tags?.[0] as any) || "Shopping", // Default category
      suggestedDurationMin: 60, // Default 1 hour
      lat: place.lat,
      lng: place.lng,
    };

    // Add stop to selected trip
    setTrips((prevTrips) =>
      prevTrips.map((trip) => {
        if (trip.id === selectedTripId) {
          // Check if place already exists in trip
          if (trip.stops.some((stop) => stop.name === place.name)) {
            toast.info(`${place.name} is already in this trip`);
            return trip;
          }

          const updatedStops = [...trip.stops, newStop];
          
          // Recalculate trip duration (simplified)
          const newDuration = updatedStops.reduce((sum, stop) => sum + stop.suggestedDurationMin, 0);
          
          toast.success(`Added ${place.name} to ${trip.name}`);
          
          return {
            ...trip,
            stops: updatedStops,
            totalDurationMin: newDuration,
          };
        }
        return trip;
      })
    );
  };

  const handleNewTrip = () => {
    // TODO: Open trip creation modal/dialog
    console.log("Create new trip");
    // Placeholder for future implementation
    // This could open a modal, navigate to a creation page, or show an inline form
  };

  const handleDeleteTrip = (tripId: string) => {
    // TODO: Add confirmation dialog
    if (confirm("Are you sure you want to delete this trip?")) {
      setTrips((prev) => prev.filter((t) => t.id !== tripId));
      // If deleted trip was selected, select first remaining trip or null
      if (tripId === selectedTripId) {
        const remaining = trips.filter((t) => t.id !== tripId);
        setSelectedTripId(remaining[0]?.id || null);
      }
    }
  };

  const handleEditTrip = (tripId: string) => {
    // TODO: Open trip edit modal/dialog
    console.log("Edit trip:", tripId);
    // Placeholder for future implementation
  };

  return (
    <div className="bg-gray-50 min-h-screen p-4 md:p-6">
      <div className="w-full max-w-8xl mx-auto h-[calc(100vh-var(--header-height,3rem))] grid grid-cols-1 lg:grid-cols-[350px_1fr_400px] gap-4 md:gap-6">
        {/* Trip List */}
        <TripListColumn
          trips={trips}
          selectedTripId={selectedTripId}
          onSelectTrip={setSelectedTripId}
          onNewTripClick={handleNewTrip}
          onDeleteTrip={handleDeleteTrip}
          onEditTrip={handleEditTrip}
        />

        {/* Map & Details */}
        <MapDetailsColumn
          trip={selectedTrip}
          isLoading={isLoading}
          foundPlaces={foundPlaces}
        />

        {/* Itinerary */}
        <ItineraryColumn
          trip={selectedTrip}
          onEditTrip={handleEditTrip}
        />
      </div>

      {/* Floating Chat Panel */}
      <ChatPanel
        onPlacesFound={handlePlacesFound}
        onAddPlaceToTrip={handleAddPlaceToTrip}
        userLocation={userLocation}
        defaultOpen={false}
      />
    </div>
  );
}