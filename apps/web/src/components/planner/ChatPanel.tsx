"use client";

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  MessageSquare, 
  Send, 
  Loader2, 
  X, 
  Minimize2, 
  Maximize2, 
  Save, 
  Check, 
  MapPin,
  Plus,
  ExternalLink,
  Navigation,
  Clock,
  Camera,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { nameToSlug } from "@/lib/slug-utils";
import { motion, AnimatePresence } from "motion/react";
import { useRouter } from "next/navigation";

type ChatEvent =
  | { type: "message"; text: string }
  | { type: "status"; text: string }
  | { type: "suggestions"; data: any }
  | { type: "error"; text: string }
  | { type: "done" }
  | { type: "tools"; data: any }
  | { type: "context"; data: any }
  | { type: "itinerary"; data: any };

interface PlaceItem {
  id: string;
  name: string;
  slug: string;
  lat?: number;
  lng?: number;
  tags?: string[];
  price?: number;
  image_url?: string;
}

interface ChatPanelProps {
  onPlacesFound?: (places: PlaceItem[]) => void;
  onAddPlaceToTrip?: (place: PlaceItem) => void;
  onItineraryCreated?: (itinerary: any) => void;
  userLocation?: { lat: number; lng: number };
  defaultOpen?: boolean;
}

