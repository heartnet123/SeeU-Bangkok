import { useCallback, useEffect, useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { AssistantTurn, PendingTurn, Turn } from "../types";
import { uid } from "../constants";

interface UseChatHistoryParams {
	onPlacesFound?: (places: AssistantTurn["suggestions"]) => void;
	onItineraryCreated?: (itinerary: unknown) => void;
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
}

export function useChatHistory({
	onPlacesFound,
	onItineraryCreated,
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
		if (lastAssistantTurn?.itinerary && onItineraryCreated) {
			onItineraryCreated(lastAssistantTurn.itinerary);
			setIsItinerarySaved(false);
		}
	}, [lastAssistantTurn?.itinerary, onItineraryCreated]);

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
			itinerary: pending.itinerary,
			errors: pending.errors,
		};
		setTurns((prev) => [...prev, committed]);
		setPendingTurn(null);
	}, []);

	const clearConversation = useCallback(() => {
		setTurns([]);
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
	};
}
