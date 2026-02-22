"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { TripListColumn } from "@/components/planner/TripListColumn";
import { ItineraryColumn } from "@/components/planner/ItineraryColumn";
import { ChatPanel } from "@/components/planner/ChatPanel";
import MapContainer from "@/components/map/map-container";
import { CollapsiblePanel } from "@/components/map/collapsible-panel";
import { BottomSheet } from "@/components/map/bottom-sheet";
import { MapToolbar } from "@/components/map/map-toolbar";
import { PlaceCard } from "@/components/map/place-card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { NewTripDialog } from "@/components/trips/new-trip-dialog";
import { EditTripDialog } from "@/components/trips/edit-trip-dialog";
import type { Trip, TripStop } from "@/components/planner/mock-data";
import { mockTrips } from "@/components/planner/mock-data";
import { toast } from "sonner";
import { motion, AnimatePresence } from "motion/react";
import { 
  Search, 
  X, 
  Globe, 
  Utensils, 
  Landmark, 
  Building2, 
  ShoppingBag,
  TreePine,
  Camera,
  Music,
  Coffee,
  Loader2,
  Plus
} from "lucide-react";

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

// Category definitions with icons (labels will use translations inside component)
const DEFAULT_CATEGORIES = [
  { id: 'all', key: 'nav.all', icon: Globe },
  { id: 'restaurant', key: 'categories.restaurants', icon: Utensils },
  { id: 'temple', key: 'categories.temples', icon: Landmark },
  { id: 'shopping', key: 'categories.shopping', icon: ShoppingBag },
  { id: 'park', key: 'categories.parks', icon: TreePine },
  { id: 'museum', key: 'categories.museums', icon: Building2 },
  { id: 'cafe', key: 'categories.cafes', icon: Coffee },
  { id: 'nightlife', key: 'categories.nightlife', icon: Music },
  { id: 'attraction', key: 'categories.attractions', icon: Camera },
];


import { useTranslation } from "@/contexts/language-context";
import { useAuth } from "@/contexts/auth-context";

