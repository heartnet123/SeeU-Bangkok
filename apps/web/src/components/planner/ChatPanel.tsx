"use client";

import React from "react"

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
  Navigation,
  Clock,
  Camera,
  ChevronDown,
  ChevronUp,
  FileText,
  Brain,
  Route,
  Search,
  Globe,
  Database,
  CheckCircle2,
  Copy,
  Flag,
  Sparkles,
  Zap,
  CircleDot,
  XCircle,
  CheckCircle,
  ExternalLink,
  Map,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";

// --- Agentic Workflow Components ---

interface WorkflowStepProps {
  icon: React.ElementType;
  label: string;
  detail?: React.ReactNode;
  badges?: string[];
  isExpanded?: boolean;
  onToggle?: () => void;
  status?: "complete" | "loading" | "pending";
}

const WorkflowStep = ({ 
  icon: Icon, 
  label, 
  detail, 
  badges,
  isExpanded,
  onToggle,
  status = "complete"
}: WorkflowStepProps) => {
  const hasExpandableContent = detail || (badges && badges.length > 0);
  
  return (
    <div className="flex items-start gap-2 py-1">
      <div className={cn(
        "flex h-5 w-5 shrink-0 items-center justify-center rounded-full mt-0.5",
        status === "complete" && "text-emerald-600",
        status === "loading" && "text-blue-600",
        status === "pending" && "text-muted-foreground"
      )}>
        {status === "loading" ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Icon className="h-3.5 w-3.5" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div 
          className={cn(
            "text-xs text-muted-foreground flex items-center gap-1 flex-wrap",
            hasExpandableContent && "cursor-pointer hover:text-foreground transition-colors"
          )}
          onClick={hasExpandableContent ? onToggle : undefined}
        >
          <span>{label}</span>
          {badges && badges.length > 0 && (
            <div className="flex gap-1 flex-wrap">
              {badges.slice(0, 3).map((badge, idx) => (
                <Badge 
                  key={idx} 
                  variant="secondary" 
                  className="text-[10px] px-1.5 py-0 h-4 bg-secondary/80 text-secondary-foreground font-mono"
                >
                  {badge}
                </Badge>
              ))}
              {badges.length > 3 && (
                <span className="text-[10px] text-muted-foreground">+{badges.length - 3}</span>
              )}
            </div>
          )}
          {hasExpandableContent && (
            <ChevronDown className={cn(
              "h-3 w-3 ml-auto transition-transform shrink-0",
              isExpanded && "rotate-180"
            )} />
          )}
        </div>
        <AnimatePresence>
          {isExpanded && detail && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="text-[10px] text-muted-foreground/80 mt-1 font-mono bg-muted/30 p-2 rounded border border-border/50">
                {detail}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

interface AgenticWorkflowProps {
  steps: {
    type: string;
    label: string;
    detail?: string;
    badges?: string[];
    status?: "complete" | "loading" | "pending";
  }[];
  latency?: number;
  isProcessing?: boolean;
}

const AgenticWorkflow = ({ steps, latency, isProcessing }: AgenticWorkflowProps) => {
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set());

  const toggleStep = (index: number) => {
    setExpandedSteps(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "planner": return CircleDot;
      case "search": return Search;
      case "retrieve": return Database;
      case "reasoning": return Sparkles;
      case "route": return Route;
      case "location": return MapPin;
      default: return CheckCircle2;
    }
  };

  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="flex h-5 w-5 items-center justify-center rounded bg-primary/10">
            <Zap className="h-3 w-3 text-primary" />
          </div>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Agentic Workflow
          </span>
        </div>
        {latency !== undefined && (
          <span className="text-[10px] text-muted-foreground">
            {latency.toFixed(1)}s latency
          </span>
        )}
      </div>
      
      <div className="space-y-0.5">
        {steps.map((step, idx) => (
          <WorkflowStep
            key={idx}
            icon={getIcon(step.type)}
            label={step.label}
            detail={step.detail}
            badges={step.badges}
            status={step.status}
            isExpanded={expandedSteps.has(idx)}
            onToggle={() => toggleStep(idx)}
          />
        ))}
        {isProcessing && (
          <WorkflowStep
            icon={Loader2}
            label="Processing..."
            status="loading"
          />
        )}
      </div>
    </div>
  );
};

// --- Analysis Components ---

interface AnalysisPointProps {
  type: "positive" | "negative" | "neutral";
  title: string;
  description: string;
}

const AnalysisPoint = ({ type, title, description }: AnalysisPointProps) => {
  const icons = {
    positive: CheckCircle,
    negative: XCircle,
    neutral: CircleDot
  };
  const colors = {
    positive: "text-emerald-600",
    negative: "text-red-500",
    neutral: "text-blue-600"
  };
  const Icon = icons[type];

  return (
    <div className="flex gap-2 py-1.5">
      <Icon className={cn("h-4 w-4 shrink-0 mt-0.5", colors[type])} />
      <div>
        <span className="font-semibold text-foreground">{title}:</span>{" "}
        <span className="text-muted-foreground">{description}</span>
      </div>
    </div>
  );
};

// --- Source Card ---

interface SourceCardProps {
  title: string;
  description: string;
  type: string;
  url?: string;
}

const SourceCard = ({ title, description, type, url }: SourceCardProps) => {
  return (
    <div className="flex-1 min-w-[200px] rounded-lg border border-border bg-card p-3 hover:bg-accent/50 transition-colors">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground line-clamp-1">{title}</span>
        </div>
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
          {type}
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{description}</p>
      {url && (
        <button className="text-xs text-primary hover:underline flex items-center gap-1">
          View Details <ExternalLink className="h-3 w-3" />
        </button>
      )}
    </div>
  );
};

// --- Place Cards for Map ---

interface PlaceItem {
  id: string;
  name: string;
  slug: string;
  lat?: number;
  lng?: number;
  tags?: string[];
  price?: number;
  image_url?: string;
  description?: string;
}

const PlaceCard = ({ 
  place, 
  index,
  onAdd, 
  onView 
}: { 
  place: PlaceItem;
  index: number;
  onAdd?: () => void;
  onView?: () => void;
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="flex gap-3 p-3 rounded-lg border border-border bg-card hover:bg-accent/30 transition-colors"
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-semibold">
        {index + 1}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h4 className="text-sm font-semibold text-foreground">{place.name}</h4>
            {place.tags && place.tags.length > 0 && (
              <div className="flex gap-1 mt-1 flex-wrap">
                {place.tags.slice(0, 3).map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </div>
          {place.image_url && (
            <div className="w-12 h-12 rounded-md overflow-hidden bg-muted shrink-0">
              <img 
                src={place.image_url || "/placeholder.svg"} 
                alt={place.name}
                className="w-full h-full object-cover"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            </div>
          )}
        </div>
        {place.description && (
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{place.description}</p>
        )}
        <div className="flex gap-2 mt-2">
          {onAdd && (
            <Button size="sm" variant="outline" className="h-6 text-[10px] px-2 bg-transparent" onClick={onAdd}>
              <Plus className="h-3 w-3 mr-1" /> Add to Trip
            </Button>
          )}
          {onView && (
            <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2" onClick={onView}>
              View Details
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  );
};

// --- Itinerary View ---

const ItineraryView = ({ 
  itinerary, 
  onSave,
  isSaving,
  isSaved
}: { 
  itinerary: any;
  onSave?: () => void;
  isSaving?: boolean;
  isSaved?: boolean;
}) => {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Route className="h-4 w-4 text-primary" />
        <span className="font-semibold text-foreground text-sm">{itinerary.title}</span>
      </div>
       
      <div className="relative border-l-2 border-dashed border-border ml-2 pl-4 space-y-3">
        {itinerary.stops?.map((stop: any, index: number) => (
          <motion.div 
            key={stop.slug || index} 
            className="relative"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.08 * index }}
          >
            <div className="absolute -left-[25px] top-0 w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center font-bold ring-2 ring-background">
              {index + 1}
            </div>
            <div className="p-2.5 rounded-lg bg-muted/50 border border-border">
              <div className="font-medium text-foreground text-sm">{stop.name}</div>
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground mt-1">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {stop.suggested_time_min} min
                </span>
                {stop.distance_from_prev_km > 0 && (
                  <span className="flex items-center gap-1">
                    <Navigation className="h-3 w-3" />
                    {stop.distance_from_prev_km} km
                  </span>
                )}
              </div>
              {stop.notes && (
                <p className="text-[10px] text-muted-foreground mt-1 italic">"{stop.notes}"</p>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      <div className="rounded-lg border border-border bg-muted/30 p-3">
        <div className="grid grid-cols-2 gap-3 text-xs mb-3">
          <div>
            <div className="text-muted-foreground">Total Distance</div>
            <div className="font-semibold text-foreground">{itinerary.total_distance_km} km</div>
          </div>
          <div>
            <div className="text-muted-foreground">Est. Duration</div>
            <div className="font-semibold text-foreground">
              {Math.floor(itinerary.total_minutes / 60)}h {itinerary.total_minutes % 60}m
            </div>
          </div>
        </div>
        
        {onSave && (
          <Button
            size="sm"
            onClick={onSave}
            disabled={isSaving || isSaved}
            className="w-full h-8 text-xs"
          >
            {isSaving ? (
              <><Loader2 className="h-3 w-3 animate-spin mr-2" /> Saving...</>
            ) : isSaved ? (
              <><Check className="h-3 w-3 mr-2" /> Saved</>
            ) : (
              <><Save className="h-3 w-3 mr-2" /> Save Itinerary</>
            )}
          </Button>
        )}
      </div>
    </div>
  );
};

// --- Message Response Component ---

interface AgentResponseProps {
  content: string;
  workflow?: AgenticWorkflowProps;
  analysis?: AnalysisPointProps[];
  sources?: SourceCardProps[];
  places?: PlaceItem[];
  itinerary?: any;
  onAddPlace?: (place: PlaceItem) => void;
  onViewPlace?: (slug: string) => void;
  onSaveItinerary?: () => void;
  isSavingItinerary?: boolean;
  isItinerarySaved?: boolean;
}

const AgentResponse = ({ 
  content, 
  workflow, 
  analysis, 
  sources, 
  places,
  itinerary,
  onAddPlace,
  onViewPlace,
  onSaveItinerary,
  isSavingItinerary,
  isItinerarySaved
}: AgentResponseProps) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Parse content for bold text and formatting
  const formatContent = (text: string) => {
    // Split by ** for bold and render
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>;
      }
      return <span key={i}>{part}</span>;
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* Agent Avatar + Workflow Container */}
      <div className="flex gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Map className="h-4 w-4" />
        </div>
        <div className="flex-1 space-y-3">
          {/* Agentic Workflow */}
          {workflow && <AgenticWorkflow {...workflow} />}
          
          {/* Main Content */}
          <div className="text-sm leading-relaxed text-foreground/90">
            {formatContent(content)}
          </div>

          {/* Analysis Points */}
          {analysis && analysis.length > 0 && (
            <div className="space-y-1">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Key Insights
              </h4>
              <div className="space-y-0.5 text-sm">
                {analysis.map((point, idx) => (
                  <AnalysisPoint key={idx} {...point} />
                ))}
              </div>
            </div>
          )}

          {/* Places Found */}
          {places && places.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Found {places.length} Places
              </h4>
              <div className="space-y-2">
                {places.slice(0, 5).map((place, idx) => (
                  <PlaceCard
                    key={place.slug || idx}
                    place={place}
                    index={idx}
                    onAdd={onAddPlace ? () => onAddPlace(place) : undefined}
                    onView={onViewPlace ? () => onViewPlace(place.slug) : undefined}
                  />
                ))}
                {places.length > 5 && (
                  <Button variant="ghost" size="sm" className="w-full text-xs">
                    + {places.length - 5} more places
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Itinerary */}
          {itinerary && (
            <ItineraryView 
              itinerary={itinerary}
              onSave={onSaveItinerary}
              isSaving={isSavingItinerary}
              isSaved={isItinerarySaved}
            />
          )}

          {/* Cited Sources */}
          {sources && sources.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Cited Sources
              </h4>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {sources.map((source, idx) => (
                  <SourceCard key={idx} {...source} />
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-2 pt-2 border-t border-border">
            <Button 
              variant="outline" 
              size="sm" 
              className="h-7 text-xs gap-1.5 bg-transparent"
              onClick={handleCopy}
            >
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copied ? "Copied" : "Copy"}
            </Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5 ml-auto text-muted-foreground">
              <Flag className="h-3 w-3" />
              Report
            </Button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

// --- Main Chat Panel ---

type ChatEvent =
  | { type: "message"; text: string }
  | { type: "status"; text: string }
  | { type: "suggestions"; data: any }
  | { type: "error"; text: string }
  | { type: "done" }
  | { type: "tools"; data: any }
  | { type: "context"; data: any }
  | { type: "itinerary"; data: any };

interface ChatPanelProps {
  onPlacesFound?: (places: PlaceItem[]) => void;
  onAddPlaceToTrip?: (place: PlaceItem) => void;
  onItineraryCreated?: (itinerary: any) => void;
  userLocation?: { lat: number; lng: number };
  defaultOpen?: boolean;
}

export function ChatPanel({ 
  onPlacesFound, 
  onAddPlaceToTrip, 
  onItineraryCreated, 
  userLocation, 
  defaultOpen = false 
}: ChatPanelProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [isMinimized, setIsMinimized] = useState(false);
  const [input, setInput] = useState("");
  const [events, setEvents] = useState<ChatEvent[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isSavingItinerary, setIsSavingItinerary] = useState(false);
  const [isItinerarySaved, setIsItinerarySaved] = useState(false);
  const [workflowSteps, setWorkflowSteps] = useState<AgenticWorkflowProps["steps"]>([]);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [latency, setLatency] = useState<number | undefined>();
  const controllerRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [events, workflowSteps]);

  const suggestions = useMemo<PlaceItem[]>(() => {
    const ev = [...events].reverse().find((e) => e.type === "suggestions") as any;
    return ev?.data?.places || [];
  }, [events]);

  const itineraryInfo = useMemo(() => {
    const ev = [...events].reverse().find((e) => e.type === "itinerary") as any;
    return ev?.data || null;
  }, [events]);

  const messageContent = useMemo(() => {
    const ev = [...events].reverse().find((e) => e.type === "message") as any;
    return ev?.text || "";
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
    async (endpoint: "chat" | "agent" | "agent/v2" = "agent/v2") => {
      if (isStreaming) stop();
      setEvents([]);
      setWorkflowSteps([]);
      setIsStreaming(true);
      setStartTime(Date.now());
      setLatency(undefined);
      
      const controller = new AbortController();
      controllerRef.current = controller;

      // Add initial workflow step
      setWorkflowSteps([{
        type: "planner",
        label: `Analyzing query: "${input.slice(0, 40)}${input.length > 40 ? '...' : ''}"`,
        status: "loading"
      }]);

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
              case "start":
                console.log("[Agent v2] Started:", joined);
                break;
              case "agent":
                try {
                  const payload = JSON.parse(joined);
                  // Update workflow with agent routing
                  setWorkflowSteps(prev => [
                    { ...prev[0], status: "complete" },
                    {
                      type: "search",
                      label: `Routing to ${payload.agent} agent`,
                      status: "loading"
                    }
                  ]);
                } catch (e) {}
                break;
              case "message":
                setEvents((prev) => [...prev, { type: "message", text: joined }]);
                // Calculate latency when first message arrives
                if (startTime) {
                  setLatency((Date.now() - startTime) / 1000);
                }
                break;
              case "status":
                setEvents((prev) => [...prev, { type: "status", text: joined }]);
                // Add to workflow steps
                setWorkflowSteps(prev => {
                  const updated = prev.map(s => ({ ...s, status: "complete" as const }));
                  return [...updated, {
                    type: "reasoning",
                    label: joined,
                    status: "loading" as const
                  }];
                });
                break;
              case "suggestions":
                try {
                  const payload = JSON.parse(joined);
                  setEvents((prev) => [...prev, { type: "suggestions", data: payload }]);
                  // Add to workflow
                  setWorkflowSteps(prev => {
                    const updated = prev.map(s => ({ ...s, status: "complete" as const }));
                    return [...updated, {
                      type: "location",
                      label: `Found ${payload.places?.length || 0} places`,
                      badges: payload.places?.slice(0, 3).map((p: any) => p.name),
                      status: "complete" as const
                    }];
                  });
                } catch (e) {}
                break;
              case "tools":
                try {
                  const payload = JSON.parse(joined);
                  setEvents((prev) => [...prev, { type: "tools", data: payload }]);
                  // Add tool usage to workflow
                  const toolNames = payload.tools?.map((t: any) => t.tool) || [];
                  setWorkflowSteps(prev => {
                    const updated = prev.map(s => ({ ...s, status: "complete" as const }));
                    return [...updated, {
                      type: "search",
                      label: `Used ${toolNames.length} tool${toolNames.length > 1 ? 's' : ''}`,
                      badges: toolNames,
                      status: "complete" as const
                    }];
                  });
                } catch (e) {}
                break;
              case "context":
                try {
                  const payload = JSON.parse(joined);
                  setEvents((prev) => [...prev, { type: "context", data: payload }]);
                  // Add context retrieval to workflow
                  setWorkflowSteps(prev => {
                    const updated = prev.map(s => ({ ...s, status: "complete" as const }));
                    return [...updated, {
                      type: "retrieve",
                      label: `Retrieved ${payload.documents || 0} documents`,
                      status: "complete" as const
                    }];
                  });
                } catch (e) {}
                break;
              case "itinerary":
                try {
                  const payload = JSON.parse(joined);
                  setEvents((prev) => [...prev, { type: "itinerary", data: payload }]);
                  // Add route creation to workflow
                  setWorkflowSteps(prev => {
                    const updated = prev.map(s => ({ ...s, status: "complete" as const }));
                    return [...updated, {
                      type: "route",
                      label: `Created itinerary: ${payload.title}`,
                      badges: [`${payload.stops?.length || 0} stops`],
                      status: "complete" as const
                    }];
                  });
                } catch (e) {}
                break;
              case "error":
                setEvents((prev) => [...prev, { type: "error", text: joined }]);
                break;
              case "done":
                setEvents((prev) => [...prev, { type: "done" }]);
                setIsStreaming(false);
                // Mark all steps complete
                setWorkflowSteps(prev => prev.map(s => ({ ...s, status: "complete" as const })));
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
    [isStreaming, stop, input, userLocation, startTime]
  );

  const handleSend = useCallback(() => {
    if (!input.trim() || isStreaming) return;
    start("agent/v2");
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
    if (!itineraryInfo) return;
    setIsSavingItinerary(true);
    // Simulate save
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsSavingItinerary(false);
    setIsItinerarySaved(true);
  }, [itineraryInfo]);

  const handleViewPlace = useCallback((slug: string) => {
    window.open(`/places/${slug}`, '_blank');
  }, []);

  // Closed state - show floating button
  if (!isOpen) {
    return (
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 20 }}
      >
        <Button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 rounded-full w-14 h-14 shadow-xl z-50"
          size="icon"
        >
          <MessageSquare className="h-6 w-6" />
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
        className={cn(
          "fixed bottom-6 right-6 shadow-2xl z-50 transition-all overflow-hidden flex flex-col",
          isMinimized ? "w-80 h-14" : "w-[420px] h-[650px]"
        )}
      >
        {/* Header */}
        <CardHeader className="flex flex-row items-center justify-between py-3 px-4 border-b bg-card shrink-0">
          <CardTitle className="text-sm flex items-center gap-2 font-semibold">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
              <Map className="h-4 w-4 text-primary" />
            </div>
            Map Assistant
          </CardTitle>
          <div className="flex gap-1">
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-7 w-7" 
              onClick={() => setIsMinimized(!isMinimized)}
            >
              {isMinimized ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-7 w-7" 
              onClick={() => setIsOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        <AnimatePresence>
          {!isMinimized && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="flex flex-col flex-1 min-h-0"
            >
              {/* Messages */}
              <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
                {events.length === 0 && !isStreaming && (
                  <motion.div 
                    className="text-center py-8"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-primary/10 flex items-center justify-center">
                      <Map className="h-7 w-7 text-primary" />
                    </div>
                    <p className="text-foreground font-medium mb-1">Map Assistant</p>
                    <p className="text-muted-foreground text-sm mb-4">
                      Ask me about places or let me plan your trip!
                    </p>
                    <div className="flex flex-wrap gap-2 justify-center">
                      {["Show me temples", "Find cafes near me", "Plan a day trip"].map((suggestion) => (
                        <Button
                          key={suggestion}
                          variant="outline"
                          size="sm"
                          className="text-xs bg-transparent"
                          onClick={() => {
                            setInput(suggestion);
                          }}
                        >
                          {suggestion}
                        </Button>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* Show workflow and response together */}
                {(workflowSteps.length > 0 || messageContent) && (
                  <AgentResponse
                    content={messageContent}
                    workflow={workflowSteps.length > 0 ? {
                      steps: workflowSteps,
                      latency: latency,
                      isProcessing: isStreaming
                    } : undefined}
                    places={suggestions}
                    itinerary={itineraryInfo}
                    onAddPlace={onAddPlaceToTrip}
                    onViewPlace={handleViewPlace}
                    onSaveItinerary={handleSaveItinerary}
                    isSavingItinerary={isSavingItinerary}
                    isItinerarySaved={isItinerarySaved}
                  />
                )}

                {/* Error Messages */}
                {events.filter(e => e.type === "error").map((e, i) => (
                  <motion.div 
                    key={`error-${i}`}
                    className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    {(e as any).text}
                  </motion.div>
                ))}

                <div ref={messagesEndRef} />
              </CardContent>

              {/* Input */}
              <div className="p-4 border-t bg-muted/30 shrink-0">
                <div className="flex gap-2">
                  <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask about places..."
                    disabled={isStreaming}
                    className="flex-1"
                  />
                  <Button 
                    onClick={handleSend} 
                    disabled={isStreaming || !input.trim()} 
                    size="icon" 
                    className="shrink-0"
                  >
                    {isStreaming ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
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
