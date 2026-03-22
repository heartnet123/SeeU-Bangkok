import { useMemo, useState } from "react";
import type { RefObject } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { AnimatePresence, motion } from "motion/react";
import {
	Check,
	Clock,
	Copy,
	Database,
	Loader2,
	Map,
	MapPin,
	Plus,
	Route,
	Search,
	Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ActiveWorkflowStatus, WorkflowSummary } from "./AgentWorkflowVisualization";
import { ItineraryPreview } from "./ItineraryPreview";
import { PlacesListPreview } from "./PlacesListPreview";
import { useTypewriter } from "./hooks/useTypewriter";
import {
	extractIntroText,
	getFollowUpChips,
	isPlaceListText,
	looksLikeMarkdown,
} from "./lib/chat-parsers";
import type { AssistantTurn, PendingTurn, PlaceItem, TripDraft, Turn } from "./types";

interface ChatMessageListProps {
	turns: Turn[];
	pendingTurn: PendingTurn | null;
	isStreaming: boolean;
	isSavingItinerary: boolean;
	isItinerarySaved: boolean;
	quickSuggestions: string[];
	messagesEndRef: RefObject<HTMLDivElement | null>;
	onQuickSuggestion: (text: string) => void;
	onAddPlace?: (place: PlaceItem) => void;
	onViewPlace?: (slug: string) => void;
	onSaveItinerary?: () => void;
	onPreviewTripDraft?: (tripDraft: TripDraft) => void;
	onFollowUp?: (text: string) => void;
}

const mdComponents: React.ComponentProps<typeof ReactMarkdown>["components"] = {
	p: ({ children }) => (
		<p className="mb-1.5 last:mb-0 text-sm leading-relaxed text-foreground/90">{children}</p>
	),
	ul: ({ children }) => (
		<ul className="list-disc pl-4 space-y-1.5 mb-3 text-sm text-foreground/90">{children}</ul>
	),
	ol: ({ children }) => <ol className="space-y-2 mb-3 list-none pl-0">{children}</ol>,
	li: ({ children }) => (
		<li className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5 text-sm text-foreground/90 leading-relaxed">
			{children}
		</li>
	),
	strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
	em: ({ children }) => <em className="italic text-foreground/80">{children}</em>,
	h1: ({ children }) => (
		<h1 className="text-base font-bold text-foreground mb-2 mt-3 first:mt-0">{children}</h1>
	),
	h2: ({ children }) => (
		<h2 className="text-sm font-bold text-foreground mb-1.5 mt-3 first:mt-0">{children}</h2>
	),
	h3: ({ children }) => (
		<h3 className="text-sm font-semibold text-foreground mb-1 mt-2 first:mt-0">{children}</h3>
	),
	code: ({ children }) => (
		<code className="text-[11px] bg-muted px-1 py-0.5 rounded font-mono text-foreground">
			{children}
		</code>
	),
	blockquote: ({ children }) => (
		<blockquote className="border-l-2 border-primary/30 pl-3 italic text-muted-foreground text-sm my-2">
			{children}
		</blockquote>
	),
	hr: () => <hr className="border-border my-3" />,
};

function AssistantTextContent({ text }: { text: string }) {
	const isMarkdown = looksLikeMarkdown(text);
	const { displayed, done } = useTypewriter(isMarkdown ? "" : text);

	if (!text) return null;

	if (isMarkdown) {
		return (
			<motion.div
				initial={{ opacity: 0, y: 4 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.25, ease: "easeOut" }}
			>
				<ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
					{text}
				</ReactMarkdown>
			</motion.div>
		);
	}

	if (!done) {
		return (
			<p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">
				{displayed}
				<span className="inline-block w-0.5 h-[1em] bg-primary/70 ml-0.5 animate-pulse align-text-bottom" />
			</p>
		);
	}

	return (
		<ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
			{text}
		</ReactMarkdown>
	);
}

