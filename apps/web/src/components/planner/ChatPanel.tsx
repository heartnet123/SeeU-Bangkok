"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Map, Maximize2, MessageSquare, Minimize2, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";
import { ChatInputBar } from "./chat/ChatInputBar";
import { ChatMessageList } from "./chat/ChatMessageList";
import { QUICK_SUGGESTIONS } from "./chat/constants";
import { useChatActions } from "./chat/hooks/useChatActions";
import { useChatHistory } from "./chat/hooks/useChatHistory";
import { useChatStream } from "./chat/hooks/useChatStream";
import type { ChatPanelProps } from "./chat/types";

export function ChatPanel({
	onPlacesFound,
	onAddPlaceToTrip,
	onTripDraftCreated,
	onPreviewTripDraft,
	userLocation,
	defaultOpen = false,
	sessionId,
	authToken,
	onSessionCreated,
	sessionMessages,
	contextPlaces,
}: ChatPanelProps) {
	const [isOpen, setIsOpen] = useState(defaultOpen);
	const [isMinimized, setIsMinimized] = useState(false);
	const messagesEndRef = useRef<HTMLDivElement>(null);
	const { user, session } = useAuth();

	// React to defaultOpen changes (e.g., selecting a session from history)
	useEffect(() => {
		if (defaultOpen) setIsOpen(true);
	}, [defaultOpen]);

	const {
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
	} = useChatHistory({ onPlacesFound, onTripDraftCreated });

	// Load session messages when a session is selected from history
	useEffect(() => {
		if (sessionMessages) {
			loadSession(sessionMessages);
		}
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [sessionMessages]);

	const { isStreaming, startWithMessage, stop } = useChatStream({
		userLocation,
		sessionId,
		authToken,
		contextPlaces,
		onSessionCreated: (id) => onSessionCreated?.(id),
		appendUserTurn,
		setPendingTurn,
		commitPending,
		onAcceptedMessage: () => setIsItinerarySaved(false),
	});

	const {
		input,
		setInput,
		isSavingItinerary,
		handleSend,
		handleKeyDown,
		handleSaveItinerary,
		handleViewPlace,
		handleClearConversation,
	} = useChatActions({
		startWithMessage,
		lastAssistantTurn,
		user,
		session,
		setIsItinerarySaved,
		clearConversation: () => {
			clearConversation();
			onSessionCreated?.(null);
		},
	});

	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [turns, pendingTurn]);

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
					"fixed bottom-4 right-4 sm:bottom-6 sm:right-6 shadow-2xl z-50 overflow-hidden flex flex-col",
					isMinimized
						? "w-80 h-14"
						: "w-[95vw] max-w-[440px] h-[65vh] sm:w-[440px] sm:h-[680px]",
				)}
			>
				<CardHeader className="flex flex-row items-center justify-between py-3 px-4 border-b bg-card shrink-0">
					<CardTitle className="text-sm flex items-center gap-2 font-semibold">
						<div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
							<Map className="h-4 w-4 text-primary" />
						</div>
						Map Assistant
						{isStreaming && (
							<span className="text-[10px] text-muted-foreground font-normal animate-pulse">
								thinking...
							</span>
						)}
					</CardTitle>
					<div className="flex gap-1">
						<Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsMinimized((v) => !v)}>
							{isMinimized ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
						</Button>
						<Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsOpen(false)}>
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
							<CardContent className="flex-1 overflow-y-auto p-4 space-y-6">
								<ChatMessageList
									turns={turns}
									pendingTurn={pendingTurn}
									isStreaming={isStreaming}
									isSavingItinerary={isSavingItinerary}
									isItinerarySaved={isItinerarySaved}
									quickSuggestions={QUICK_SUGGESTIONS}
									messagesEndRef={messagesEndRef}
									onQuickSuggestion={(text) => {
										void startWithMessage(text);
									}}
									onAddPlace={onAddPlaceToTrip}
									onViewPlace={handleViewPlace}
									onSaveItinerary={() => {
										void handleSaveItinerary();
									}}
									onPreviewTripDraft={onPreviewTripDraft}
									onFollowUp={(text) => {
										void startWithMessage(text);
									}}
								/>
							</CardContent>

							<ChatInputBar
								input={input}
								isStreaming={isStreaming}
								hasTurns={turns.length > 0}
								onInputChange={setInput}
								onKeyDown={handleKeyDown}
								onSend={handleSend}
								onStop={stop}
								onClearConversation={handleClearConversation}
							/>
						</motion.div>
					)}
				</AnimatePresence>
			</Card>
		</motion.div>
	);
}
