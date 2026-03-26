import type { TripDraft } from "./state";

export type SupervisorIntent = "informational" | "itinerary";

const ITINERARY_HINTS = [
	/\b(itinerary|route|trip|tour|schedule|stops?)\b/i,
	/\bplan\b/i,
	/\bcreate\b/i,
	/\bbuild\b/i,
	/\bday\s*trip\b/i,
	/\bhalf[ -]?day\b/i,
];

const REVISION_HINTS = [
	/\b(validate|validation|review|critic|critique|check)\b/i,
	/\b(revise|revision|improve|improvement|adjust|change|update|fix|refine)\b/i,
];

function getLatestUserMessage(
	messages: Array<{ role: string; content: string }>
): string {
	return [...messages]
		.reverse()
		.find((message) => message.role === "user")
		?.content ?? "";
}

export function classifySupervisorIntent(input: {
	messages: Array<{ role: string; content: string }>;
	currentTripDraft?: TripDraft;
}): SupervisorIntent {
	const latestUserMessage = getLatestUserMessage(input.messages);

	if (!latestUserMessage) {
		return input.currentTripDraft ? "itinerary" : "informational";
	}

	if (ITINERARY_HINTS.some((pattern) => pattern.test(latestUserMessage))) {
		return "itinerary";
	}

	if (
		input.currentTripDraft &&
		REVISION_HINTS.some((pattern) => pattern.test(latestUserMessage))
	) {
		return "itinerary";
	}

	return "informational";
}

export function isCriticRequested(input: {
	messages: Array<{ role: string; content: string }>;
	currentTripDraft?: TripDraft;
}): boolean {
	const latestUserMessage = getLatestUserMessage(input.messages);
	if (!latestUserMessage) {
		return false;
	}

	const requestsCritic = REVISION_HINTS.some((pattern) => pattern.test(latestUserMessage));
	if (!requestsCritic) {
		return false;
	}

	return Boolean(input.currentTripDraft) || /\bitinerary\b|\broute\b|\bdraft\b/i.test(latestUserMessage);
}
