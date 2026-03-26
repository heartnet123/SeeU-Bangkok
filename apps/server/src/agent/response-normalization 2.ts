import { parseAssistantPayload } from "./payload-parsing";

interface SupervisorMessageLike {
	role?: string;
	content: unknown;
	name?: string;
}

function normalizeMessageContent(message: SupervisorMessageLike): string {
	if (typeof message.content !== "string") {
		return JSON.stringify(message.content ?? null);
	}

	if (message.role !== "assistant") {
		return message.content;
	}

	const parsed = parseAssistantPayload(message.content);
	if (parsed.source === "ui" && parsed.uiPayload) {
		return JSON.stringify(parsed.uiPayload);
	}

	return message.content;
}

export function normalizeSupervisorMessage(message: SupervisorMessageLike): {
	role: string;
	content: string;
	name?: string;
} {
	return {
		role: message.role || "assistant",
		content: normalizeMessageContent(message),
		name: message.name,
	};
}

export function normalizeSupervisorInvocationResult(result: unknown): {
	messages: Array<{ role: string; content: string; name?: string }>;
} {
	if (!result || typeof result !== "object" || !("messages" in result)) {
		return { messages: [] };
	}

	const messages = Array.isArray(result.messages)
		? result.messages.map((message) =>
			normalizeSupervisorMessage(message as SupervisorMessageLike)
		)
		: [];

	return { messages };
}
