import { useCallback, useEffect, useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { AssistantTurn, PendingTurn, TripDraft, Turn } from "../types";
import { uid } from "../constants";

interface UseChatHistoryParams {
	onPlacesFound?: (places: AssistantTurn["suggestions"]) => void;
	onTripDraftCreated?: (tripDraft: TripDraft) => void;
}

interface UseChatHistoryResult {
	turns: Turn[];
	pendingTurn: PendingTurn | null;
	setPendingTurn: Dispatch<SetStateAction<PendingTurn | null>>;
	lastAssistantTurn: AssistantTurn | null;
	isItinerarySaved: boolean;
	setIsItinerarySaved: Dispatch<SetStateAction<boolean>>;
	appendUserTurn: (text: string) => void;
	commitPending: (pending: PendingTurn, latency: number) => void;
	clearConversation: () => void;
	loadSession: (rawMessages: Array<{ role: string; content: string }>) => void;
}

export function useChatHistory({
	onPlacesFound,
	onTripDraftCreated,
}: UseChatHistoryParams): UseChatHistoryResult {
	const [turns, setTurns] = useState<Turn[]>([]);
	const [pendingTurn, setPendingTurn] = useState<PendingTurn | null>(null);
	const [isItinerarySaved, setIsItinerarySaved] = useState(false);

	const lastAssistantTurn = useMemo(
		() =>
			([...turns].reverse().find((turn) => turn.role === "assistant") as AssistantTurn | undefined) ??
			null,
		[turns],
	);

	useEffect(() => {
		if (lastAssistantTurn?.suggestions.length && onPlacesFound) {
			onPlacesFound(lastAssistantTurn.suggestions);
		}
	}, [lastAssistantTurn, onPlacesFound]);

	useEffect(() => {
		if (lastAssistantTurn?.tripDraft && onTripDraftCreated) {
			onTripDraftCreated(lastAssistantTurn.tripDraft);
			setIsItinerarySaved(false);
		}
	}, [lastAssistantTurn?.tripDraft, onTripDraftCreated]);

	const appendUserTurn = useCallback((text: string) => {
		setTurns((prev) => [...prev, { role: "user", text, id: uid() }]);
	}, []);

	const commitPending = useCallback((pending: PendingTurn, latency: number) => {
		const committed: AssistantTurn = {
			role: "assistant",
			id: uid(),
			text: pending.text,
			workflowSteps: pending.workflowSteps.map((step) => ({ ...step, status: "complete" })),
			latency,
			suggestions: pending.suggestions,
			tripDraft: pending.tripDraft,
			errors: pending.errors,
			ui: pending.ui,
		};
		setTurns((prev) => [...prev, committed]);
		setPendingTurn(null);
	}, []);

	const clearConversation = useCallback(() => {
		setTurns([]);
		setPendingTurn(null);
		setIsItinerarySaved(false);
	}, []);

	const loadSession = useCallback((rawMessages: Array<{ role: string; content: string }>) => {
		const converted: Turn[] = rawMessages
			.filter((m) => m.role === "user" || m.role === "assistant")
			.map((m) => {
				if (m.role === "user") {
					return { role: "user" as const, text: m.content, id: uid() };
				}
				let parsedText = m.content;
				let parsedTripDraft: AssistantTurn["tripDraft"] = null;
				try {
					const parsed = JSON.parse(m.content) as { summary?: string; tripDraft?: AssistantTurn["tripDraft"] };
					parsedText = parsed.summary || parsedText;
					parsedTripDraft = parsed.tripDraft ?? null;
				} catch {
					// Keep raw assistant text when session content is plain text.
				}
				return {
					role: "assistant" as const,
					id: uid(),
					text: parsedText,
					workflowSteps: [],
					latency: undefined,
					suggestions: [],
					tripDraft: parsedTripDraft,
					errors: [],
				} satisfies AssistantTurn;
			});
		setTurns(converted);
		setPendingTurn(null);
		setIsItinerarySaved(false);
	}, []);

	return {
		turns,
		pendingTurn,
		setPendingTurn,
		lastAssistantTurn,
		isItinerarySaved,
		setIsItinerarySaved,
		appendUserTurn,
		commitPending,
		clearConversation,
		loadSession,
	};
}
