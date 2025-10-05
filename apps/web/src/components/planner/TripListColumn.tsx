"use client";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, MoreVertical, Edit, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Trip } from "./mock-data";
import { cn } from "@/lib/utils";

interface Props {
  trips: Trip[];
  selectedTripId: string | null;
  onSelectTrip: (id: string) => void;
  onNewTripClick: () => void;
  onDeleteTrip?: (tripId: string) => void;
  onEditTrip?: (tripId: string) => void;
}

export function TripListColumn({
  trips,
  selectedTripId,
  onSelectTrip,
  onNewTripClick,
  onDeleteTrip,
  onEditTrip
}: Props) {
  const [searchQuery, setSearchQuery] = useState("");

  // Filter trips based on search query
  const filteredTrips = trips.filter((trip) =>
    trip.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    trip.date.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Empty state when no trips exist
  if (trips.length === 0) {
    return (
      <aside className="flex flex-col gap-4 h-full" role="complementary" aria-label="Trip list">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-800">My Trips</h2>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center py-12 px-4">
            <p className="text-slate-500 mb-4">No trips yet</p>
            <Button onClick={onNewTripClick}>
              Create Your First Trip
            </Button>
          </div>
        </div>
      </aside>
    );
  }

  return (
    <aside className="flex flex-col gap-4 h-full" role="complementary" aria-label="Trip list">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-800">My Trips</h2>
        <Button size="sm" onClick={onNewTripClick} aria-label="Create new trip">
          + New Trip
        </Button>
      </div>
      
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" aria-hidden="true" />
        <Input
          placeholder="Search trips..."
          className="pl-9"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label="Search trips"
        />
      </div>

      {/* No results state */}
      {filteredTrips.length === 0 && searchQuery && (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-slate-500 text-sm">No trips found matching "{searchQuery}"</p>
        </div>
      )}

      {/* Trip list */}
      {filteredTrips.length > 0 && (
        <div className="flex-1 overflow-y-auto pr-2 -mr-2" role="list">
          <div className="space-y-3">
            {filteredTrips.map((trip) => {
              const isSelected = trip.id === selectedTripId;
              return (
                <Card
                  key={trip.id}
                  className={cn(
                    "cursor-pointer transition-all bg-white border border-slate-200 shadow-sm hover:shadow-md focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2",
                    isSelected && "bg-blue-50 border-blue-400"
                  )}
                  role="listitem"
                >
                  <CardContent className="p-4 flex items-start gap-2">
                    <button
                      className="flex-1 text-left"
                      onClick={() => onSelectTrip(trip.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onSelectTrip(trip.id);
                        }
                      }}
                      aria-label={`Select trip: ${trip.name}`}
                      aria-pressed={isSelected}
                    >
                      <h3 className={cn(
                        "font-semibold text-slate-800",
                        isSelected && "text-blue-900"
                      )}>
                        {trip.name}
                      </h3>
                      <p className={cn(
                        "text-sm text-slate-500",
                        isSelected && "text-blue-700"
                      )}>
                        {trip.date}
                      </p>
                      <p className={cn(
                        "text-sm text-slate-500 mt-2",
                        isSelected && "text-blue-700"
                      )}>
                        {trip.stops.length} Stops • {trip.totalDistanceKm} km
                      </p>
                    </button>

                    {/* Trip actions menu */}
                    {(onEditTrip || onDeleteTrip) && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0"
                            aria-label={`Actions for ${trip.name}`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {onEditTrip && (
                            <DropdownMenuItem onClick={() => onEditTrip(trip.id)}>
                              <Edit className="mr-2 h-4 w-4" />
                              Edit Trip
                            </DropdownMenuItem>
                          )}
                          {onDeleteTrip && (
                            <DropdownMenuItem
                              onClick={() => onDeleteTrip(trip.id)}
                              className="text-red-600 focus:text-red-600"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete Trip
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </aside>
  );
}