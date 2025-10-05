"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { MapPin, Edit, Clock, Navigation, Wallet, Search } from "lucide-react";
import type { Trip } from "./mock-data";

interface PlaceItem {
  id: string;
  name: string;
  slug: string;
  lat?: number;
  lng?: number;
  tags?: string[];
  price?: number;
}

interface Props {
  trip: Trip | null;
  isLoading?: boolean;
  foundPlaces?: PlaceItem[];
}

export function MapDetailsColumn({ trip, isLoading = false, foundPlaces = [] }: Props) {
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
      <Card className="flex-1 bg-white border border-slate-200 shadow-sm transition-shadow hover:shadow-lg">
        <CardHeader>
          <CardTitle className="text-slate-800 flex items-center gap-2">
            <MapPin className="w-5 h-5" aria-hidden="true" />
            Map Overview: {trip.name}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className="w-full h-[400px] flex flex-col bg-slate-50 rounded-lg border border-slate-200 overflow-hidden"
            role="img"
            aria-label="Interactive map with found places"
          >
            {/* Map Placeholder */}
            <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-blue-50 to-slate-100 relative">
              <div className="text-center p-8">
                <MapPin className="w-16 h-16 mx-auto text-slate-300 mb-4" aria-hidden="true" />
                <h3 className="text-xl font-semibold text-slate-600">
                  Interactive Map Coming Soon
                </h3>
                <p className="text-sm text-slate-500 mt-2 max-w-md">
                  View your trip stops and routes on an interactive map
                </p>
              </div>

              {/* Found Places Markers Overlay */}
              {foundPlaces.length > 0 && (
                <div className="absolute top-4 left-4 right-4">
                  <Badge variant="secondary" className="bg-white/90 backdrop-blur-sm shadow-lg text-black">
                    <Search className="w-3 h-3 mr-1" />
                    {foundPlaces.length} places found from chat
                  </Badge>
                </div>
              )}

              {/* Mock Pin Visualization */}
              {foundPlaces.length > 0 && (
                <div className="absolute inset-0 pointer-events-none">
                  {foundPlaces.slice(0, 5).map((place, idx) => (
                    <div
                      key={place.id}
                      className="absolute transform -translate-x-1/2 -translate-y-1/2"
                      style={{
                        left: `${20 + idx * 15}%`,
                        top: `${30 + (idx % 2) * 20}%`,
                      }}
                    >
                      <div className="relative group">
                        <MapPin className="w-8 h-8 text-red-500 drop-shadow-lg animate-bounce" style={{ animationDelay: `${idx * 0.1}s` }} />
                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block">
                          <div className="bg-white rounded-lg shadow-lg p-2 text-xs whitespace-nowrap">
                            <div className="font-semibold">{place.name}</div>
                            {place.tags && place.tags.length > 0 && (
                              <div className="text-gray-500">{place.tags[0]}</div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Trip Stops List (if trip exists) */}
            {trip && trip.stops.length > 0 && (
              <div className="bg-white border-t p-3 max-h-32 overflow-y-auto">
                <div className="text-xs font-medium text-slate-700 mb-2">Trip Stops ({trip.stops.length})</div>
                <div className="space-y-1">
                  {trip.stops.map((stop, idx) => (
                    <div key={stop.id} className="flex items-center gap-2 text-xs text-slate-600">
                      <span className="font-medium w-4">{idx + 1}.</span>
                      <span className="flex-1 truncate">{stop.name}</span>
                      <Badge variant="outline" className="text-xs">{stop.category}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
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