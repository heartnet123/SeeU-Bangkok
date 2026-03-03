import { useCallback, useRef, useState } from "react";
import type { PendingTurn } from "../types";
import { parseSseEventBlock, handleStreamEvent } from "../ChatStreamHandler";

interface UseChatStreamParams {
	userLocation?: { lat: number; lng: number };
	appendUserTurn: (text: string) => void;
	setPendingTurn: (value: PendingTurn | null) => void;
	commitPending: (pending: PendingTurn, latency: number) => void;
	onAcceptedMessage?: () => void;
}

interface UseChatStreamResult {
	isStreaming: boolean;
	startWithMessage: (text: string) => Promise<void>;
	stop: () => void;
}

function createPendingTurn(): PendingTurn {
	return {
		workflowSteps: [],
		text: "",
		suggestions: [],
		itinerary: null,
		errors: [],
	};
}

export function useChatStream({
	userLocation,
	appendUserTurn,
	setPendingTurn,
	commitPending,
	onAcceptedMessage,
}: UseChatStreamParams): UseChatStreamResult {
	const controllerRef = useRef<AbortController | null>(null);
	const startTimeRef = useRef<number>(0);
	const pendingRef = useRef<PendingTurn | null>(null);
	const [isStreaming, setIsStreaming] = useState(false);

	const stop = useCallback(() => {
		controllerRef.current?.abort();
		controllerRef.current = null;
		setIsStreaming(false);

		if (!pendingRef.current) return;

		const latency = (Date.now() - startTimeRef.current) / 1000;
		commitPending(pendingRef.current, latency);
		pendingRef.current = null;
	}, [commitPending]);

	const startWithMessage = useCallback(
		async (text: string) => {
			if (!text.trim()) return;

			if (controllerRef.current) {
				controllerRef.current.abort();
				controllerRef.current = null;
			}

			appendUserTurn(text);
			onAcceptedMessage?.();

			let local = createPendingTurn();
			pendingRef.current = local;
			setPendingTurn({ ...local });
			setIsStreaming(true);
			startTimeRef.current = Date.now();

			const updateLocal = (updater: (prev: PendingTurn) => PendingTurn) => {
				local = updater(local);
				pendingRef.current = local;
				setPendingTurn({ ...local });
			};

			const commitCurrent = () => {
				const latency = (Date.now() - startTimeRef.current) / 1000;
				commitPending(local, latency);
				pendingRef.current = null;
				setIsStreaming(false);
			};

			const controller = new AbortController();
			controllerRef.current = controller;

			try {
				const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:3000";
				const payload = {
					messages: [
						{ role: "system", content: "You are a helpful Bangkok travel assistant." },
						{ role: "user", content: text },
					],
					stream: true,
					...(userLocation ? { userLocation } : {}),
				};

				const res = await fetch(`${serverUrl}/api/agent/v2`, {
					method: "POST",
					headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
					body: JSON.stringify(payload),
					signal: controller.signal,
				});

				if (!res.ok || !res.body) {
					updateLocal((prev) => ({
						...prev,
						errors: [...prev.errors, `Request failed (${res.status})`],
					}));
					commitCurrent();
					return;
				}

				const reader = res.body.getReader();
				const decoder = new TextDecoder("utf-8");
				let buffer = "";

				const parseChunk = (chunk: string) => {
					const block = parseSseEventBlock(chunk);
					if (!block) return;
					handleStreamEvent(block.event, block.data, updateLocal, commitCurrent);
				};

				const flush = () => {
					const chunks = buffer.split(/\r?\n\r?\n/);
					buffer = chunks.pop() ?? "";
					for (const chunk of chunks) parseChunk(chunk);
				};

				while (true) {
					const { value, done } = await reader.read();
					if (done) break;
					buffer += decoder.decode(value, { stream: true });
					flush();
				}

				buffer += decoder.decode();
				flush();
				if (buffer.trim()) parseChunk(buffer);
			} catch (error: unknown) {
				if ((error as { name?: string })?.name !== "AbortError") {
					const message = error instanceof Error ? error.message : "Stream error";
					updateLocal((prev) => ({ ...prev, errors: [...prev.errors, message] }));
					commitCurrent();
				}
				setIsStreaming(false);
			}
		},
		[appendUserTurn, commitPending, onAcceptedMessage, setPendingTurn, userLocation],
	);

	return {
		isStreaming,
		startWithMessage,
		stop,
	};
}
