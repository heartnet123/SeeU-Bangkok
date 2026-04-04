"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { TripListColumn } from "@/components/planner/TripListColumn";
import { ItineraryColumn } from "@/components/planner/ItineraryColumn";
import { ChatPanel } from "@/components/planner/ChatPanel";
import { ChatHistorySidebar } from "@/components/planner/ChatHistorySidebar";
import MapContainer from "@/components/map/map-container";
import { CollapsiblePanel } from "@/components/map/collapsible-panel";
import { BottomSheet } from "@/components/map/bottom-sheet";
import { PlaceCard } from "@/components/map/place-card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { NewTripDialog } from "@/components/trips/new-trip-dialog";
import { EditTripDialog } from "@/components/trips/edit-trip-dialog";
import { AddTripStopDialog } from "@/components/trips/add-trip-stop-dialog";
import type { Trip, TripStop } from "@/types/trip";
import type { TripDraft, TripDraftStop } from "@/components/planner/chat/types";
import { buildTripDraftSavePayload } from "@/components/planner/chat/lib/trip-draft";
import { nameToSlug } from "@/lib/slug-utils";
import { appendPlaceToTrip, type TripPlaceCandidate } from "@/lib/trip-stop-utils";
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
  Plus,
  MessageSquare,
  Map as MapIcon,
} from "lucide-react";

interface PlaceItem extends TripPlaceCandidate {
  lat?: number;
  lng?: number;
  tags?: string[];
  address?: string;
  image_url?: string;
  price?: number;
}