export default function TripPlannerPage() {
  const { t, locale } = useTranslation();
  const { session } = useAuth();
  const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:3000";
  
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

  // Search and filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<PlaceItem[]>([]);

  // Panel visibility states
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<any | null>(null);
  const [isBottomSheetExpanded, setIsBottomSheetExpanded] = useState(true);
  const [isNewTripDialogOpen, setIsNewTripDialogOpen] = useState(false);
  const [isLeftPanelOpen, setIsLeftPanelOpen] = useState(true);
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(true);
  const [editingTrip, setEditingTrip] = useState<Trip | null>(null);
  const [routeDistanceKm, setRouteDistanceKm] = useState<number | null>(null);
  const [routeTravelMin, setRouteTravelMin] = useState<number | null>(null);

  const selectedTrip = trips.find((t) => t.id === selectedTripId) || null;

  const CATEGORIES = useMemo(() => DEFAULT_CATEGORIES.map(c => ({ ...c, label: t(c.key) })), [t]);

  // Fetch saved trips from server
  const fetchSavedTrips = async () => {
    if (!session?.access_token) return;
    try {
      const response = await fetch(`${serverUrl}/api/itineraries`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const contentType = response.headers.get('content-type') || '';
      const data = contentType.includes('application/json') 
        ? await response.json() 
        : { success: false, error: 'Bad response' };
      
      if (response.ok && data.success && Array.isArray(data.data)) {
        // Transform server trip data to match Trip interface
        const serverTrips = data.data.map((trip: any) => ({
          id: trip.id,
          name: trip.title || 'Unnamed Trip',
          date: trip.created_at ? new Date(trip.created_at).toLocaleDateString() : 'No date',
          stops: (trip.stops || []).map((stop: any) => ({
            id: stop.id,
            name: stop.place?.name || 'Unknown Stop',
            address: stop.place?.name || 'Address unknown',
            category: stop.place?.tags?.[0] || 'Viewpoint',
            suggestedDurationMin: stop.suggested_time_min || 60,
            lat: stop.place?.lat || 0,
            lng: stop.place?.lng || 0,
          })),
          totalDurationMin: trip.total_minutes || 0,
          totalDistanceKm: trip.total_distance_km || 0,
          estimatedBudget: 0,
          notes: '',
        }));
        
        setTrips(serverTrips);
        if (serverTrips.length > 0 && !selectedTripId) {
          setSelectedTripId(serverTrips[0].id);
        }
      }
    } catch (error) {
      console.error('Error fetching saved trips:', error);
      // Keep mock trips as fallback
    }
  };

  // Fetch saved trips when user is authenticated
  useEffect(() => {
    if (session?.access_token) {
      fetchSavedTrips();
    }
  }, [session?.access_token]);

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

  // Debounced search function
  const performSearch = useCallback(async (query: string, category: string) => {
    if (!query.trim() && category === 'all') {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:3000";
      const params = new URLSearchParams();
      
      if (query.trim()) {
        params.append('query', query);
      }
      if (category !== 'all') {
        params.append('categories', category);
      }
      params.append('limit', '20');
      params.append('locale', locale);

      const response = await fetch(`${serverUrl}/api/places?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error('Search failed');
      }

      const data = await response.json();
      
      if (data.success && Array.isArray(data.data)) {
        setSearchResults(data.data.map((p: any) => ({
          id: p.id,
          name: p.name,
          slug: p.slug || p.id,
          lat: p.lat,
          lng: p.lng,
          tags: p.tags || [],
          price: p.price,
        })));
      }
    } catch (error) {
      console.error('Search error:', error);
      toast.error(t("errors.searchFailed"));
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      performSearch(searchQuery, selectedCategory);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, selectedCategory, performSearch]);

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
      toast.error(t("errors.selectTrip"));
      return;
    }

    if (!place.lat || !place.lng) {
      toast.error(t("errors.noLocation"));
      return;
    }

    const newStop: TripStop = {
      id: `stop-${Date.now()}`,
      name: place.name,
      address: place.slug || "Address not available",
      category: (place.tags?.[0] as any) || "Shopping",
      suggestedDurationMin: 60,
      lat: place.lat,
      lng: place.lng,
    };

    setTrips((prevTrips) =>
      prevTrips.map((trip) => {
        if (trip.id === selectedTripId) {
          if (trip.stops.some((stop) => stop.name === place.name)) {
            toast.info(`${place.name} is already in this trip`);
            return trip;
          }

          const updatedStops = [...trip.stops, newStop];
          const newDuration = updatedStops.reduce(
            (sum, stop) => sum + stop.suggestedDurationMin,
            0
          );

          toast.success(t("actions.addedToTrip").replace("{place}", place.name).replace("{trip}", trip.name));

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
    setIsNewTripDialogOpen(true);
  };

  const handleNewTripSuccess = () => {
    // Refetch trips from the server
    fetchSavedTrips();
    setIsNewTripDialogOpen(false);
  };

  const handleDeleteTrip = (tripId: string) => {
    if (confirm("Are you sure you want to delete this trip?")) {
      setTrips((prev) => prev.filter((t) => t.id !== tripId));
      if (tripId === selectedTripId) {
        const remaining = trips.filter((t) => t.id !== tripId);
        setSelectedTripId(remaining[0]?.id || null);
      }
    }
  };

  const handleEditTrip = (tripId: string) => {
    const trip = trips.find(t => t.id === tripId);
    if (trip) {
      setEditingTrip(trip);
    }
  };

  const handleReorderTrips = (orderedTripIds: string[]) => {
    setTrips((prev) => {
      const idToTrip = new Map(prev.map((t) => [t.id, t] as const));
      const reordered: Trip[] = [];
      for (const id of orderedTripIds) {
        const tr = idToTrip.get(id);
        if (tr) reordered.push(tr);
      }
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

  const handleClearSearch = () => {
    setSearchQuery("");
    setSelectedCategory("all");
    setSearchResults([]);
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

  // Combine all places for map
  const allPlacesForMap = useMemo(() => [
    ...transformPlacesForMap(foundPlaces),
    ...transformPlacesForMap(searchResults),
    ...transformTripStopsForMap(selectedTrip),
    ...transformItineraryStopsForMap(agentItinerary?.stops || []),
  ], [foundPlaces, searchResults, selectedTrip, agentItinerary]);

  const itineraryStopsForMap = (agentItinerary?.stops || [])
    .filter((s: ItineraryStop) => s.lat && s.lng)
    .map((s: ItineraryStop) => ({
      lat: s.lat!,
      lng: s.lng!,
      slug: s.slug,
      name: s.name,
    }));

  // Generate trip route coordinates from selected trip stops
  const tripRoute = useMemo(() => {
    if (!selectedTrip || !selectedTrip.stops || selectedTrip.stops.length < 2) {
      return [];
    }
    return selectedTrip.stops
      .filter((stop) => stop.lat && stop.lng)
      .map((stop) => [stop.lng, stop.lat] as [number, number]);
  }, [selectedTrip]);

  const stopsSuggestedDuration = useMemo(() => {
    if (!selectedTrip || !selectedTrip.stops) return 0;
    return selectedTrip.stops.reduce((sum, s) => sum + (s.suggestedDurationMin || 0), 0);
  }, [selectedTrip]);

  return (
    <div className="relative w-full h-screen overflow-hidden">
      {/* Fullscreen Map Background - reserve space for side panels on md+ */}
      <div className="absolute inset-0 z-0 md:left-[400px] md:right-[400px]">
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
          tripRoute={tripRoute}
          onRouteInfo={({ distanceKm, durationMin }) => {
            setRouteDistanceKm(distanceKm);
            setRouteTravelMin(durationMin);
          }}
        />
      </div>

      {/* Perplexity-style Search Bar */}
      <motion.div 
        className="absolute top-4 left-4 right-4 z-20 md:left-[400px] md:right-[400px] md:mx-auto md:w-[600px]"
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <div className="relative">
          <div className="relative flex items-center">
            <Search className="absolute left-4 text-gray-400 h-5 w-5 pointer-events-none" />
            <Input
              type="text"
              placeholder={t("map.searchPlaceholder") }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12 pr-12 h-12 rounded-full shadow-xl border-0 bg-white/95 backdrop-blur-md text-gray-900 placeholder:text-gray-500 focus-visible:ring-2 focus-visible:ring-blue-500"
            />
            {(searchQuery || selectedCategory !== 'all') && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleClearSearch}
                className="absolute right-2 h-8 w-8 rounded-full hover:bg-gray-100"
              >
                <X className="h-4 w-4 text-gray-500" />
              </Button>
            )}
            {isSearching && (
              <Loader2 className="absolute right-12 h-5 w-5 text-blue-500 animate-spin" />
            )}
          </div>
        </div>

        {/* Category Filters - Perplexity style */}
        <motion.div 
          className="mt-3 flex gap-2 overflow-x-auto pb-2 scrollbar-hide"
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          {CATEGORIES.map((category) => {
            const Icon = category.icon;
            const isSelected = selectedCategory === category.id;
            
            return (
              <Button
                key={category.id}
                variant={isSelected ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(category.id)}
                className={`flex items-center gap-2 whitespace-nowrap rounded-full transition-all ${
                  isSelected 
                    ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md' 
                    : 'bg-white/95 backdrop-blur-md hover:bg-gray-50 border-0 shadow-md'
                }`}
              >
                <Icon className="h-4 w-4" />
                {category.label}
              </Button>
            );
          })}
        </motion.div>

{/* Search Results Dropdown */}
        <AnimatePresence>
          {searchResults.length > 0 && (searchQuery || selectedCategory !== 'all') && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute top-24 left-0 right-0 mt-2 bg-white/95 backdrop-blur-md rounded-2xl shadow-xl max-h-[420px] overflow-y-auto"
            >
              <div className="p-3">
                <div className="px-2 py-2 text-sm text-gray-500 flex items-center justify-between">
                  <span>Found {searchResults.length} places</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClearSearch}
                    className="text-xs text-gray-400 hover:text-gray-600"
                  >
                    Clear
                  </Button>
                </div>
                
                {/* Rich Place Cards Grid */}
                <div className="grid grid-cols-2 gap-3 mt-2">
                  {searchResults.slice(0, 6).map((place, index) => (
                    <motion.div
                      key={place.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="relative group"
                    >
                      <PlaceCard
                        id={place.id}
                        name={place.name}
                        tags={place.tags}
                        image_url={undefined} // API doesn't return image_url in list
                        variant="compact"
                        onClick={() => {
                          const mapPlace = transformPlacesForMap([place])[0];
                          if (mapPlace) {
                            setSelectedPlace(mapPlace);
                          }
                        }}
                      />
                      {/* Add to Trip Button Overlay */}
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAddPlaceToTrip(place);
                        }}
                        className="absolute top-2 right-2 h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 hover:bg-white shadow-md"
                        title="Add to Trip"
                      >
                        <Plus className="h-4 w-4 text-blue-600" />
                      </Button>
                    </motion.div>
                  ))}
                </div>
                
                {/* Show more results if available */}
                {searchResults.length > 6 && (
                  <div className="mt-3 text-center">
                    <span className="text-sm text-gray-400">
                      +{searchResults.length - 6} more results
                    </span>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Map Toolbar - Central toggle buttons (Desktop Only) */}
      {/* <div className="hidden md:block">
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
      </div> */}

      {/* Left Panel - Trip List (Desktop Only) */}
      <div className="hidden md:block">
        <CollapsiblePanel
          isOpen={isLeftPanelOpen}
          onClose={() => setIsLeftPanelOpen(false)}
          position="left"
          title="My Trips"
          width="w-[400px]"
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
      </div>

      {/* Right Panel - Itinerary (Desktop Only) */}
      <div className="hidden md:block">
        <CollapsiblePanel
          isOpen={isRightPanelOpen}
          onClose={() => setIsRightPanelOpen(false)}
          position="right"
          title={selectedTrip?.name || "Itinerary"}
          width="w-[400px]"
        >
          <ItineraryColumn
            trip={selectedTrip}
            onEditTrip={handleEditTrip}
            onReorderStops={handleReorderStops}
            totalDurationMin={(stopsSuggestedDuration || 0) + (routeTravelMin || 0)}
            totalDistanceKm={routeDistanceKm ?? selectedTrip?.totalDistanceKm ?? 0}
          />
        </CollapsiblePanel>
      </div>

      {/* Bottom Sheet - Trip & Itinerary (Mobile Only) - Always Visible */}
      <BottomSheet
        isOpen={isBottomSheetExpanded}
        onClose={() => setIsBottomSheetExpanded(false)}
        onOpenChange={setIsBottomSheetExpanded}
        title={selectedTrip?.name || "My Trip"}
        peekHeight={120}
      >
        <div className="px-4 space-y-6">
          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-3">
              My Trips
            </h3>
            <TripListColumn
              trips={trips}
              selectedTripId={selectedTripId}
              onSelectTrip={setSelectedTripId}
              onNewTripClick={handleNewTrip}
              onDeleteTrip={handleDeleteTrip}
              onEditTrip={handleEditTrip}
              onReorderTrips={handleReorderTrips}
            />
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-3">
              Itinerary
            </h3>
            <ItineraryColumn
              trip={selectedTrip}
              onEditTrip={handleEditTrip}
              onReorderStops={handleReorderStops}
              totalDurationMin={(stopsSuggestedDuration || 0) + (routeTravelMin || 0)}
              totalDistanceKm={routeDistanceKm ?? selectedTrip?.totalDistanceKm ?? 0}
            />
          </div>
        </div>
      </BottomSheet>

      {/* Floating Chat Panel */}
      <ChatPanel
        onPlacesFound={handlePlacesFound}
        onAddPlaceToTrip={handleAddPlaceToTrip}
        onItineraryCreated={handleItineraryCreated}
        userLocation={userLocation}
        defaultOpen={isChatOpen}
      />

      {/* New Trip Dialog */}
      <NewTripDialog
        isOpen={isNewTripDialogOpen}
        onClose={() => setIsNewTripDialogOpen(false)}
        onSuccess={handleNewTripSuccess}
        serverUrl={process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:3000"}
        sessionToken={session?.access_token || ""}
      />

      {/* Edit Trip Dialog */}
      <EditTripDialog
        isOpen={editingTrip !== null}
        onClose={() => setEditingTrip(null)}
        onSuccess={fetchSavedTrips}
        trip={editingTrip ? { ...editingTrip, title: editingTrip.name } : null}
        serverUrl={process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:3000"}
        sessionToken={session?.access_token || ""}
      />

      {/* Custom scrollbar styles */}
      <style jsx global>{`
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
}
