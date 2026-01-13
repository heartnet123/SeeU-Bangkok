"use client";
import { useState, useEffect } from "react";
import { TripListColumn } from "@/components/planner/TripListColumn";
import { ItineraryColumn } from "@/components/planner/ItineraryColumn";
import { ChatPanel } from "@/components/planner/ChatPanel";
import MapContainer from "@/components/map/map-container";
import { CollapsiblePanel } from "@/components/map/collapsible-panel";
import { MapToolbar } from "@/components/map/map-toolbar";
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

interface ItineraryStop {
  slug: string;
  name: string;
  lat?: number;
  lng?: number;
  suggested_time_min?: number;
  notes?: string;
}

export default function TripPlannerPage() {
  const [trips, setTrips] = useState<Trip[]>(mockTrips);
  const [selectedTripId, setSelectedTripId] = useState<string | null>(
    mockTrips[0]?.id || null
  );
  const [isLoading, setIsLoading] = useState(false);
  const [userLocation, setUserLocation] = useState<
    { lat: number; lng: number } | undefined
  >();
  const [foundPlaces, setFoundPlaces] = useState<PlaceItem[]>([]);
  const [agentItinerary, setAgentItinerary] = useState<any | null>(null);

  // Panel visibility states
  const [isTripsPanelOpen, setIsTripsPanelOpen] = useState(true);
  const [isItineraryPanelOpen, setIsItineraryPanelOpen] = useState(true);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<any | null>(null);


  const selectedTrip = trips.find((t) => t.id === selectedTripId) || null;

  // Get user location on mount
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLocation({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
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

  const handleItineraryCreated = (itinerary: any) => {
    setAgentItinerary(itinerary);
    console.log("Received itinerary from agent:", itinerary);
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
          const newDuration = updatedStops.reduce(
            (sum, stop) => sum + stop.suggestedDurationMin,
            0
          );

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

  const handleReorderTrips = (orderedTripIds: string[]) => {
    setTrips((prev) => {
      const idToTrip = new Map(prev.map((t) => [t.id, t] as const));
      const reordered: Trip[] = [];
      for (const id of orderedTripIds) {
        const tr = idToTrip.get(id);
        if (tr) reordered.push(tr);
      }
      // Append any missing (safety)
      for (const t of prev)
        if (!orderedTripIds.includes(t.id)) reordered.push(t);
      return reordered;
    });
  };

  const handleReorderStops = (tripId: string, orderedStopIds: string[]) => {
    setTrips((prev) =>
      prev.map((t) => {
        if (t.id !== tripId) return t;
        const idToStop = new Map(t.stops.map((s) => [s.id, s] as const));
        const reordered: TripStop[] = [];
        for (const id of orderedStopIds) {
          const st = idToStop.get(id);
          if (st) reordered.push(st);
        }
        for (const s of t.stops)
          if (!orderedStopIds.includes(s.id)) reordered.push(s);
        const newDuration = reordered.reduce(
          (sum, s) => sum + s.suggestedDurationMin,
          0
        );
        return { ...t, stops: reordered, totalDurationMin: newDuration };
      })
    );
  };

  // Transform places for map display
  const transformPlacesForMap = (places: PlaceItem[]): any[] => {
    return places
      .filter((place) => place.lat && place.lng)
      .map((place) => ({
        id: place.id,
        name: place.name,
        description: place.tags?.join(", ") || "No description available",
        tags: place.tags || [],
        lat: place.lat!,
        lng: place.lng!,
        address: place.slug || "Address not available",
        price: place.price || 0,
        image_url: "",
        slug: place.slug || place.id,
      }));
  };

  // Transform trip stops for map
  const transformTripStopsForMap = (trip: Trip | null): any[] => {
    if (!trip || !trip.stops) return [];
    return trip.stops
      .filter((stop) => stop.lat && stop.lng)
      .map((stop) => ({
        id: stop.id,
        name: stop.name,
        description: `${stop.category} - ${stop.address}`,
        tags: [stop.category],
        lat: stop.lat,
        lng: stop.lng,
        address: stop.address,
        price: 0,
        image_url: "",
        slug: stop.id,
      }));
  };

  const transformItineraryStopsForMap = (stops: ItineraryStop[]): any[] => {
    return stops
      .filter((stop) => stop.lat && stop.lng)
      .map((stop) => ({
        id: `itinerary-${stop.slug}`,
        name: stop.name,
        description: stop.notes || "Itinerary stop",
        tags: [],
        lat: stop.lat!,
        lng: stop.lng!,
        address: stop.slug,
        price: 0,
        image_url: "",
        slug: stop.slug,
      }));
  };

  const allPlacesForMap = [
    ...transformPlacesForMap(foundPlaces),
    ...transformTripStopsForMap(selectedTrip),
    ...transformItineraryStopsForMap(agentItinerary?.stops || []),
  ];

  const itineraryStopsForMap = (agentItinerary?.stops || [])
    .filter((s: ItineraryStop) => s.lat && s.lng)
    .map((s: ItineraryStop) => ({
      lat: s.lat!,
      lng: s.lng!,
      slug: s.slug,
      name: s.name,
    }));

  return (
    <div className="relative w-full h-screen overflow-hidden">
      {/* Fullscreen Map Background */}
      <div className="absolute inset-0 z-0">
        <MapContainer
          places={allPlacesForMap}
          selectedPlace={selectedPlace}
          onPlaceSelect={setSelectedPlace}
          onPlaceDeselect={() => setSelectedPlace(null)}
          userLocation={
            userLocation ? [userLocation.lat, userLocation.lng] : undefined
          }
          initialCenter={[100.5018, 13.7563]}
          initialZoom={12}
          itineraryStops={itineraryStopsForMap}
        />
      </div>

      {/* Map Toolbar - Central toggle buttons */}
      <MapToolbar
        isTripsPanelOpen={isTripsPanelOpen}
        isItineraryPanelOpen={isItineraryPanelOpen}
        isChatOpen={isChatOpen}
        onToggleTripsPanel={() => setIsTripsPanelOpen(!isTripsPanelOpen)}
        onToggleItineraryPanel={() =>
          setIsItineraryPanelOpen(!isItineraryPanelOpen)
        }
        onToggleChat={() => setIsChatOpen(!isChatOpen)}
      />

      {/* Left Panel - Trip List */}
      <CollapsiblePanel
        isOpen={isTripsPanelOpen}
        onClose={() => setIsTripsPanelOpen(false)}
        position="left"
        title="My Trips"
        width="w-[380px]"
      >
        <TripListColumn
          trips={trips}
          selectedTripId={selectedTripId}
          onSelectTrip={setSelectedTripId}
          onNewTripClick={handleNewTrip}
          onDeleteTrip={handleDeleteTrip}
          onEditTrip={handleEditTrip}
          onReorderTrips={handleReorderTrips}
        />
      </CollapsiblePanel>

      {/* Right Panel - Itinerary */}
      <CollapsiblePanel
        isOpen={isItineraryPanelOpen}
        onClose={() => setIsItineraryPanelOpen(false)}
        position="right"
        title={selectedTrip?.name || "Itinerary"}
        width="w-[400px]"
      >
        <ItineraryColumn
          trip={selectedTrip}
          onEditTrip={handleEditTrip}
          onReorderStops={handleReorderStops}
        />
      </CollapsiblePanel>

      {/* Floating Chat Panel */}
      <ChatPanel
        onPlacesFound={handlePlacesFound}
        onAddPlaceToTrip={handleAddPlaceToTrip}
        onItineraryCreated={handleItineraryCreated}
        userLocation={userLocation}
        defaultOpen={isChatOpen}
      />
    </div>
  );
}
