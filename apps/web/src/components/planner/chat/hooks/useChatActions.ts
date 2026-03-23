import { useCallback, useState } from "react";
import type { Dispatch, KeyboardEvent, SetStateAction } from "react";
import { toast } from "sonner";
import { buildTripDraftSavePayload } from "../lib/trip-draft";
import type { TripDraft } from "../types";

interface UseChatActionsParams {
	startWithMessage: (text: string) => Promise<void>;
	lastAssistantTurn: { tripDraft: TripDraft | null } | null;
	user: unknown;
	session: { access_token?: string } | null;
	setIsItinerarySaved: (value: boolean) => void;
	clearConversation: () => void;
}

interface UseChatActionsResult {
	input: string;
	setInput: Dispatch<SetStateAction<string>>;
	isSavingItinerary: boolean;
	handleSend: () => void;
	handleKeyDown: (e: KeyboardEvent) => void;
	handleSaveItinerary: () => Promise<void>;
	handleViewPlace: (slug: string) => void;
	handleClearConversation: () => void;
}

export function useChatActions({
	startWithMessage,
	lastAssistantTurn,
	user,
	session,
	setIsItinerarySaved,
	clearConversation,
}: UseChatActionsParams): UseChatActionsResult {
	const [input, setInput] = useState("");
	const [isSavingItinerary, setIsSavingItinerary] = useState(false);

	const handleSend = useCallback(() => {
		if (!input.trim()) return;
		void startWithMessage(input);
		setInput("");
	}, [input, startWithMessage]);

	const handleKeyDown = useCallback(
		(e: KeyboardEvent) => {
			if (e.key === "Enter" && !e.shiftKey) {
				e.preventDefault();
				handleSend();
			}
		},
		[handleSend],
	);

	const handleSaveItinerary = useCallback(async () => {
		if (!lastAssistantTurn?.tripDraft) return;

		if (!user || !session?.access_token) {
			toast.error("Please log in to save itineraries", {
				action: {
					label: "Log in",
					onClick: () => {
						window.location.href = "/auth/login";
					},
				},
			});
			return;
		}

		setIsSavingItinerary(true);
		try {
			const tripDraft = lastAssistantTurn.tripDraft;
			const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:3000";

			const res = await fetch(`${serverUrl}/api/itineraries`, {
				method: "POST",
				headers: {
					Authorization: `Bearer ${session.access_token}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify(buildTripDraftSavePayload(tripDraft)),
			});

			const body = (await res.json()) as { success: boolean; error?: string };

			if (!res.ok || !body.success) {
				throw new Error(body.error ?? `Request failed (${res.status})`);
			}

			setIsItinerarySaved(true);
			toast.success("Itinerary saved!", {
				action: {
					label: "View",
					onClick: () => window.open("/saved-trips", "_blank"),
				},
			});
		} catch (e: unknown) {
			const msg = e instanceof Error ? e.message : "Failed to save itinerary";
			toast.error(msg);
		} finally {
			setIsSavingItinerary(false);
		}
	}, [lastAssistantTurn, session, setIsItinerarySaved, user]);

	const handleViewPlace = useCallback((slug: string) => {
		window.open(`/places/${slug}`, "_blank");
	}, []);

	const handleClearConversation = useCallback(() => {
		clearConversation();
	}, [clearConversation]);

	return {
		input,
		setInput,
		isSavingItinerary,
		handleSend,
		handleKeyDown,
		handleSaveItinerary,
		handleViewPlace,
		handleClearConversation,
	};
}
