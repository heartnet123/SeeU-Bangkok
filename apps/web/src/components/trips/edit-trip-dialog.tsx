"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { toast } from "sonner";

interface EditStop {
  place_id?: string;
  slug: string;
  label: string;
  suggested_time_min: number;
  notes: string;
}

interface Trip {
  id: string;
  title: string;
  stops: Array<{
    id: string;
    place_id?: string;
    place?: { id?: string; name: string };
    name?: string;
    slug?: string;
    suggested_time_min?: number;
    suggestedDurationMin?: number;
    notes?: string;
  }>;
}

interface EditTripDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  trip: Trip | null;
  serverUrl?: string;
  sessionToken?: string;
}

export function EditTripDialog({
  isOpen,
  onClose,
  onSuccess,
  trip,
  serverUrl = "http://localhost:3000",
  sessionToken = "",
}: EditTripDialogProps) {
  const [editTitle, setEditTitle] = useState("");
  const [editStops, setEditStops] = useState<EditStop[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Initialize form when trip changes
  useEffect(() => {
    if (trip) {
      setEditTitle(trip.title);
      setEditStops(
        trip.stops.map((s: any) => ({
          place_id: s?.place_id ?? s?.placeId ?? s?.place?.id,
          slug: s?.slug ?? "",
          label: s?.place?.name ?? s?.name ?? s?.slug ?? "",
          suggested_time_min: s?.suggested_time_min ?? s?.suggestedDurationMin ?? 60,
          notes: s?.notes ?? "",
        }))
      );
    }
  }, [trip, isOpen]);

  const handleSaveEdit = async () => {
    if (!trip || !sessionToken) return;

    setIsSaving(true);
    try {
      const res = await fetch(`${serverUrl}/api/itineraries/${trip.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          title: editTitle,
          stops: editStops.map((stop) => ({
            ...(stop.place_id ? { place_id: stop.place_id } : { slug: stop.slug }),
            suggested_time_min: stop.suggested_time_min,
            notes: stop.notes,
          })),
        }),
      });

      const contentType = res.headers.get("content-type") || "";
      const json = contentType.includes("application/json")
        ? await res.json()
        : { success: false, error: await res.text() || "Bad response" };

      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to update trip");
      }

      toast.success("Trip updated successfully");
      onSuccess?.();
      onClose();
    } catch (e: any) {
      toast.error(`Failed to update trip: ${e?.message || "Unknown error"}`);
    } finally {
      setIsSaving(false);
    }
  };

  const updateStopTime = (index: number, value: number) => {
    const updated = [...editStops];
    updated[index].suggested_time_min = value;
    setEditStops(updated);
  };

  const updateStopNotes = (index: number, value: string) => {
    const updated = [...editStops];
    updated[index].notes = value;
    setEditStops(updated);
  };

  const moveStopUp = (index: number) => {
    if (index === 0) return;
    const updated = [...editStops];
    const temp = updated[index - 1];
    updated[index - 1] = updated[index];
    updated[index] = temp;
    setEditStops(updated);
  };

  const moveStopDown = (index: number) => {
    if (index === editStops.length - 1) return;
    const updated = [...editStops];
    const temp = updated[index + 1];
    updated[index + 1] = updated[index];
    updated[index] = temp;
    setEditStops(updated);
  };

  const removeStop = (index: number) => {
    const updated = editStops.filter((_, i) => i !== index);
    setEditStops(updated);
  };

  if (!isOpen || !trip) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto text-black">
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between border-b pb-4">
            <h2 className="text-xl font-semibold">Edit Trip</h2>
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Trip Title
            </label>
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., Weekend Temple Tour"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Stops
            </label>
            <div className="space-y-3">
              {editStops.map((stop, index) => (
                <div
                  key={index}
                  className="flex gap-2 items-start p-3 border rounded-md bg-gray-50"
                >
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center text-sm font-medium">
                    {index + 1}
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="font-medium text-black">{stop.label}</div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-gray-600">
                          Suggested Time (min)
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={stop.suggested_time_min}
                          onChange={(e) =>
                            updateStopTime(
                              index,
                              parseInt(e.target.value) || 1
                            )
                          }
                          className="w-full px-2 py-1 border rounded text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-600">Notes</label>
                        <input
                          type="text"
                          value={stop.notes}
                          onChange={(e) => updateStopNotes(index, e.target.value)}
                          className="w-full px-2 py-1 border rounded text-sm"
                          placeholder="Add notes..."
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <button
                      onClick={() => moveStopUp(index)}
                      disabled={index === 0}
                      className="p-1 hover:bg-gray-200 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Move up"
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => moveStopDown(index)}
                      disabled={index === editStops.length - 1}
                      className="p-1 hover:bg-gray-200 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Move down"
                    >
                      ↓
                    </button>
                    <button
                      onClick={() => removeStop(index)}
                      className="p-1 hover:bg-red-100 text-red-600 rounded"
                      title="Remove stop"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveEdit}
              disabled={isSaving}
              className="flex-1"
            >
              {isSaving ? (
                <>
                  <div className="w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