function ParsedPlaceCard({ place, index }: { place: { name: string; description: string; lat?: number; lng?: number }; index: number; }) {
	return (
		<motion.div
			initial={{ opacity: 0, y: 8 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ delay: index * 0.04 }}
			className="flex gap-3 p-3 rounded-lg border border-border bg-card hover:bg-accent/30 transition-colors"
		>
			<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-semibold">
				{index + 1}
			</div>
			<div className="flex-1 min-w-0">
				<h4 className="text-sm font-semibold text-foreground leading-snug">{place.name}</h4>
				{place.lat !== undefined && place.lng !== undefined && (
					<div className="flex items-center gap-1 mt-0.5">
						<MapPin className="h-2.5 w-2.5 text-muted-foreground" />
						<span className="text-[10px] text-muted-foreground font-mono">
							{place.lat.toFixed(4)}, {place.lng.toFixed(4)}
						</span>
					</div>
				)}
				{place.description && (
					<p className="text-xs text-muted-foreground mt-1 leading-relaxed line-clamp-3">
						{place.description}
					</p>
				)}
			</div>
		</motion.div>
	);
}

function PlaceCard({
	place,
	index,
	onAdd,
	onView,
}: {
	place: PlaceItem;
	index: number;
	onAdd?: () => void;
	onView?: () => void;
}) {
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
					<div className="min-w-0">
						<h4 className="text-sm font-semibold text-foreground truncate">{place.name}</h4>
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
								src={place.image_url}
								alt={place.name}
								className="w-full h-full object-cover"
								onError={(e) => {
									e.currentTarget.style.display = "none";
								}}
							/>
						</div>
					)}
				</div>
				{place.description && (
					<p className="text-xs text-muted-foreground mt-1 line-clamp-2">{place.description}</p>
				)}
				<div className="flex gap-2 mt-2">
					{onAdd && (
						<Button size="sm" variant="outline" className="h-8 text-xs px-3 bg-transparent" onClick={onAdd}>
							<Plus className="h-3.5 w-3.5 mr-1.5" />
							Add to Trip
						</Button>
					)}
					{onView && (
						<Button size="sm" variant="ghost" className="h-8 text-xs px-3" onClick={onView}>
							View Details
						</Button>
					)}
				</div>
			</div>
		</motion.div>
	);
}

function UserBubble({ text }: { text: string }) {
	return (
		<motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex justify-end">
			<div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-primary text-primary-foreground px-4 py-2.5 text-sm leading-relaxed">
				{text}
			</div>
		</motion.div>
	);
}

