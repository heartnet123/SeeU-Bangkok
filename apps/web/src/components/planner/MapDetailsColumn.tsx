"use client";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { MapPin, Edit, Clock, Navigation, Wallet, Search } from "lucide-react";
import MapContainer from "@/components/map/map-container";
import type { Trip } from "@/types/trip";

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

interface Props {
  trip: Trip | null;
  isLoading?: boolean;
  foundPlaces?: PlaceItem[];
  itineraryStops?: ItineraryStop[];
  userLocation?: { lat: number; lng: number };
}


export function MapDetailsColumn({ trip, isLoading = false, foundPlaces = [], itineraryStops = [], userLocation }: Props) {

  const [selectedPlace, setSelectedPlace] = useState<any | null>(null);

  // Transform places data for MapContainer
  const transformPlacesForMap = (places: PlaceItem[]): any[] => {
    return places
      .filter(place => place.lat && place.lng)
      .map(place => ({
        id: place.id,
        name: place.name,
        description: place.tags?.join(', ') || 'No description available',
        tags: place.tags || [],
        lat: place.lat!,
        lng: place.lng!,
        address: place.slug || 'Address not available',
        price: place.price || 0,
        image_url: '',
        slug: place.slug || place.id,
      }));
  };

  // Transform trip stops for map
  const transformTripStopsForMap = (trip: Trip | null): any[] => {
    if (!trip || !trip.stops) return [];
    return trip.stops
      .filter(stop => stop.lat && stop.lng)
      .map(stop => ({
        id: stop.id,
        name: stop.name,
        description: `${stop.category} - ${stop.address}`,
        tags: [stop.category],
        lat: stop.lat,
        lng: stop.lng,
        address: stop.address,
        price: 0,
        image_url: '',
        slug: stop.id,
      }));
  };

  const transformItineraryStopsForMap = (stops: ItineraryStop[]): any[] => {
    return stops
      .filter(stop => stop.lat && stop.lng)
      .map(stop => ({
        id: `itinerary-${stop.slug}`,
        name: stop.name,
        description: stop.notes || 'Itinerary stop',
        tags: [],
        lat: stop.lat!,
        lng: stop.lng!,
        address: stop.slug,
        price: 0,
        image_url: '',
        slug: stop.slug,
      }));
  };


  const handlePlaceSelect = (place: any) => {
    setSelectedPlace(place);
  };

  const handlePlaceDeselect = () => {
    setSelectedPlace(null);
  };

  // Combine found places and trip stops for map display
  const allPlacesForMap = [
    ...transformPlacesForMap(foundPlaces),
    ...transformTripStopsForMap(trip),
    ...transformItineraryStopsForMap(itineraryStops),
  ];

  // Loading state
  if (isLoading) {
    return (
      <main className="flex flex-col gap-6 h-full" role="main" aria-label="Map and trip details">
        <Card className="flex-1 bg-white border border-slate-200 shadow-sm">
          <CardContent className="p-6">
            <Skeleton className="w-full h-[400px] rounded-lg" />
          </CardContent>
        </Card>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      </main>
    );
  }

  // Empty state - no trip selected
  if (!trip) {
    return (
      <div
        className="flex items-center justify-center h-full bg-white rounded-lg border border-slate-200"
        role="main"
        aria-label="Map and trip details"
      >
        <div className="text-center p-8">
          <MapPin className="w-16 h-16 mx-auto text-slate-300" aria-hidden="true" />
          <p className="text-slate-500 mt-4">Select a trip to see details</p>
        </div>
      </div>
    );
  }

  return (
    <main className="flex flex-col gap-6 h-full" role="main" aria-label="Map and trip details">
      {/* Map Card */}
      <Card className="flex-1 bg-white border border-slate-200 shadow-sm transition-shadow hover:shadow-lg flex flex-col">
        <CardHeader className="flex-shrink-0">
          <CardTitle className="text-slate-800 flex items-center gap-2">
            <MapPin className="w-5 h-5" aria-hidden="true" />
            Map Overview: {trip.name}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 p-0 min-h-0">
          <div
            className="w-full h-full rounded-lg overflow-hidden"
            role="img"
            aria-label="Interactive map with found places"
          >
            <MapContainer
              places={allPlacesForMap}
              selectedPlace={selectedPlace}
              onPlaceSelect={handlePlaceSelect}
              onPlaceDeselect={handlePlaceDeselect}
              userLocation={userLocation ? [userLocation.lat, userLocation.lng] : undefined}
              initialCenter={[100.5018, 13.7563]} // Bangkok center
              initialZoom={12}
              previewItinerary={
                itineraryStops && itineraryStops.length > 0
                  ? { stops: itineraryStops }
                  : null
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Trip Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        {/* Trip Summary Stats */}
        <Card className="bg-white border border-slate-200 shadow-sm transition-shadow hover:shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-sm font-medium text-slate-700">
              Trip Summary
            </CardTitle>
            <Button
              variant="ghost"
              size="icon"
              className="w-7 h-7 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              aria-label="Edit trip summary"
            >
              <Edit className="w-4 h-4" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3 text-sm">
              <Clock className="w-4 h-4 text-slate-400" aria-hidden="true" />
              <div>
                <span className="font-semibold text-slate-700">Duration:</span>{" "}
                <span className="text-slate-600">
                  {Math.floor(trip.totalDurationMin / 60)}h {trip.totalDurationMin % 60}m
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Navigation className="w-4 h-4 text-slate-400" aria-hidden="true" />
              <div>
                <span className="font-semibold text-slate-700">Distance:</span>{" "}
                <span className="text-slate-600">{trip.totalDistanceKm} km</span>
              </div>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Wallet className="w-4 h-4 text-slate-400" aria-hidden="true" />
              <div>
                <span className="font-semibold text-slate-700">Budget:</span>{" "}
                <span className="text-slate-600">
                  ฿{trip.estimatedBudget.toLocaleString()}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Traveler Notes */}
        <Card className="bg-white border border-slate-200 shadow-sm transition-shadow hover:shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-sm font-medium text-slate-700">
              Traveler Notes
            </CardTitle>
            <Button
              variant="ghost"
              size="icon"
              className="w-7 h-7 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              aria-label="Edit traveler notes"
            >
              <Edit className="w-4 h-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600 leading-relaxed">
              {trip.notes || (
                <span className="text-slate-400 italic">
                  No notes for this trip yet. Click edit to add some!
                </span>
              )}
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}