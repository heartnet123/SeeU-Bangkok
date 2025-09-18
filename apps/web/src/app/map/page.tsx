"use client";

import { useState, useEffect, useRef } from "react";
// import dynamic from 'next/dynamic'; // Disabled to prevent Mapbox loading
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Search, Filter, MapPin, Navigation, Layers, Send, MessageSquare } from "lucide-react";
import { motion } from "motion/react";

// MapContainer dynamically import disabled to prevent Mapbox usage
// const MapContainer = dynamic(() => import('@/components/map/map-container'), { ... });

// Interface definitions
interface Place {
  id: string;
  name: string;
  description: string;
  tags: string[];
  lat: number;
  lng: number;
  address: string;
  price: number;
  image_url: string;
  slug: string;
}

interface MapFilters {
  search: string;
  categories: string[];
  priceRange: [number, number];
  distance: number;
}

type ChatMessage = {
  id: string;
  role: "user" | "system";
  content: string;
  time: string;
};

export default function MapPage() {
  const [places, setPlaces] = useState<Place[]>([]);
  const [filteredPlaces, setFilteredPlaces] = useState<Place[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter states
  const [filters, setFilters] = useState<MapFilters>({
    search: "",
    categories: [],
    priceRange: [0, 1000],
    distance: 10,
  });

  const [showFilters, setShowFilters] = useState(false);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);

  // --- Chat state (NEW) ---
  const [chatInput, setChatInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: crypto.randomUUID(),
      role: "system",
      content:
        "Chat is ready. Type your message and press Enter or click Send. (No bot replies yet.)",
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    const text = chatInput.trim();
    if (!text) return;
    const msg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    setMessages((prev) => [...prev, msg]);
    setChatInput("");
  };

  const handleKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Fetch places data
  useEffect(() => {
    const fetchPlaces = async () => {
      try {
        setLoading(true);
        const response = await fetch(`http://localhost:3000/api/places?limit=30`);

        if (!response.ok) {
          throw new Error("Failed to fetch places");
        }

        const result = await response.json();

        if (result.success) {
          const placesWithCoords = result.data.filter(
            (place: Place) =>
              place.lat &&
              place.lng &&
              typeof place.lat === "number" &&
              typeof place.lng === "number" &&
              !isNaN(place.lat) &&
              !isNaN(place.lng)
          );

          setPlaces(placesWithCoords);
          setFilteredPlaces(placesWithCoords);
        } else {
          throw new Error(result.message || "Failed to fetch places");
        }
      } catch (err) {
        console.error("Error fetching places:", err);
        setError(err instanceof Error ? err.message : "Failed to load places");
      } finally {
        setLoading(false);
      }
    };

    fetchPlaces();
  }, []);

  // Apply filters
  useEffect(() => {
    let filtered = [...places];

    // Search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(
        (place) =>
          place.name.toLowerCase().includes(searchLower) ||
          place.description.toLowerCase().includes(searchLower) ||
          place.tags.some((tag) => tag.toLowerCase().includes(searchLower))
      );
    }

    // Category filter
    if (filters.categories.length > 0) {
      filtered = filtered.filter((place) =>
        filters.categories.some((category) =>
          place.tags.some((tag) => tag.toLowerCase().includes(category.toLowerCase()))
        )
      );
    }

    // Price filter
    filtered = filtered.filter(
      (place) => place.price >= filters.priceRange[0] && place.price <= filters.priceRange[1]
    );

    setFilteredPlaces(filtered);
  }, [places, filters]);

  // Get user location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation([position.coords.longitude, position.coords.latitude]);
        },
        (error) => {
          console.warn("Geolocation error:", error);
        }
      );
    }
  }, []);

  const handlePlaceSelect = (place: Place) => {
    setSelectedPlace(place);
  };

  const handlePlaceDeselect = () => {
    setSelectedPlace(null);
  };

  const handleSearchChange = (value: string) => {
    setFilters((prev) => ({ ...prev, search: value }));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-xl text-gray-600">Loading Bangkok places...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="p-8 max-w-md mx-auto">
          <CardContent className="text-center">
            <div className="text-red-500 mb-4">
              <MapPin className="w-16 h-16 mx-auto" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Failed to Load Map</h2>
            <p className="text-gray-600 mb-4">{error}</p>
            <Button onClick={() => window.location.reload()}>Try Again</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-100 p-4">
      {/* Wrapper: map + chat side-by-side on md+, stacked on small screens */}
      <div className="relative w-full max-w-6xl">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Map panel (unchanged UI) */}
          <div className="relative w-full md:w-[800px] h-[600px] overflow-hidden rounded-lg shadow-lg bg-white">
            {/* Results Counter */}
            <motion.div
              className="absolute bottom-2 left-2 z-10"
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <Card className="bg-white/90 backdrop-blur-sm shadow-lg">
                <CardContent className="p-2">
                  <div className="flex items-center gap-1 text-xs">
                    <MapPin className="w-3 h-3 text-orange-500" />
                    <span className="font-medium text-orange-600">Map Paused (Saving Costs)</span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Map Container - Temporarily disabled to save Mapbox costs */}
            <div className="w-full h-full">
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
                <div className="text-center p-8">
                  <div className="mb-4">
                    <MapPin className="w-16 h-16 mx-auto text-gray-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-700 mb-2">Map Temporarily Disabled</h3>
                  <p className="text-gray-500 mb-4 max-w-sm">
                    Mapbox map loading has been paused to control usage costs.
                  </p>
                  <div className="text-sm text-gray-400">
                    <p>Map Size: 800x600 pixels</p>
                    <p>Center: Bangkok, Thailand</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Chat sidebar (NEW) */}
          <motion.div
            className="w-full md:w-[340px]"
            initial={{ x: 40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: 0.4 }}
          >
            <Card className="h-[600px] rounded-lg shadow-lg bg-white flex flex-col">
              <CardContent className="px-4 py-0 h-full flex flex-col">
                {/* Header */}
                <div className="flex items-center gap-2 mb-3">
                  <MessageSquare className="w-5 h-5 text-blue-600" />
                  <h4 className="font-semibold text-gray-800">Chatbot</h4>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                  {messages.map((m) => (
                    <div
                      key={m.id}
                      className={`block w-fit max-w-[85%] break-words whitespace-pre-wrap text-sm rounded-2xl px-3 py-2 ${
                        m.role === "user"
                          ? "ml-auto bg-blue-600 text-white"
                          : "mr-auto bg-gray-100 text-gray-800"
                      }`}
                      title={m.time}
                    >
                      {m.content}
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>

                {/* Input */}
                <div className="mt-3 flex gap-2">
                  <Input
                    placeholder="Type a message..."
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="!text-gray-900 placeholder:!text-gray-400 bg-white dark:bg-white"
                  />
                  <Button onClick={handleSend} className="shrink-0" title="Send">
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
}