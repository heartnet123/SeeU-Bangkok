"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { X, Search, Loader2, MapPin } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";

interface Place {
  id: string;
  name: string;
  slug?: string;
  lat?: number;
  lng?: number;
  tags?: string[];
  description?: string;
  price?: number;
}

interface NewTripDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  serverUrl?: string;
  sessionToken?: string;
}

export function NewTripDialog({
  isOpen,
  onClose,
  onSuccess,
  serverUrl = "http://localhost:3000",
  sessionToken = "",
}: NewTripDialogProps) {
  const [tripTitle, setTripTitle] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [allPlaces, setAllPlaces] = useState<Place[]>([]);
  const [filteredPlaces, setFilteredPlaces] = useState<Place[]>([]);
  const [selectedPlaces, setSelectedPlaces] = useState<Place[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch all places on dialog open
  useEffect(() => {
    if (isOpen && allPlaces.length === 0) {
      fetchAllPlaces();
    }
  }, [isOpen]);

  const fetchAllPlaces = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${serverUrl}/api/places?limit=1000`);
      if (!response.ok) throw new Error("Failed to fetch places");
      
      const data = await response.json();
      if (data.success && Array.isArray(data.data)) {
        const places = data.data.map((p: any) => ({
          id: p.id,
          name: p.name,
          slug: p.slug || p.id,
          lat: p.lat,
          lng: p.lng,
          tags: p.tags || [],
          description: p.description || "",
          price: p.price,
        }));
        setAllPlaces(places);
        setFilteredPlaces(places);
      }
    } catch (error) {
      console.error("Error fetching places:", error);
      toast.error("Failed to load places");
    } finally {
      setIsLoading(false);
    }
  };

  // Filter places based on search query
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!searchQuery.trim()) {
        setFilteredPlaces(allPlaces);
      } else {
        const query = searchQuery.toLowerCase();
        const filtered = allPlaces.filter(
          (place) =>
            place.name.toLowerCase().includes(query) ||
            place.description?.toLowerCase().includes(query) ||
            place.tags?.some((tag) => tag.toLowerCase().includes(query))
        );
        setFilteredPlaces(filtered);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, allPlaces]);

  const togglePlaceSelection = (place: Place) => {
    setSelectedPlaces((prev) => {
      const isSelected = prev.some((p) => p.id === place.id);
      if (isSelected) {
        return prev.filter((p) => p.id !== place.id);
      } else {
        return [...prev, place];
      }
    });
  };

  const handleCreateTrip = async () => {
    if (!tripTitle.trim()) {
      toast.error("Please enter a trip title");
      return;
    }

    if (selectedPlaces.length === 0) {
      toast.error("Please select at least one place");
      return;
    }

    if (!sessionToken) {
      toast.error("User session not found");
      return;
    }

    setIsSubmitting(true);
    try {
      const stops = selectedPlaces.map((place, index) => ({
        place_id: place.id,
        slug: place.slug || place.id,
        suggested_time_min: 60,
        notes: "",
      }));

      const response = await fetch(`${serverUrl}/api/itineraries`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          title: tripTitle,
          stops: stops,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to create trip");
      }

      toast.success("Trip created successfully!");
      setTripTitle("");
      setSelectedPlaces([]);
      setSearchQuery("");
      onClose();
      onSuccess?.();
    } catch (error) {
      console.error("Error creating trip:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to create trip"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b p-6">
          <h2 className="text-2xl font-semibold text-gray-900">Create New Trip</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-lg transition"
          >
            <X className="w-6 h-6 text-gray-600" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6">
            {/* Trip Title Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Trip Title
              </label>
              <Input
                type="text"
                value={tripTitle}
                onChange={(e) => setTripTitle(e.target.value)}
                placeholder="e.g., Bangkok Temple Tour, Weekend Adventure"
                className="w-full text-black"
              />
            </div>

            {/* Search Bar */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search Places
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name, description, or tag..."
                  className="pl-10 text-black"
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Selected Places Display */}
            {selectedPlaces.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Selected Places ({selectedPlaces.length})
                </label>
                <div className="flex flex-wrap gap-2">
                  <AnimatePresence>
                    {selectedPlaces.map((place) => (
                      <motion.div
                        key={place.id}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                      >
                        <Badge
                          variant="default"
                          className="bg-blue-500 hover:bg-blue-600 pr-1 flex items-center gap-1"
                        >
                          {place.name}
                          <button
                            onClick={() => togglePlaceSelection(place)}
                            className="ml-1 p-0 hover:bg-blue-700 rounded"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </Badge>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            )}

            {/* Places List */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Available Places
              </label>
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-2" />
                    <p className="text-gray-600">Loading places...</p>
                  </div>
                </div>
              ) : filteredPlaces.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-600">
                    {allPlaces.length === 0
                      ? "No places available"
                      : "No places match your search"}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto">
                  <AnimatePresence>
                    {filteredPlaces.map((place) => {
                      const isSelected = selectedPlaces.some(
                        (p) => p.id === place.id
                      );
                      return (
                        <motion.button
                          key={place.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          onClick={() => togglePlaceSelection(place)}
                          className={`p-3 rounded-lg border-2 text-left transition ${
                            isSelected
                              ? "border-blue-500 bg-blue-50"
                              : "border-gray-200 bg-white hover:border-gray-300"
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h3 className="font-medium text-gray-900">
                                {place.name}
                              </h3>
                              {place.description && (
                                <p className="text-xs text-gray-500 line-clamp-1 mt-1">
                                  {place.description}
                                </p>
                              )}
                              {place.tags && place.tags.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-2">
                                  {place.tags.slice(0, 2).map((tag, idx) => (
                                    <span
                                      key={idx}
                                      className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded"
                                    >
                                      {tag}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div className="flex-shrink-0 ml-2">
                              <div
                                className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                                  isSelected
                                    ? "bg-blue-500 border-blue-500"
                                    : "border-gray-300"
                                }`}
                              >
                                {isSelected && (
                                  <svg
                                    className="w-3 h-3 text-white"
                                    fill="current"
                                    viewBox="0 0 20 20"
                                  >
                                    <path
                                      fillRule="evenodd"
                                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                      clipRule="evenodd"
                                    />
                                  </svg>
                                )}
                              </div>
                            </div>
                          </div>
                        </motion.button>
                      );
                    })}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t p-6 flex gap-3 justify-end">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-6"
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreateTrip}
            disabled={
              isSubmitting ||
              !tripTitle.trim() ||
              selectedPlaces.length === 0
            }
            className="px-6 bg-blue-600 hover:bg-blue-700 text-white"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              "Create Trip"
            )}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
