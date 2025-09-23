"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, Edit } from "lucide-react";
import type { Trip } from "./mock-data";

interface Props {
  trip: Trip | null;
}

export function MapDetailsColumn({ trip }: Props) {
  if (!trip) {
    return (
      <div className="flex items-center justify-center h-full bg-white rounded-lg">
        <p className="text-slate-500">Select a trip to see details</p>
      </div>
    );
  }

  return (
    <main className="flex flex-col gap-6 h-full">
      <Card className="flex-1 bg-white border border-slate-200 shadow-sm transition-shadow hover:shadow-lg">
        <CardHeader>
          <CardTitle className="text-slate-800">Map Overview: {trip.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="w-full h-[400px] flex items-center justify-center bg-slate-50 rounded-lg border">
            <div className="text-center p-8">
              <MapPin className="w-16 h-16 mx-auto text-slate-300" />
              <h3 className="text-xl font-semibold text-slate-600 mt-4">
                Map Temporarily Disabled
              </h3>
            </div>
          </div>
        </CardContent>
      </Card>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-white border border-slate-200 shadow-sm transition-shadow hover:shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-700">Trip Summary</CardTitle>
            <Button variant="ghost" size="icon" className="w-7 h-7 text-slate-500 hover:bg-slate-100 hover:text-slate-800">
              <Edit className="w-4 h-4" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-1 text-sm text-slate-600">
            <p><strong className="font-semibold text-slate-700">Duration:</strong> {trip.totalDurationMin} mins</p>
            <p><strong className="font-semibold text-slate-700">Distance:</strong> {trip.totalDistanceKm} km</p>
            <p><strong className="font-semibold text-slate-700">Budget:</strong> {trip.estimatedBudget.toLocaleString()} THB</p>
          </CardContent>
        </Card>
        <Card className="bg-white border border-slate-200 shadow-sm transition-shadow hover:shadow-lg">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-slate-700">Traveler Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-500">{trip.notes || "No notes for this trip."}</p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}