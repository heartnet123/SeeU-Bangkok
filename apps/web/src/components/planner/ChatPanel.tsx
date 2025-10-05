"use client";

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageSquare, Send, Loader2, X, Minimize2, Maximize2 } from "lucide-react";

type ChatEvent =
  | { type: "message"; text: string }
  | { type: "status"; text: string }
  | { type: "suggestions"; data: any }
  | { type: "error"; text: string }
  | { type: "done" }
  | { type: "tools"; data: any }
  | { type: "context"; data: any };

interface PlaceItem {
  id: string;
  name: string;
  slug: string;
  lat?: number;
  lng?: number;
  tags?: string[];
  price?: number;
}

interface ChatPanelProps {
  onPlacesFound?: (places: PlaceItem[]) => void;
  onAddPlaceToTrip?: (place: PlaceItem) => void;
  userLocation?: { lat: number; lng: number };
  defaultOpen?: boolean;
}

export function ChatPanel({ onPlacesFound, onAddPlaceToTrip, userLocation, defaultOpen = false }: ChatPanelProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [isMinimized, setIsMinimized] = useState(false);
  const [input, setInput] = useState("");
  const [events, setEvents] = useState<ChatEvent[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [useAgent, setUseAgent] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (suggestions.length > 0 && onPlacesFound) {
      onPlacesFound(suggestions);
    }
  }, [suggestions, onPlacesFound]);

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
    start(useAgent ? "agent" : "chat");
  }, [input, isStreaming, useAgent, start]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  if (!isOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 rounded-full w-14 h-14 shadow-lg z-50"
        size="icon"
      >
        <MessageSquare className="w-6 h-6" />
      </Button>
    );
  }

  return (
    <Card
      className={`fixed bottom-6 right-6 shadow-2xl z-50 transition-all ${
        isMinimized ? "w-80 h-16" : "w-96 h-[600px]"
      }`}
    >
      <CardHeader className="flex flex-row items-center justify-between pb-3 border-b">
        <CardTitle className="text-base flex items-center gap-2">
          <MessageSquare className="w-5 h-5" />
          Trip Assistant
          {useAgent && <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">🤖 AI Agent</span>}
        </CardTitle>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => setIsMinimized(!isMinimized)}>
            {isMinimized ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
          </Button>
          <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => setIsOpen(false)}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>

      {!isMinimized && (
        <>
          <CardContent className="flex-1 overflow-y-auto p-4 space-y-3 h-[calc(100%-8rem)]">
            {events.length === 0 && (
              <div className="text-center text-sm text-gray-500 mt-8">
                <MessageSquare className="w-12 h-12 mx-auto text-gray-300 mb-2" />
                <p>Ask me about places in Bangkok!</p>
                <p className="text-xs mt-2">Try: "Show me temples" or "Find cafes near me"</p>
              </div>
            )}

            {events
              .filter((e) => e.type === "message")
              .map((e, i) => (
                <div key={i} className="p-3 rounded-lg bg-blue-50 text-gray-800 text-sm">
                  {(e as any).text}
                </div>
              ))}

            {useAgent && toolsUsed.length > 0 && (
              <div className="p-2 rounded-md bg-purple-50 border border-purple-200 text-xs">
                <div className="font-medium text-purple-900">🛠️ Tools: </div>
                <div className="text-purple-700 mt-1">
                  {toolsUsed.map((t: any, i: number) => (
                    <span key={i} className="inline-block mr-1 px-1.5 py-0.5 bg-purple-100 rounded">
                      {t.tool}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {useAgent && contextInfo && (
              <div className="p-2 rounded-md bg-green-50 border border-green-200 text-xs">
                <div className="font-medium text-green-900">📚 Context: {contextInfo.documents} docs</div>
              </div>
            )}

            {suggestions.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-medium text-gray-700">Found {suggestions.length} places:</div>
                <div className="space-y-1">
                  {suggestions.slice(0, 5).map((p) => (
                    <div key={p.slug} className="p-2 rounded border bg-white text-xs">
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex-1">
                          <div className="font-medium">{p.name}</div>
                          {p.tags && p.tags.length > 0 && (
                            <div className="text-gray-500 mt-1">
                              {p.tags.slice(0, 3).map((tag) => (
                                <span key={tag} className="inline-block mr-1 px-1 bg-gray-100 rounded">
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                          {p.price && (
                            <div className="text-gray-600 mt-1">฿{p.price}</div>
                          )}
                        </div>
                        {onAddPlaceToTrip && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 text-xs px-2 shrink-0"
                            onClick={() => onAddPlaceToTrip(p)}
                          >
                            + Add
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {events.filter((e) => e.type === "error").length > 0 && (
              <div className="text-red-600 text-xs">
                {events
                  .filter((e) => e.type === "error")
                  .map((e, i) => (
                    <div key={i}>Error: {(e as any).text}</div>
                  ))}
              </div>
            )}

            <div ref={messagesEndRef} />
          </CardContent>

          <div className="p-4 border-t space-y-2">
            <div className="flex gap-2 items-center text-xs">
              <span className="text-gray-600">Mode:</span>
              <Button
                variant={useAgent ? "outline" : "default"}
                size="sm"
                className="h-6 text-xs px-2"
                onClick={() => setUseAgent(false)}
              >
                Chat
              </Button>
              <Button
                variant={useAgent ? "default" : "outline"}
                size="sm"
                className="h-6 text-xs px-2"
                onClick={() => setUseAgent(true)}
              >
                🤖 Agent
              </Button>
            </div>
            <div className="flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about places..."
                disabled={isStreaming}
                className="flex-1 text-sm"
              />
              <Button onClick={handleSend} disabled={isStreaming || !input.trim()} size="icon" className="shrink-0">
                {isStreaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </>
      )}
    </Card>
  );
}