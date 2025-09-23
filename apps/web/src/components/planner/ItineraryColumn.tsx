"use client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Edit, GripVertical } from "lucide-react";
import type { Trip, TripStop } from "./mock-data";
import { cn } from "@/lib/utils";

interface Props {
  trip: Trip | null;
}

const categoryColors: Record<TripStop["category"], string> = {
  Cafe: "bg-amber-100 text-amber-800",
  Restaurant: "bg-orange-100 text-orange-800",
  Temple: "bg-indigo-100 text-indigo-800",
  Shopping: "bg-pink-100 text-pink-800",
  Viewpoint: "bg-teal-100 text-teal-800",
};

export function ItineraryColumn({ trip }: Props) {
  if (!trip) return null;

  return (
    <aside className="flex flex-col gap-4 h-full text-black">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold truncate pr-4">{trip.name}</h2>
        <div className="flex gap-2">
          <Button>Save</Button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto pr-2 -mr-2">
        <div className="space-y-3">
          {trip.stops.map((stop, index) => (
            <Card key={stop.id} className="bg-white text-black">
              <CardContent className="p-3 flex items-start gap-3">
                <div className="flex flex-col items-center gap-1">
                  <span className="font-bold text-lg">{index + 1}</span>
                  <GripVertical className="w-5 h-5 text-gray-300 cursor-grab" />
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-start">
                    <h4 className="font-semibold">{stop.name}</h4>
                    <span
                      className={cn(
                        "text-xs font-medium px-2 py-0.5 rounded-full",
                        categoryColors[stop.category]
                      )}
                    >
                      {stop.category}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{stop.address}</p>
                  <p className="text-xs text-gray-500 mt-2">
                    Suggested time: {stop.suggestedDurationMin} mins
                  </p>
                </div>
                <Button variant="ghost" size="icon" className="w-7 h-7 shrink-0">
                    <Edit className="w-4 h-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </aside>
  );
}