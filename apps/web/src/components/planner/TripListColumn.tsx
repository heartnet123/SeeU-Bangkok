"use client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import type { Trip } from "./mock-data";
import { cn } from "@/lib/utils";

interface Props {
  trips: Trip[];
  selectedTripId: string | null;
  onSelectTrip: (id: string) => void;
  onNewTripClick: () => void;
}

export function TripListColumn({ trips, selectedTripId, onSelectTrip, onNewTripClick }: Props) {
  return (
    <aside className="flex flex-col gap-4 h-full">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-800">My Trips</h2>
        <Button size="sm" onClick={onNewTripClick}>+ New Trip</Button>
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input placeholder="Search trips..." className="pl-9" />
      </div>
      <div className="flex-1 overflow-y-auto pr-2 -mr-2">
        <div className="space-y-3">
          {trips.map((trip) => {
            const isSelected = trip.id === selectedTripId;
            return (
              <Card
                key={trip.id}
                className={cn(
                  "cursor-pointer transition-all bg-white border border-slate-200 shadow-sm hover:shadow-md",
                  // [1] เปลี่ยนจาก border/ring เป็นพื้นหลังสีฟ้าอ่อน
                  isSelected && "bg-blue-50 border-blue-400" 
                )}
                onClick={() => onSelectTrip(trip.id)}
              >
                <CardContent className="p-4">
                  {/* [2] ปรับสีตัวอักษรเมื่อการ์ดถูกเลือก */}
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
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </aside>
  );
}