export function ChatPanel({ onPlacesFound, onAddPlaceToTrip, onItineraryCreated, userLocation, defaultOpen = false }: ChatPanelProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [isMinimized, setIsMinimized] = useState(false);
  const [input, setInput] = useState("");
  const [events, setEvents] = useState<ChatEvent[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isSavingItinerary, setIsSavingItinerary] = useState(false);
  const [isItinerarySaved, setIsItinerarySaved] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { session } = useAuth();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [events]);

  const suggestions = useMemo<PlaceItem[]>(() => {
    const ev = [...events].reverse().find((e) => e.type === "suggestions") as any;
    return ev?.data?.places || [];
  }, [events]);

  const toolsUsed = useMemo(() => {
    const ev = [...events].reverse().find((e) => e.type === "tools") as any;
    return ev?.data?.tools || [];
  }, [events]);

  const contextInfo = useMemo(() => {
    const ev = [...events].reverse().find((e) => e.type === "context") as any;
    return ev?.data || null;
  }, [events]);

  const itineraryInfo = useMemo(() => {
    const ev = [...events].reverse().find((e) => e.type === "itinerary") as any;
    return ev?.data || null;
  }, [events]);

  useEffect(() => {
    if (suggestions.length > 0 && onPlacesFound) {
      onPlacesFound(suggestions);
    }
  }, [suggestions, onPlacesFound]);

  useEffect(() => {
    if (itineraryInfo && onItineraryCreated) {
      onItineraryCreated(itineraryInfo);
      setIsItinerarySaved(false);
    }
  }, [itineraryInfo, onItineraryCreated]);

  const stop = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    setIsStreaming(false);
  }, []);

  const start = useCallback(
    async (endpoint: "chat" | "agent" = "chat") => {
      if (isStreaming) stop();
      setEvents([]);
      setIsStreaming(true);
      const controller = new AbortController();
      controllerRef.current = controller;

      try {
        const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:3000";
        const payload: any = {
          messages: [
            { role: "system", content: "You are a helpful Bangkok travel assistant." },
            { role: "user", content: input },
          ],
          stream: true,
        };
        if (userLocation) payload.userLocation = userLocation;

        const res = await fetch(`${serverUrl}/api/${endpoint}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        if (!res.ok || !res.body) {
          setEvents((prev) => [...prev, { type: "error", text: `Request failed (${res.status})` }]);
          setIsStreaming(false);
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let buffer = "";

        const flush = () => {
          const chunks = buffer.split("\n\n");
          buffer = chunks.pop() || "";
          for (const chunk of chunks) {
            const lines = chunk.split(/\n|\r\n?/).filter(Boolean);
            let event: string | null = null;
            let data: string[] = [];
            for (const line of lines) {
              if (line.startsWith("event:")) event = line.slice(6).trim();
              if (line.startsWith("data:")) data.push(line.slice(5).trim());
            }
            const joined = data.join("\n");
            if (!event) continue;
            switch (event) {
              case "message":
                setEvents((prev) => [...prev, { type: "message", text: joined }]);
                break;
              case "status":
                setEvents((prev) => [...prev, { type: "status", text: joined }]);
                break;
              case "suggestions":
                try {
                  const payload = JSON.parse(joined);
                  setEvents((prev) => [...prev, { type: "suggestions", data: payload }]);
                } catch (e) {}
                break;
              case "tools":
                try {
                  const payload = JSON.parse(joined);
                  setEvents((prev) => [...prev, { type: "tools", data: payload }]);
                } catch (e) {}
                break;
              case "context":
                try {
                  const payload = JSON.parse(joined);
                  setEvents((prev) => [...prev, { type: "context", data: payload }]);
                } catch (e) {}
                break;
              case "itinerary":
                try {
                  const payload = JSON.parse(joined);
                  setEvents((prev) => [...prev, { type: "itinerary", data: payload }]);
                } catch (e) {}
                break;
              case "error":
                setEvents((prev) => [...prev, { type: "error", text: joined }]);
                break;
              case "done":
                setEvents((prev) => [...prev, { type: "done" }]);
                setIsStreaming(false);
                break;
            }
          }
        };

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          flush();
        }
        buffer += decoder.decode();
        flush();
      } catch (e: any) {
        if (e?.name !== "AbortError") {
          setEvents((prev) => [...prev, { type: "error", text: e?.message || "Stream error" }]);
        }
      } finally {
        setIsStreaming(false);
      }
    },
    [isStreaming, stop, input, userLocation]
  );

  const handleSend = useCallback(() => {
    if (!input.trim() || isStreaming) return;
    start("agent");
  }, [input, isStreaming, start]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const handleSaveItinerary = useCallback(async () => {
    if (!itineraryInfo || !session?.access_token) return;

    setIsSavingItinerary(true);
    try {
      const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:3000";
      const payload = {
        title: itineraryInfo.title || "My Trip",
        stops: (itineraryInfo.stops || []).map((s: any) => ({
          slug: s.slug,
          suggested_time_min: s.suggested_time_min,
          notes: s.notes || "",
        })),
      };

      const res = await fetch(`${serverUrl}/api/itineraries`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
      });

      const contentType = res.headers.get("content-type") || "";
      const json = contentType.includes("application/json")
        ? await res.json()
        : { success: false, error: (await res.text()) || "Bad response" };

      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to save itinerary");
      }

      setEvents((prev) => [
        ...prev,
        { type: "message", text: "✅ Itinerary saved successfully! Check your Saved Trips." },
      ]);
      setIsItinerarySaved(true);
    } catch (e: any) {
      setEvents((prev) => [
        ...prev,
        { type: "error", text: `Failed to save itinerary: ${e?.message || "Unknown error"}` },
      ]);
    } finally {
      setIsSavingItinerary(false);
    }
  }, [itineraryInfo, session]);

  const handleViewPlace = useCallback((slug: string) => {
    router.push(`/places/${slug}`);
  }, [router]);

  if (!isOpen) {
    return (
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 20 }}
      >
        <Button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 rounded-full w-14 h-14 shadow-xl z-50 bg-blue-600 hover:bg-blue-700"
          size="icon"
        >
          <MessageSquare className="w-6 h-6" />
        </Button>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 100, opacity: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
      <Card
        className={`fixed bottom-6 right-6 shadow-2xl z-50 transition-all border-0 overflow-hidden ${
          isMinimized ? "w-80 h-16" : "w-[420px] h-[650px]"
        }`}
      >
        {/* Header */}
        <CardHeader className="flex flex-row items-center justify-between py-3 px-4 border-b bg-gradient-to-r from-blue-600 to-purple-600 text-white">
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Trip Assistant
          </CardTitle>
          <div className="flex gap-1">
            <Button 
              variant="ghost" 
              size="icon" 
              className="w-7 h-7 text-white hover:bg-white/20 hover:text-white" 
              onClick={() => setIsMinimized(!isMinimized)}
            >
              {isMinimized ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="w-7 h-7 text-white hover:bg-white/20 hover:text-white" 
              onClick={() => setIsOpen(false)}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>

        <AnimatePresence>
          {!isMinimized && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="flex flex-col h-[calc(100%-3.5rem)]"
            >
              {/* Messages */}
              <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
                {events.length === 0 && (
                  <motion.div 
                    className="text-center py-8"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center">
                      <MessageSquare className="w-8 h-8 text-blue-600" />
                    </div>
                    <p className="text-gray-700 font-medium mb-2">Hi! I'm your Trip Assistant</p>
                    <p className="text-gray-500 text-sm mb-4">
                      Ask me about places in Bangkok or let me help you plan your trip!
                    </p>
                    <div className="flex flex-wrap gap-2 justify-center">
                      {["Show me temples", "Find cafes near me", "Plan a day trip"].map((suggestion) => (
                        <Button
                          key={suggestion}
                          variant="outline"
                          size="sm"
                          className="text-xs"
                          onClick={() => {
                            setInput(suggestion);
                            start("agent");
                          }}
                        >
                          {suggestion}
                        </Button>
                      ))}
                    </div>
                  </motion.div>
                )}

{/* Messages - Enhanced styling */}
                {events
                  .filter((e) => e.type === "message")
                  .map((e, i) => (
                    <motion.div 
                      key={i} 
                      className="p-4 rounded-2xl bg-gradient-to-br from-blue-50 to-purple-50 text-gray-800 shadow-sm border border-blue-100/50"
                      initial={{ opacity: 0, x: -20, scale: 0.95 }}
                      animate={{ opacity: 1, x: 0, scale: 1 }}
                      transition={{ 
                        delay: 0.05 * i,
                        type: "spring",
                        stiffness: 300,
                        damping: 25
                      }}
                    >
                      <div className="text-sm leading-relaxed whitespace-pre-wrap">
                        {(e as any).text}
                      </div>
                    </motion.div>
                  ))}

{/* Status messages - Enhanced Typing Indicator */}
                {isStreaming && events.some((e) => e.type === "status") && (
                  <motion.div 
                    className="flex items-center gap-3 p-3 rounded-2xl bg-gray-100"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    {/* Bouncing Dots Animation */}
                    <div className="flex items-center gap-1">
                      {[0, 1, 2].map((i) => (
                        <motion.div
                          key={i}
                          className="w-2 h-2 bg-blue-500 rounded-full"
                          animate={{
                            y: [0, -6, 0],
                          }}
                          transition={{
                            duration: 0.6,
                            repeat: Infinity,
                            delay: i * 0.15,
                            ease: "easeInOut",
                          }}
                        />
                      ))}
                    </div>
                    <span className="text-sm text-gray-600">
                      {(events.filter((e) => e.type === "status").pop() as any)?.text || "Thinking..."}
                    </span>
                  </motion.div>
                )}

                {/* Simple typing indicator when streaming but no status yet */}
                {isStreaming && !events.some((e) => e.type === "status") && (
                  <motion.div 
                    className="flex items-center gap-3 p-3 rounded-2xl bg-gray-100"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <div className="flex items-center gap-1">
                      {[0, 1, 2].map((i) => (
                        <motion.div
                          key={i}
                          className="w-2 h-2 bg-blue-500 rounded-full"
                          animate={{
                            y: [0, -6, 0],
                          }}
                          transition={{
                            duration: 0.6,
                            repeat: Infinity,
                            delay: i * 0.15,
                            ease: "easeInOut",
                          }}
                        />
                      ))}
                    </div>
                    <span className="text-sm text-gray-600">AI is thinking...</span>
                  </motion.div>
                )}

                {/* Tools used */}
                {toolsUsed.length > 0 && (
                  <motion.div 
                    className="p-3 rounded-xl bg-purple-50 border border-purple-100"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                  >
                    <div className="text-xs font-medium text-purple-900 mb-2">🛠️ Tools Used</div>
                    <div className="flex flex-wrap gap-1">
                      {toolsUsed.map((t: any, i: number) => (
                        <Badge key={i} variant="secondary" className="bg-purple-100 text-purple-700 text-xs">
                          {t.tool}
                        </Badge>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* Found places - Rich cards */}
                {suggestions.length > 0 && (
                  <motion.div 
                    className="space-y-3"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    <div className="text-sm font-medium text-gray-700">
                      Found {suggestions.length} places
                    </div>
                    {suggestions.slice(0, 5).map((p, index) => (
                      <motion.div
                        key={p.slug}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 * index }}
                      >
                        <Card className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer">
                          <div className="flex">
                            {/* Place Image */}
                            <div className="w-24 h-24 bg-gradient-to-br from-blue-100 to-purple-100 flex-shrink-0 relative">
                              {p.image_url ? (
                                <img
                                  src={p.image_url}
                                  alt={p.name}
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                  }}
                                />
                              ) : (
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <Camera className="w-8 h-8 text-gray-400" />
                                </div>
                              )}
                            </div>

                            {/* Place Info */}
                            <div className="flex-1 p-3">
                              <div className="font-semibold text-gray-900 text-sm mb-1">
                                {p.name}
                              </div>
                              {p.tags && p.tags.length > 0 && (
                                <div className="flex flex-wrap gap-1 mb-2">
                                  {p.tags.slice(0, 2).map((tag) => (
                                    <Badge 
                                      key={tag} 
                                      variant="secondary" 
                                      className="text-xs px-1.5 py-0 bg-gray-100"
                                    >
                                      {tag}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                              <div className="flex items-center gap-2 text-xs text-gray-500">
                                {p.price && (
                                  <span className="text-green-600 font-medium">฿{p.price}</span>
                                )}
                              </div>

                              {/* Actions */}
                              <div className="flex gap-1 mt-2">
                                {onAddPlaceToTrip && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs px-2"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onAddPlaceToTrip(p);
                                    }}
                                  >
                                    <Plus className="w-3 h-3 mr-1" />
                                    Add
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 text-xs px-2"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleViewPlace(p.slug);
                                  }}
                                >
                                  <ExternalLink className="w-3 h-3 mr-1" />
                                  View
                                </Button>
                              </div>
                            </div>
                          </div>
                        </Card>
                      </motion.div>
                    ))}
                    {suggestions.length > 5 && (
                      <Button variant="ghost" size="sm" className="w-full text-blue-600">
                        View all {suggestions.length} places
                      </Button>
                    )}
                  </motion.div>
                )}

                {/* Itinerary */}
                {itineraryInfo && (
                  <motion.div 
                    className="space-y-3"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    <div className="flex items-center gap-2">
                      <MapPin className="w-5 h-5 text-blue-600" />
                      <span className="font-semibold text-gray-900">{itineraryInfo.title}</span>
                    </div>
                    
                    <div className="space-y-2">
                      {itineraryInfo.stops.map((stop: any, index: number) => (
                        <motion.div 
                          key={stop.slug} 
                          className="p-3 rounded-xl bg-gradient-to-br from-blue-50 to-purple-50 border border-blue-100"
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.1 * index }}
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 text-white text-sm flex items-center justify-center font-bold">
                              {index + 1}
                            </div>
                            <div className="flex-1">
                              <div className="font-medium text-gray-900">{stop.name}</div>
                              <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                                <Clock className="w-3 h-3" />
                                <span>{stop.suggested_time_min} min</span>
                                {stop.distance_from_prev_km > 0 && (
                                  <>
                                    <span>•</span>
                                    <Navigation className="w-3 h-3" />
                                    <span>{stop.distance_from_prev_km} km</span>
                                  </>
                                )}
                              </div>
                              {stop.notes && (
                                <p className="text-xs text-gray-600 mt-1 line-clamp-2">{stop.notes}</p>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>

                    {/* Trip Summary */}
                    <Card className="bg-white">
                      <CardContent className="p-3">
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <div className="text-gray-500 text-xs">Total Distance</div>
                            <div className="font-semibold text-gray-900">{itineraryInfo.total_distance_km} km</div>
                          </div>
                          <div>
                            <div className="text-gray-500 text-xs">Estimated Time</div>
                            <div className="font-semibold text-gray-900">
                              {Math.floor(itineraryInfo.total_minutes / 60)}h {itineraryInfo.total_minutes % 60}m
                            </div>
                          </div>
                        </div>
                        
                        {session?.access_token && (
                          <Button
                            size="sm"
                            onClick={handleSaveItinerary}
                            disabled={isSavingItinerary || isItinerarySaved}
                            className={`w-full mt-3 transition-all ${
                              isItinerarySaved 
                                ? "bg-green-500 hover:bg-green-500" 
                                : "bg-blue-600 hover:bg-blue-700"
                            }`}
                          >
                            {isSavingItinerary ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                Saving...
                              </>
                            ) : isItinerarySaved ? (
                              <>
                                <Check className="w-4 h-4 mr-2" />
                                Saved!
                              </>
                            ) : (
                              <>
                                <Save className="w-4 h-4 mr-2" />
                                Save Itinerary
                              </>
                            )}
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                )}

                {/* Error messages */}
                {events.filter((e) => e.type === "error").map((e, i) => (
                  <motion.div 
                    key={i}
                    className="p-3 rounded-xl bg-red-50 border border-red-100 text-red-700 text-sm"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                  >
                    ⚠️ {(e as any).text}
                  </motion.div>
                ))}

                <div ref={messagesEndRef} />
              </CardContent>

              {/* Input */}
              <div className="p-4 border-t bg-gray-50">
                <div className="flex gap-2">
                  <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask about places..."
                    disabled={isStreaming}
                    className="flex-1 bg-white border-gray-200 focus-visible:ring-blue-500"
                  />
                  <Button 
                    onClick={handleSend} 
                    disabled={isStreaming || !input.trim()} 
                    size="icon" 
                    className="shrink-0 bg-blue-600 hover:bg-blue-700"
                  >
                    {isStreaming ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </motion.div>
  );
}
