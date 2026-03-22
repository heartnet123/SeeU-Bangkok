import type { AssistantTurn } from "../types";

type ParsedAssistantMessage = Pick<AssistantTurn, "text" | "suggestions" | "tripDraft" | "ui">;

function isUiPayload(value: unknown): value is NonNullable<AssistantTurn["ui"]> {
	if (!value || typeof value !== "object") return false;
	const payload = value as Record<string, unknown>;
	return (
		payload.version === "1.0" &&
		typeof payload.summary === "string" &&
		Array.isArray(payload.places) &&
		Array.isArray(payload.actions) &&
		Array.isArray(payload.warnings)
	);
}

export function parseStoredAssistantMessage(content: string): ParsedAssistantMessage {
	try {
		const parsed = JSON.parse(content) as unknown;
		if (isUiPayload(parsed)) {
			return {
				text: parsed.summary,
				suggestions: parsed.places,
				tripDraft: parsed.tripDraft ?? null,
				ui: parsed,
			};
		}
	} catch {
		// Keep plain text fallback.
	}

	return {
		text: content,
		suggestions: [],
		tripDraft: null,
		ui: undefined,
	};
}