interface ChatSession {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  metadata: { title?: string };
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value: string | null | undefined): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
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
  const { session, loading } = useAuth();
  const router = useRouter();
  const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:3000";

  const [trips, setTrips] = useState<Trip[]>([]);
  const [isTripsLoading, setIsTripsLoading] = useState(false);
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<
    { lat: number; lng: number } | undefined
  >();
  const [foundPlaces, setFoundPlaces] = useState<PlaceItem[]>([]);
  const [initialPlaces, setInitialPlaces] = useState<PlaceItem[]>([]);
  const [activeTripDraft, setActiveTripDraft] = useState<TripDraft | null>(null);

  // Search and filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<PlaceItem[]>([]);
  const [visiblePlaces, setVisiblePlaces] = useState<PlaceItem[]>([]);

  // Panel visibility states
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<any | null>(null);
  const [isBottomSheetExpanded, setIsBottomSheetExpanded] = useState(true);
  const [isNewTripDialogOpen, setIsNewTripDialogOpen] = useState(false);
  const [isAddStopDialogOpen, setIsAddStopDialogOpen] = useState(false);
  const [isLeftPanelOpen, setIsLeftPanelOpen] = useState(true);
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(true);
  const [editingTrip, setEditingTrip] = useState<Trip | null>(null);
  const [routeDistanceKm, setRouteDistanceKm] = useState<number | null>(null);
  const [routeTravelMin, setRouteTravelMin] = useState<number | null>(null);

  // Left panel tab state
  const [leftPanelTab, setLeftPanelTab] = useState<'trips' | 'history'>('trips');

  // Chat session state
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [isSessionsLoading, setIsSessionsLoading] = useState(false);
  const [chatSessionMessages, setChatSessionMessages] = useState<
    Array<{ role: string; content: string }> | null
  >(null);
  const hasActiveSearch = searchQuery.trim() || selectedCategory !== 'all';

  const selectedTrip = trips.find((t) => t.id === selectedTripId) || null;
  const draftToTrip = useCallback((tripDraft: TripDraft): Trip => ({
    id: "draft",
    name: tripDraft.title,
    date: "Draft",
    totalDurationMin: tripDraft.total_minutes,
    totalDistanceKm: tripDraft.total_distance_km,
    estimatedBudget: 0,
    notes: tripDraft.summary,
    source: "draft",
    warnings: tripDraft.warnings,
    stops: tripDraft.stops.map((stop) => ({
      id: stop.id,
      placeId: stop.place_id,
      name: stop.name,
      address: stop.slug,
      category: ((tripDraft.places.find((place) => place.id === stop.place_id)?.tags?.[0] || "Viewpoint") as TripStop["category"]),
      suggestedDurationMin: stop.suggested_time_min,
      lat: stop.lat || 0,
      lng: stop.lng || 0,
      notes: stop.notes,
      distanceFromPrevKm: stop.distance_from_prev_km,
    })),
  }), []);
  const displayedTrip = useMemo(
    () => (activeTripDraft ? draftToTrip(activeTripDraft) : selectedTrip),
    [activeTripDraft, draftToTrip, selectedTrip]
  );

  const CATEGORIES = useMemo(() => DEFAULT_CATEGORIES.map(c => ({ ...c, label: t(c.key) })), [t]);

  useEffect(() => {
    if (!loading && !session?.access_token) {
      router.replace('/auth/login');
    }
  }, [loading, session, router]);

  if (!loading && !session?.access_token) {
    return null;
  }

  // Fetch saved trips from server
  const fetchSavedTrips = useCallback(async () => {
    if (!session?.access_token) return;
    setIsTripsLoading(true);
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
            placeId: stop.place_id || stop.place?.id,
            name: stop.place?.name || 'Unknown Stop',
            address: stop.place?.name || 'Address unknown',
            category: stop.place?.tags?.[0] || 'Viewpoint',
            suggestedDurationMin: stop.suggested_time_min || 60,
            lat: stop.place?.lat || 0,
            lng: stop.place?.lng || 0,
            notes: stop.notes || '',
            distanceFromPrevKm: stop.distance_from_prev_km || 0,
            image_url: stop.place?.image_url || '',
          })),
          totalDurationMin: trip.total_minutes || 0,
          totalDistanceKm: trip.total_distance_km || 0,
          estimatedBudget: 0,
          notes: '',
          source: 'saved',
        }));

        setTrips(serverTrips);
        if (serverTrips.length > 0 && !selectedTripId) {
          setSelectedTripId(serverTrips[0].id);
        }
      }
    } catch (error) {
      console.error('Error fetching saved trips:', error);
    } finally {
      setIsTripsLoading(false);
    }
  }, [session?.access_token, serverUrl, selectedTripId]);

  // Fetch chat sessions from server
  const fetchChatSessions = useCallback(async () => {
    if (!session?.access_token) return;
    setIsSessionsLoading(true);
    try {
      const response = await fetch(`${serverUrl}/api/sessions`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (response.ok) {
        const data = await response.json();
        if (data.success && Array.isArray(data.sessions)) {
          setChatSessions(
            data.sessions.map((s: any) => ({
              id: s.id,
              createdAt: new Date(s.createdAt),
              updatedAt: new Date(s.updatedAt),
              metadata: s.metadata || {},
            }))
          );
        }
      }
    } catch (error) {
      console.error('Error fetching chat sessions:', error);
    } finally {
      setIsSessionsLoading(false);
    }
  }, [session?.access_token, serverUrl]);

  // Fetch saved trips and chat sessions when user is authenticated
  useEffect(() => {
    if (session?.access_token) {
      fetchSavedTrips();
      fetchChatSessions();
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

  // Fetch initial places on mount
  useEffect(() => {
    const fetchInitialPlaces = async () => {
      try {
        const response = await fetch(`${serverUrl}/api/places?limit=50`);

        if (!response.ok) {
          throw new Error("Failed to fetch initial places");
        }

        const data = await response.json();

        if (data.success && Array.isArray(data.data)) {
          setInitialPlaces(data.data.map((p: any) => ({
            id: p.id,
            name: p.name,
            slug: p.slug || p.id,
            lat: p.lat,
            lng: p.lng,
            tags: p.tags || [],
            price: p.price,
            description: p.description || '',
            address: p.address || p.name || 'Address not available',
            image_url: p.image_url || '',
          })));
        }
      } catch (error) {
        console.error("Error fetching initial places:", error);
      }
    };

    fetchInitialPlaces();
  }, []);

  // Debounced search function
  const performSearch = useCallback(async (query: string, category: string) => {
    if (!query.trim() && category === 'all') {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
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
          description: p.description || '',
          address: p.address || p.name || 'Address not available',
          image_url: p.image_url || '',
        })));
      }
    } catch (error) {
      console.error('Search error:', error);
      toast.error(t("errors.searchFailed"));
    } finally {
      setIsSearching(false);
    }
  }, [locale, serverUrl, t]);

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

  const handleTripDraftCreated = (tripDraft: TripDraft) => {
    setActiveTripDraft(tripDraft);
    console.log("Received trip draft from agent:", tripDraft);
  };

  const handleAddPlaceToTrip = useCallback((placesToAdd: PlaceItem | TripPlaceCandidate | Array<PlaceItem | TripPlaceCandidate>) => {
    const items = Array.isArray(placesToAdd) ? placesToAdd : [placesToAdd];
    setTrips((prevTrips) => {
      let updatedTrips = prevTrips;

      for (const place of items) {
        const result = appendPlaceToTrip({
          trips: updatedTrips,
          selectedTripId,
          place,
        });

        if (result.status === "missing-trip") {
          toast.error(t("errors.selectTrip"));
          return prevTrips;
        }

        if (result.status === "missing-location") {
          toast.error(t("errors.noLocation"));
          return prevTrips;
        }

        if (result.status === "duplicate") {
          toast.info(`${place.name} is already in this trip`);
          continue;
        }

        const addedMessage =
          t("actions.addedToTrip") || "{place} added to {trip}";
        const tripName = result.tripName || "this trip";
        toast.success(
          addedMessage
            .replace("{place}", place.name)
            .replace("{trip}", tripName)
        );

        updatedTrips = result.trips;
      }

      return updatedTrips;
    });
  }, [selectedTripId, t]);

  const handleNewTrip = () => {
    setIsNewTripDialogOpen(true);
  };

  const handleNewTripSuccess = () => {
    // Refetch trips from the server
    fetchSavedTrips();
    setIsNewTripDialogOpen(false);
  };

  const handleOpenAddStopDialog = useCallback((tripId: string) => {
    setSelectedTripId(tripId);
    setIsAddStopDialogOpen(true);
  }, []);

  const handleDeleteStop = useCallback((tripId: string, stopId: string) => {
    if (tripId === "draft" && activeTripDraft) {
      setActiveTripDraft({
        ...activeTripDraft,
        stops: activeTripDraft.stops.filter((s) => s.id !== stopId),
      });
    } else {
      setTrips((prev) =>
        prev.map((t) => {
          if (t.id !== tripId) return t;
          return {
            ...t,
            stops: t.stops.filter((s) => s.id !== stopId),
          };
        })
      );
    }
    toast.success("Stop removed from itinerary");
  }, [activeTripDraft]);

  const handleSelectStop = useCallback((stop: TripStop) => {
    const mapPlace = {
      id: stop.id,
      name: stop.name,
      description: `${stop.category} - ${stop.address}`,
      tags: [stop.category],
      lat: stop.lat,
      lng: stop.lng,
      address: stop.address,
      price: 0,
      image_url: stop.image_url || "",
      slug: stop.placeId || '',
    };
    setSelectedPlace(mapPlace);
  }, []);

  const handleDeleteTrip = async (tripId: string) => {
    if (!confirm("Are you sure you want to delete this trip?")) return;
    if (session?.access_token) {
      try {
        await fetch(`${serverUrl}/api/itineraries/${tripId}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
      } catch {
        toast.error("Failed to delete trip from server");
        return;
      }
    }
    setTrips((prev) => prev.filter((t) => t.id !== tripId));
    if (tripId === selectedTripId) {
      const remaining = trips.filter((t) => t.id !== tripId);
      setSelectedTripId(remaining[0]?.id || null);
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
    if (tripId === "draft" && activeTripDraft) {
      const idToStop = new Map(activeTripDraft.stops.map((stop) => [stop.id, stop] as const));
      const reordered = orderedStopIds
        .map((id) => idToStop.get(id))
        .filter((stop): stop is TripDraftStop => Boolean(stop));
      const remainder = activeTripDraft.stops.filter((stop) => !orderedStopIds.includes(stop.id));
      setActiveTripDraft({
        ...activeTripDraft,
        stops: [...reordered, ...remainder],
      });
      return;
    }
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

  const handleSaveTripToServer = useCallback(async (tripId: string, orderedStops: TripStop[]) => {
    if (!session?.access_token) {
      toast.error("Please log in to save trips");
      return;
    }
    try {
      const isDraftSave = tripId === "draft" && activeTripDraft;
      const trip = isDraftSave ? displayedTrip : trips.find(t => t.id === tripId);
      if (!trip) return;

      const res = await fetch(`${serverUrl}/api/itineraries${isDraftSave ? "" : `/${tripId}`}`, {
        method: isDraftSave ? "POST" : "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(
          isDraftSave && activeTripDraft
            ? buildTripDraftSavePayload({
                ...activeTripDraft,
                stops: activeTripDraft.stops.map((stop) => {
                  const orderedStop = orderedStops.find((item) => item.id === stop.id);
                  return orderedStop
                    ? {
                        ...stop,
                        suggested_time_min: orderedStop.suggestedDurationMin,
                      }
                    : stop;
                }),
              })
            : {
                title: trip.name,
                total_minutes: trip.totalDurationMin,
                total_distance_km: trip.totalDistanceKm,
                stops: orderedStops.map(s => ({
                  ...(isUuid(s.placeId) ? { place_id: s.placeId } : { slug: nameToSlug(s.name) }),
                  suggested_time_min: s.suggestedDurationMin,
                  notes: s.notes ?? "",
                  distance_from_prev_km: s.distanceFromPrevKm,
                })),
              }
        ),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error ?? `Error ${res.status}`);
      toast.success(isDraftSave ? "Trip draft saved!" : "Trip saved!");
      if (isDraftSave) {
        setActiveTripDraft(null);
        if (data.data?.id) {
          setSelectedTripId(data.data.id);
        }
      }
      fetchSavedTrips();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to save trip");
    }
  }, [session?.access_token, serverUrl, trips, fetchSavedTrips, activeTripDraft, displayedTrip]);

  const handleClearSearch = () => {
    setSearchQuery("");
    setSelectedCategory("all");
    setSearchResults([]);
  };

  // If user unfocuses selected trip in Trips tab, reset filters so all pins are shown
  useEffect(() => {
    if (leftPanelTab === 'trips' && !selectedTripId) {
      setSearchQuery("");
      setSelectedCategory("all");
      setSearchResults([]);
    }
  }, [leftPanelTab, selectedTripId]);

  // Chat session handlers
  const handleSelectSession = useCallback(async (sessionId: string) => {
    if (!session?.access_token) return;
    try {
      const response = await fetch(`${serverUrl}/api/sessions/${sessionId}/messages`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (response.ok) {
        const data = await response.json();
        if (data.success && Array.isArray(data.messages)) {
          setActiveSessionId(sessionId);
          setChatSessionMessages(data.messages);
          setIsChatOpen(true);
        }
      }
    } catch (error) {
      console.error('Error loading session messages:', error);
      toast.error('Failed to load chat history');
    }
  }, [session?.access_token, serverUrl]);

  const handleNewSession = useCallback(() => {
    setActiveSessionId(null);
    setChatSessionMessages(null);
  }, []);

  const handleDeleteSession = useCallback(async (sessionId: string) => {
    if (!session?.access_token) return;
    try {
      const response = await fetch(`${serverUrl}/api/sessions/${sessionId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (response.ok) {
        setChatSessions((prev) => prev.filter((s) => s.id !== sessionId));
        if (activeSessionId === sessionId) {
          setActiveSessionId(null);
          setChatSessionMessages(null);
        }
        toast.success('Chat deleted');
      }
    } catch (error) {
      console.error('Error deleting session:', error);
      toast.error('Failed to delete chat');
    }
  }, [activeSessionId, session?.access_token, serverUrl]);

  const handleSessionCreated = useCallback((id: string | null) => {
    setActiveSessionId(id);
    // Refresh session list after a short delay to allow backend to save
    if (id) {
      setTimeout(() => {
        fetchChatSessions();
      }, 1500);
    }
  }, [fetchChatSessions]);

  // Transform places for map display
  const transformPlacesForMap = (places: PlaceItem[]): any[] => {
    return places
      .filter((place) => place.lat && place.lng)
      .map((place) => ({
        id: place.id,
        name: place.name,
        description: place.description || place.tags?.join(", ") || "No description available",
        tags: place.tags || [],
        lat: place.lat!,
        lng: place.lng!,
        address: place.address || "Address not available",
        price: place.price || 0,
        image_url: place.image_url || "",
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
        image_url: stop.image_url || "",
        slug: nameToSlug(stop.name),
      }));
  };

  const transformTripDraftStopsForMap = (stops: TripDraftStop[]): any[] => {
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
        image_url: (stop as any).image_url || "",
        slug: stop.slug,
      }));
  };

  const enrichedTripDraft = useMemo(() => {
    if (!activeTripDraft) return null;

    return {
      ...activeTripDraft,
      stops: activeTripDraft.stops.map((stop) => {
        // Try to find the location details in our loaded places
        const place =
          foundPlaces.find((p) => p.name === stop.name || p.id === stop.place_id || p.slug === stop.slug) ||
          initialPlaces.find((p) => p.name === stop.name || p.id === stop.place_id || p.slug === stop.slug) ||
          searchResults.find((p) => p.name === stop.name || p.id === stop.place_id || p.slug === stop.slug);

        return {
          ...stop,
          lat: place?.lat ?? stop.lat,
          lng: place?.lng ?? stop.lng,
          slug: place?.slug ?? stop.slug ?? stop.name,
          image_url: place?.image_url ?? "",
        };
      })
    };
  }, [activeTripDraft, foundPlaces, initialPlaces, searchResults]);

  const tripDraftStopsForMap = useMemo(
    () => enrichedTripDraft?.stops
      ? transformTripDraftStopsForMap(enrichedTripDraft.stops)
      : [],
    [enrichedTripDraft]
  );

  const allPlacesForMap = useMemo(() => {
    if (enrichedTripDraft) {
      return tripDraftStopsForMap;
    }

    // In Trips tab: if a trip is selected, focus only that trip's pins.
    // If no trip is selected (unfocused), show all pins.
    if (leftPanelTab === 'trips' && selectedTrip) {
      return transformTripStopsForMap(selectedTrip);
    }

    const placesToShow = hasActiveSearch ? searchResults : initialPlaces;

    return [
      ...transformPlacesForMap(foundPlaces),
      ...transformPlacesForMap(placesToShow),
      ...transformTripStopsForMap(selectedTrip),
    ];
  }, [foundPlaces, searchResults, initialPlaces, searchQuery, selectedCategory, selectedTrip, enrichedTripDraft, tripDraftStopsForMap, leftPanelTab]);

  // Context places that can be shared with chat (only map-visible place set)
  const chatContextPlaces = useMemo(
    () => visiblePlaces.slice(0, 20).map((p) => ({ id: p.id, name: p.name, slug: p.slug, tags: p.tags })),
    [visiblePlaces]
  );

  // Generate trip route coordinates from selected trip stops
  const tripRoute = useMemo(() => {
    if (enrichedTripDraft) {
      return [];
    }

    if (!displayedTrip || !displayedTrip.stops || displayedTrip.stops.length < 2) {
      return [];
    }
    return displayedTrip.stops
      .filter((stop) => stop.lat && stop.lng)
      .map((stop) => [stop.lng, stop.lat] as [number, number]);
  }, [displayedTrip, enrichedTripDraft]);

  const stopsSuggestedDuration = useMemo(() => {
    if (!displayedTrip || !displayedTrip.stops) return 0;
    return displayedTrip.stops.reduce((sum, s) => sum + (s.suggestedDurationMin || 0), 0);
  }, [displayedTrip]);

  return (
    <div className="relative w-full h-screen overflow-hidden">
      {/* Fullscreen Map Background - reserve space for side panels on md+ */}
      <div className="absolute inset-0 z-0 md:left-[400px] md:right-[400px]">
        <MapContainer
          places={allPlacesForMap}
          selectedPlace={selectedPlace}
          onPlaceSelect={setSelectedPlace}
          onPlaceDeselect={() => setSelectedPlace(null)}
          onVisiblePlacesChange={setVisiblePlaces}
          userLocation={
            userLocation ? [userLocation.lng, userLocation.lat] : undefined
          }
          initialCenter={[100.5018, 13.7563]}
          initialZoom={12}
          previewItinerary={enrichedTripDraft}
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
              placeholder={t("map.searchPlaceholder")}
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
                className={`flex items-center gap-2 whitespace-nowrap rounded-full transition-all ${isSelected
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
          {searchResults.length > 0 && hasActiveSearch && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute top-[calc(100%+0.75rem)] left-0 right-0 mt-0 overflow-hidden rounded-2xl bg-white/95 shadow-xl backdrop-blur-md max-h-[min(48vh,420px)] overflow-y-auto md:max-h-[420px]"
            >
              <div className="p-3 sm:p-4">
                <div className="px-1 py-2 text-sm text-gray-500 flex items-center justify-between gap-3">
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

                {/* Search results adapt from single column on mobile to grid on desktop */}
                <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
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
                        className="absolute top-2 right-2 h-9 min-w-9 px-2 sm:h-7 sm:w-7 sm:min-w-7 sm:p-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity bg-white/95 hover:bg-white shadow-md"
                        title="Add to Trip"
                        aria-label={`Add ${place.name} to trip`}
                      >
                        <Plus className="h-4 w-4 text-blue-600" />
                        <span className="sr-only sm:not-sr-only sm:hidden">Add</span>
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

      {/* Left Panel - Trip List & Chat History (Desktop Only) */}
      <div className="hidden md:block">
        <CollapsiblePanel
          isOpen={isLeftPanelOpen}
          onClose={() => setIsLeftPanelOpen(false)}
          position="left"
          title={leftPanelTab === 'trips' ? "My Trips" : "Chat History"}
          width="w-[400px]"
        >
          {/* Tab switcher */}
          <div className="flex gap-1 mb-4 p-1 bg-slate-100 rounded-lg">
            <button
              onClick={() => setLeftPanelTab('trips')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-colors ${leftPanelTab === 'trips'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
                }`}
            >
              <MapIcon className="h-4 w-4" />
              My Trips
            </button>
            <button
              onClick={() => {
                setLeftPanelTab('history');
                fetchChatSessions();
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-colors ${leftPanelTab === 'history'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
                }`}
            >
              <MessageSquare className="h-4 w-4" />
              Chat History
            </button>
          </div>

          {leftPanelTab === 'trips' ? (
            <TripListColumn
              trips={trips}
              selectedTripId={selectedTripId}
              onSelectTrip={(tripId) => {
                setSelectedTripId(tripId);
                setActiveTripDraft(null);
              }}
              onNewTripClick={handleNewTrip}
              onDeleteTrip={handleDeleteTrip}
              onEditTrip={handleEditTrip}
              onReorderTrips={handleReorderTrips}
            />
          ) : (
            <ChatHistorySidebar
              sessions={chatSessions}
              activeSessionId={activeSessionId}
              onSelectSession={handleSelectSession}
              onNewSession={handleNewSession}
              onDeleteSession={handleDeleteSession}
              isLoading={isSessionsLoading}
            />
          )}
        </CollapsiblePanel>
      </div>

      {/* Right Panel - Itinerary (Desktop Only) */}
      <div className="hidden md:block">
        <CollapsiblePanel
          isOpen={isRightPanelOpen}
          onClose={() => setIsRightPanelOpen(false)}
          position="right"
          title={displayedTrip?.name || "Itinerary"}
          width="w-[400px]"
        >
          <ItineraryColumn
            trip={displayedTrip}
            onEditTrip={displayedTrip?.source === "draft" ? undefined : handleEditTrip}
            onAddStop={displayedTrip?.source === "saved" ? handleOpenAddStopDialog : undefined}
            onDeleteStop={handleDeleteStop}
            onSelectStop={handleSelectStop}
            onSaveTrip={handleSaveTripToServer}
            onReorderStops={handleReorderStops}
            isLoading={isTripsLoading}
            totalDurationMin={(stopsSuggestedDuration || 0) + (routeTravelMin || 0)}
            totalDistanceKm={routeDistanceKm ?? displayedTrip?.totalDistanceKm ?? 0}
            mode={displayedTrip?.source === "draft" ? "draft" : "saved"}
            warnings={displayedTrip?.warnings ?? []}
          />
        </CollapsiblePanel>
      </div>

      {/* Bottom Sheet - Trip & Itinerary (Mobile Only) - Always Visible */}
      <BottomSheet
        isOpen={isBottomSheetExpanded}
        onClose={() => setIsBottomSheetExpanded(false)}
        onOpenChange={setIsBottomSheetExpanded}
        title={leftPanelTab === 'history' ? 'Chat History' : displayedTrip?.name || 'My Trip'}
        peekHeight={120}
      >
        <div className="px-4 space-y-6">
          <div className="flex gap-1 mb-4 p-1 bg-slate-100 rounded-lg">
            <button
              onClick={() => setLeftPanelTab('trips')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-colors ${leftPanelTab === 'trips'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
                }`}
            >
              <MapIcon className="h-4 w-4" />
              My Trips
            </button>
            <button
              onClick={() => {
                setLeftPanelTab('history');
                fetchChatSessions();
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-colors ${leftPanelTab === 'history'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
                }`}
            >
              <MessageSquare className="h-4 w-4" />
              Chat History
            </button>
          </div>

          {leftPanelTab === 'trips' ? (
            <div className="space-y-6">
              <div>
                <TripListColumn
                  trips={trips}
                  selectedTripId={selectedTripId}
                  onSelectTrip={(tripId) => {
                    setSelectedTripId(tripId);
                    setActiveTripDraft(null);
                  }}
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
                  trip={displayedTrip}
                  onEditTrip={displayedTrip?.source === "draft" ? undefined : handleEditTrip}
                  onAddStop={displayedTrip?.source === "saved" ? handleOpenAddStopDialog : undefined}
                  onDeleteStop={handleDeleteStop}
                  onSelectStop={handleSelectStop}
                  onSaveTrip={handleSaveTripToServer}
                  onReorderStops={handleReorderStops}
                  isLoading={isTripsLoading}
                  totalDurationMin={(stopsSuggestedDuration || 0) + (routeTravelMin || 0)}
                  totalDistanceKm={routeDistanceKm ?? displayedTrip?.totalDistanceKm ?? 0}
                  mode={displayedTrip?.source === "draft" ? "draft" : "saved"}
                  warnings={displayedTrip?.warnings ?? []}
                />
              </div>
            </div>
          ) : (
            <div className="h-full min-h-[60vh]">
              <ChatHistorySidebar
                sessions={chatSessions}
                activeSessionId={activeSessionId}
                onSelectSession={handleSelectSession}
                onNewSession={handleNewSession}
                onDeleteSession={handleDeleteSession}
                isLoading={isSessionsLoading}
              />
            </div>
          )}
        </div>
      </BottomSheet>

      {/* Floating Chat Panel */}
      <ChatPanel
        onPlacesFound={handlePlacesFound}
        onAddPlaceToTrip={handleAddPlaceToTrip}
        onTripDraftCreated={handleTripDraftCreated}
        onPreviewTripDraft={setActiveTripDraft}
        userLocation={userLocation}
        defaultOpen={isChatOpen}
        sessionId={activeSessionId}
        authToken={session?.access_token}
        onSessionCreated={handleSessionCreated}
        sessionMessages={chatSessionMessages}
        contextPlaces={chatContextPlaces}
      />

      {/* New Trip Dialog */}
      <NewTripDialog
        isOpen={isNewTripDialogOpen}
        onClose={() => setIsNewTripDialogOpen(false)}
        onSuccess={handleNewTripSuccess}
        serverUrl={process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:3000"}
        sessionToken={session?.access_token || ""}
      />

      <AddTripStopDialog
        isOpen={isAddStopDialogOpen}
        onClose={() => setIsAddStopDialogOpen(false)}
        onAddPlace={handleAddPlaceToTrip}
        serverUrl={process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:3000"}
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