function AssistantMessage({
	turn,
	isLast,
	onAddPlace,
	onViewPlace,
	onSaveItinerary,
	onPreviewTripDraft,
	isSavingItinerary,
	isItinerarySaved,
	onFollowUp,
}: {
	turn: AssistantTurn;
	isLast: boolean;
	onAddPlace?: (place: PlaceItem) => void;
	onViewPlace?: (slug: string) => void;
	onSaveItinerary?: () => void;
	onPreviewTripDraft?: (tripDraft: TripDraft) => void;
	isSavingItinerary?: boolean;
	isItinerarySaved?: boolean;
	onFollowUp?: (text: string) => void;
}) {
	const [copied, setCopied] = useState(false);
	const [itineraryDismissed, setItineraryDismissed] = useState(false);
	const [showAllParsed, setShowAllParsed] = useState(false);

	const handleCopy = async () => {
		await navigator.clipboard.writeText(turn.text);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	const isPlaceList = useMemo(() => isPlaceListText(turn.text), [turn.text]);

	const introText = useMemo(
		() => (isPlaceList || turn.suggestions.length > 0 ? extractIntroText(turn.text) : null),
		[isPlaceList, turn.text, turn.suggestions.length],
	);

	const parsedPlaces = useMemo(
		() => {
			// Schema-first UI: disable markdown heuristic parsing when structured payload is expected.
			// Keep empty fallback to avoid mixed rendering paths.
			return [];
		},
		[],
	);

	const parsedItinerary = useMemo(
		() => {
			// Schema-first UI: rely on structured itinerary only.
			// No markdown parsing fallback.
			return null;
		},
		[],
	);

	const followUps = useMemo(() => getFollowUpChips(turn, parsedItinerary !== null), [turn, parsedItinerary]);

	const displayText = turn.ui?.summary || (introText !== null ? introText : turn.text);
	const uiActions = turn.ui?.actions ?? [];
	const previewTripDraft = turn.tripDraft;

	return (
		<motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex gap-3">
			<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary mt-0.5">
				<Map className="h-4 w-4" />
			</div>

			<div className="flex-1 min-w-0 space-y-3">
				{turn.workflowSteps.length > 0 && <WorkflowSummary steps={turn.workflowSteps} latency={turn.latency} />}

				{displayText && <AssistantTextContent text={displayText} />}

				{turn.errors.map((err, i) => (
					<div key={i} className="p-2.5 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs">
						{err}
					</div>
				))}

				{turn.suggestions.length > 0 && (
					<PlacesListPreview places={turn.suggestions} onAdd={onAddPlace} onView={onViewPlace} />
				)}

				{uiActions.length > 0 && (
					<div className="flex flex-wrap gap-2">
						{uiActions.map((action) => (
							<Badge key={`${action.type}-${action.label}`} variant="outline" className="text-[10px]">
								{action.label}
							</Badge>
						))}
					</div>
				)}

				{parsedPlaces.length > 0 && parsedItinerary === null && (
					<div className="space-y-2">
						<p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
							{parsedPlaces.length} place{parsedPlaces.length > 1 ? "s" : ""} mentioned
						</p>
						<div className="space-y-2">
							{(showAllParsed ? parsedPlaces : parsedPlaces.slice(0, 5)).map((place, idx) => (
								<ParsedPlaceCard key={idx} place={place} index={idx} />
							))}
							{!showAllParsed && parsedPlaces.length > 5 && (
								<Button
									variant="ghost"
									size="sm"
									className="w-full h-8 text-xs"
									onClick={() => setShowAllParsed(true)}
								>
									+ {parsedPlaces.length - 5} more places
								</Button>
							)}
						</div>
					</div>
				)}

				<AnimatePresence>
					{previewTripDraft !== null && !itineraryDismissed && (
						<motion.div
							initial={{ opacity: 1 }}
							exit={{ opacity: 0, height: 0, marginTop: 0 }}
							transition={{ duration: 0.2 }}
						>
							<ItineraryPreview
								itinerary={previewTripDraft}
								onSave={isLast ? onSaveItinerary : undefined}
								onPreview={
									onPreviewTripDraft
										? () => onPreviewTripDraft(previewTripDraft)
										: undefined
								}
								onDismiss={() => setItineraryDismissed(true)}
								isSaving={isSavingItinerary}
								isSaved={isItinerarySaved}
							/>
						</motion.div>
					)}
				</AnimatePresence>

				{turn.text && (
					<div className="flex items-center gap-2 pt-1">
						<Button
							variant="ghost"
							size="sm"
							className="h-7 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
							onClick={handleCopy}
						>
							{copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
							{copied ? "Copied" : "Copy"}
						</Button>
					</div>
				)}

				{isLast && onFollowUp && turn.text && (
					<div className="flex flex-wrap gap-1.5 pt-1">
						{followUps.map((chip) => (
							<button
								key={chip}
								onClick={() => onFollowUp(chip)}
								className="text-[11px] px-2.5 py-1.5 rounded-full border border-border hover:bg-accent hover:border-transparent transition-colors text-muted-foreground hover:text-foreground"
							>
								{chip}
							</button>
						))}
					</div>
				)}
			</div>
		</motion.div>
	);
}

function PendingAssistantMessage({
	pending,
	onAddPlace,
}: {
	pending: PendingTurn;
	onAddPlace?: (place: PlaceItem) => void;
}) {
	const showDots = pending.workflowSteps.length === 0 && !pending.text;

	return (
		<motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex gap-3">
			<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary mt-0.5">
				<Map className="h-4 w-4" />
			</div>
			<div className="flex-1 min-w-0 space-y-3">
				{pending.workflowSteps.length > 0 && (
					<ActiveWorkflowStatus steps={pending.workflowSteps} isProcessing={!pending.text} />
				)}

				{showDots && <ThinkingDots />}

				{pending.text &&
					(looksLikeMarkdown(pending.text) ? (
						<div>
							<ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
								{pending.text}
							</ReactMarkdown>
							<span className="inline-block w-0.5 h-3 bg-primary/70 animate-pulse align-middle mt-0.5" />
						</div>
					) : (
						<p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">
							{pending.text}
							<span className="inline-block w-0.5 h-[1em] bg-primary/70 ml-0.5 animate-pulse align-text-bottom" />
						</p>
					))}

				{pending.suggestions.length > 0 && (
					<div className="space-y-2">
						<h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
							Finding places...
						</h4>
						{pending.suggestions.slice(0, 3).map((place, idx) => (
							<PlaceCard
								key={place.slug || idx}
								place={place}
								index={idx}
								onAdd={onAddPlace ? () => onAddPlace(place) : undefined}
							/>
						))}
					</div>
				)}
			</div>
		</motion.div>
	);
}

function ThinkingDots() {
	return (
		<div className="flex items-center gap-1 py-2">
			{[0, 150, 300].map((delay) => (
				<span
					key={delay}
					className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce"
					style={{ animationDelay: `${delay}ms` }}
				/>
			))}
		</div>
	);
}

export function ChatMessageList({
	turns,
	pendingTurn,
	isStreaming,
	isSavingItinerary,
	isItinerarySaved,
	quickSuggestions,
	messagesEndRef,
	onQuickSuggestion,
	onAddPlace,
	onViewPlace,
	onSaveItinerary,
	onPreviewTripDraft,
	onFollowUp,
}: ChatMessageListProps) {
	return (
		<>
			{turns.length === 0 && !isStreaming && (
				<motion.div className="text-center py-8" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
					<div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-primary/10 flex items-center justify-center">
						<Map className="h-7 w-7 text-primary" />
					</div>
					<p className="text-foreground font-medium mb-1">Map Assistant</p>
					<p className="text-muted-foreground text-sm mb-5">
						Ask me about places in Bangkok or let me plan your trip!
					</p>
					<div className="flex flex-wrap gap-2 justify-center">
						{quickSuggestions.map((suggestion) => (
							<Button
								key={suggestion}
								variant="outline"
								size="sm"
								className="text-xs h-8 bg-transparent"
								onClick={() => onQuickSuggestion(suggestion)}
							>
								{suggestion}
							</Button>
						))}
					</div>
				</motion.div>
			)}

			{turns.map((turn, idx) => {
				const isLast = idx === turns.length - 1;
				if (turn.role === "user") {
					return <UserBubble key={turn.id} text={turn.text} />;
				}
				return (
					<AssistantMessage
						key={turn.id}
						turn={turn}
						isLast={isLast && !isStreaming}
						onAddPlace={onAddPlace}
						onViewPlace={onViewPlace}
						onSaveItinerary={onSaveItinerary}
						onPreviewTripDraft={onPreviewTripDraft}
						isSavingItinerary={isSavingItinerary}
						isItinerarySaved={isItinerarySaved}
						onFollowUp={onFollowUp}
					/>
				);
			})}

			{pendingTurn && <PendingAssistantMessage pending={pendingTurn} onAddPlace={onAddPlace} />}

			<div ref={messagesEndRef} />
		</>
	);
}
