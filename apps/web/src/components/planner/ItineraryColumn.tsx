"use client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Edit, GripVertical, Save, Clock } from "lucide-react";
import type { Trip, TripStop } from "./mock-data";
import { cn } from "@/lib/utils";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useEffect, useMemo, useState } from "react";

interface Props {
  trip: Trip | null;
  onEditTrip?: (tripId: string) => void;
  isLoading?: boolean;
  onReorderStops?: (tripId: string, orderedStopIds: string[]) => void;
}

const categoryColors: Record<TripStop["category"], string> = {
  Cafe: "bg-amber-100 text-amber-800 border-amber-200",
  Restaurant: "bg-orange-100 text-orange-800 border-orange-200",
  Temple: "bg-indigo-100 text-indigo-800 border-indigo-200",
  Shopping: "bg-pink-100 text-pink-800 border-pink-200",
  Viewpoint: "bg-teal-100 text-teal-800 border-teal-200",
};

export function ItineraryColumn({
  trip,
  onEditTrip,
  isLoading = false,
  onReorderStops,
}: Props) {
  const [orderedStops, setOrderedStops] = useState<TripStop[]>(
    trip?.stops ?? []
  );

  useEffect(() => {
    setOrderedStops(trip?.stops ?? []);
  }, [trip]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const stopIds = useMemo(() => orderedStops.map((s) => s.id), [orderedStops]);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const currentIndex = orderedStops.findIndex((s) => s.id === active.id);
    const overIndex = orderedStops.findIndex((s) => s.id === over.id);
    if (currentIndex === -1 || overIndex === -1) return;
    const newOrder = arrayMove(orderedStops, currentIndex, overIndex);
    setOrderedStops(newOrder);
    if (trip && onReorderStops)
      onReorderStops(
        trip.id,
        newOrder.map((s) => s.id)
      );
  }
  // Loading state
  if (isLoading) {
    return (
      <aside
        className="flex flex-col gap-4 h-full"
        role="complementary"
        aria-label="Trip itinerary"
      >
        <div className="flex items-center justify-between">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-9 w-20" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      </aside>
    );
  }

  // Empty state - no trip selected
  if (!trip) {
    return (
      <aside
        className="flex flex-col gap-4 h-full"
        role="complementary"
        aria-label="Trip itinerary"
      >
        <div className="flex items-center justify-center h-full text-center p-8">
          <p className="text-slate-500">Select a trip to view itinerary</p>
        </div>
      </aside>
    );
  }

  const handleSaveTrip = () => {
    // TODO: Implement save functionality
    console.log("Save trip:", trip.id);
  };

  return (
    <aside
      className="flex flex-col gap-4 h-full"
      role="complementary"
      aria-label="Trip itinerary"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <h2
          className="text-xl font-bold text-slate-800 truncate pr-2"
          title={trip.name}
        >
          {trip.name}
        </h2>
        <div className="flex gap-2 shrink-0">
          {onEditTrip && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onEditTrip(trip.id)}
              aria-label="Edit trip details"
            >
              <Edit className="w-4 h-4 mr-1" />
              Edit
            </Button>
          )}
          <Button
            size="sm"
            onClick={handleSaveTrip}
            aria-label="Save trip changes"
          >
            <Save className="w-4 h-4 mr-1" />
            Save
          </Button>
        </div>
      </div>

      {/* Trip metadata */}
      <div className="flex items-center gap-4 text-sm text-slate-600 pb-2 border-b border-slate-200">
        <span className="flex items-center gap-1">
          <Clock className="w-4 h-4" aria-hidden="true" />
          {Math.floor(trip.totalDurationMin / 60)}h {trip.totalDurationMin % 60}
          m
        </span>
        <span>•</span>
        <span>{trip.stops.length} stops</span>
        <span>•</span>
        <span>{trip.totalDistanceKm} km</span>
      </div>

      {/* Stops list with drag-and-drop */}
      <div
        className="flex-1 overflow-y-auto pr-2 -mr-2"
        role="list"
        aria-label="Trip stops"
      >
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={stopIds}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-3">
              {orderedStops.map((stop, index) => (
                <SortableStopCard key={stop.id} id={stop.id}>
                  <Card
                    className="bg-white border border-slate-200 shadow-sm hover:shadow-md transition-shadow"
                    role="listitem"
                  >
                    <CardContent className="p-3 flex items-start gap-3">
                      {/* Stop number and drag handle */}
                      <div className="flex flex-col items-center gap-1 pt-1">
                        <span
                          className="font-bold text-lg text-slate-700 w-6 h-6 flex items-center justify-center"
                          aria-label={`Stop ${index + 1}`}
                        >
                          {index + 1}
                        </span>
                        <button
                          className="cursor-grab active:cursor-grabbing focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
                          aria-label={`Reorder stop: ${stop.name}`}
                          tabIndex={0}
                        >
                          <GripVertical
                            className="w-5 h-5 text-slate-300 hover:text-slate-400"
                            aria-hidden="true"
                          />
                        </button>
                      </div>

                      {/* Stop details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start gap-2 mb-1">
                          <h4 className="font-semibold text-slate-800 text-sm leading-tight">
                            {stop.name}
                          </h4>
                          <span
                            className={cn(
                              "text-xs font-medium px-2 py-0.5 rounded-full border shrink-0",
                              categoryColors[stop.category]
                            )}
                            role="badge"
                            aria-label={`Category: ${stop.category}`}
                          >
                            {stop.category}
                          </span>
                        </div>
                        <p
                          className="text-xs text-slate-500 mt-1 line-clamp-1"
                          title={stop.address}
                        >
                          {stop.address}
                        </p>
                        <div className="flex items-center gap-1 mt-2">
                          <Clock
                            className="w-3 h-3 text-slate-400"
                            aria-hidden="true"
                          />
                          <p className="text-xs text-slate-600">
                            Suggested: {stop.suggestedDurationMin} mins
                          </p>
                        </div>
                      </div>

                      {/* Edit button */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="w-7 h-7 shrink-0 text-slate-500 hover:text-slate-700"
                        aria-label={`Edit stop: ${stop.name}`}
                        onClick={() => {
                          // TODO: Implement stop edit functionality
                          console.log("Edit stop:", stop.id);
                        }}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                    </CardContent>
                  </Card>
                </SortableStopCard>
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>

      {/* Add stop button */}
      <Button
        variant="outline"
        className="w-full"
        onClick={() => {
          // TODO: Implement add stop functionality
          console.log("Add new stop to trip:", trip.id);
        }}
        aria-label="Add new stop to itinerary"
      >
        + Add Stop
      </Button>
    </aside>
  );
}

interface SortableStopCardProps {
  id: string;
  children: React.ReactNode;
}

function SortableStopCard({ id, children }: SortableStopCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  } as React.CSSProperties;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn("touch-none", isDragging && "opacity-90 shadow-lg")}
    >
      {children}
    </div>
  );
}
