import { type UiResponsePayload } from "./state";

export type ScopeClassification =
	| "in_scope"
	| "implicit_in_scope"
	| "out_of_scope_place"
	| "out_of_scope_trip"
	| "non_tourism"
	| "impossible_geography";

interface ScopeClassificationResult {
	classification: ScopeClassification;
	reasonCode?: "OUT_OF_SCOPE" | "NON_TOURISM" | "IMPOSSIBLE_GEOGRAPHY";
	matchedTerms: string[];
}

const IN_SCOPE_TERMS = [
	"rattanakosin",
	"rattanakosin island",
	"bangkok old town",
	"old town",
	"phra nakhon",
	"เขตพระนคร",
	"เกาะรัตนโกสินทร์",
	"สนามหลวง",
	"sanam luang",
	"grand palace",
	"พระบรมมหาราชวัง",
	"wat phra kaew",
	"วัดพระแก้ว",
	"wat pho",
	"วัดโพธิ์",
	"khao san",
	"ถนนข้าวสาร",
	"museum siam",
];

const OUT_OF_SCOPE_TERMS = [
	"siam",
	"ari",
	"thonglor",
	"ทองหล่อ",
	"สุขุมวิท",
	"sukhumvit",
	"chiang mai",
	"เชียงใหม่",
	"pattaya",
	"พัทยา",
	"phuket",
	"ภูเก็ต",
	"outside bangkok",
	"outside of bangkok",
	"ต่างจังหวัด",
];

const NON_TOURISM_TERMS = [
	"stock",
	"bitcoin",
	"crypto",
	"programming",
	"code",
	"debug",
	"database",
	"sql",
	"homework",
	"math",
	"physics",
	"politics",
];

const IMPOSSIBLE_GEOGRAPHY_TERMS = [
	"beach",
	"beaches",
	"beachfront",
	"sea",
	"seaside",
	"ocean",
	"mountain",
	"mountains",
	"snow",
	"ski",
	"skiing",
	"hiking trail",
];

const TRIP_TERMS = [
	"trip",
	"itinerary",
	"route",
	"tour",
	"plan",
	"day trip",
	"2-day",
	"2 day",
	"overnight",
	"one-day",
];

const TOURISM_SIGNAL_TERMS = [
	"recommend",
	"suggest",
	"place",
	"places",
	"landmark",
	"landmarks",
	"attraction",
	"attractions",
	"historical",
	"history",
	"cultural",
	"culture",
	"temple",
	"temples",
	"museum",
	"museums",
	"cafe",
	"cafés",
	"coffee",
	"restaurant",
	"food",
	"walking",
	"walk",
	"photo",
	"photography",
	"tourist",
	"tourism",
	"เที่ยว",
	"ทริป",
	"วัด",
	"พิพิธภัณฑ์",
	"ร้านกาแฟ",
	"คาเฟ่",
	"ของกิน",
	"ถ่ายรูป",
	"ประวัติศาสตร์",
	"สถานที่",
	"ที่เที่ยว",
];

function normalizeInput(input: string): string {
	return input.trim().toLowerCase();
}

function matchTerms(input: string, terms: string[]): string[] {
	return terms.filter((term) => input.includes(term));
}

function looksLikeTripRequest(input: string): boolean {
	return TRIP_TERMS.some((term) => input.includes(term));
}

function looksLikeTourismRequest(input: string): boolean {
	return TOURISM_SIGNAL_TERMS.some((term) => input.includes(term)) || looksLikeTripRequest(input);
}

export function classifyScope(input: {
	messages: Array<{ role: string; content: string }>;
}): ScopeClassificationResult {
	const latestUserMessage = [...input.messages]
		.reverse()
		.find((message) => message.role === "user")?.content;

	if (!latestUserMessage) {
		return {
			classification: "in_scope",
			matchedTerms: [],
		};
	}

	const normalized = normalizeInput(latestUserMessage);
	const impossibleMatches = matchTerms(normalized, IMPOSSIBLE_GEOGRAPHY_TERMS);
	if (impossibleMatches.length > 0) {
		return {
			classification: "impossible_geography",
			reasonCode: "IMPOSSIBLE_GEOGRAPHY",
			matchedTerms: impossibleMatches,
		};
	}

	const outOfScopeMatches = matchTerms(normalized, OUT_OF_SCOPE_TERMS);
	if (outOfScopeMatches.length > 0) {
		return {
			classification: looksLikeTripRequest(normalized)
				? "out_of_scope_trip"
				: "out_of_scope_place",
			reasonCode: "OUT_OF_SCOPE",
			matchedTerms: outOfScopeMatches,
		};
	}

	const nonTourismMatches = matchTerms(normalized, NON_TOURISM_TERMS);
	const inScopeMatches = matchTerms(normalized, IN_SCOPE_TERMS);
	if (nonTourismMatches.length > 0 && inScopeMatches.length === 0) {
		return {
			classification: "non_tourism",
			reasonCode: "NON_TOURISM",
			matchedTerms: nonTourismMatches,
		};
	}

	if (inScopeMatches.length === 0 && looksLikeTourismRequest(normalized)) {
		return {
			classification: "implicit_in_scope",
			matchedTerms: [],
		};
	}

	return {
		classification: "in_scope",
		matchedTerms: inScopeMatches,
	};
}

export function buildScopeRefusalPayload(input: {
	classification: Exclude<ScopeClassification, "in_scope" | "implicit_in_scope">;
	sessionId?: string;
	matchedTerms?: string[];
}): UiResponsePayload {
	const matched = input.matchedTerms?.filter(Boolean) ?? [];
	const focusArea = "Rattanakosin travel planning around areas like Sanam Luang, the Grand Palace, Wat Pho, and Khao San";

	if (input.classification === "impossible_geography") {
		const requestedFeature = matched[0] || "that feature";
		return {
			version: "1.0",
			intent: "refusal",
			sessionId: input.sessionId,
			summary: `There is no ${requestedFeature} setting within Rattanakosin. I can only recommend real places inside the old-town area.`,
			places: [],
			tripDraft: null,
			actions: [],
			warnings: ["IMPOSSIBLE_GEOGRAPHY"],
			raw_text: `Sorry, I can only help with real travel options inside Rattanakosin. There is no ${requestedFeature} setting in this area. If you want, I can suggest riverside, temple, café, or museum options within Rattanakosin instead.`,
		};
	}

	if (input.classification === "non_tourism") {
		return {
			version: "1.0",
			intent: "refusal",
			sessionId: input.sessionId,
			summary: "I can only help with tourism-related requests within Rattanakosin.",
			places: [],
			tripDraft: null,
			actions: [],
			warnings: ["NON_TOURISM"],
			raw_text: `Sorry, I specialize only in tourism within Rattanakosin. I can help with place recommendations, walking routes, cafés, museums, temples, and short itineraries in that area.`,
		};
	}

	const locationLabel = matched[0] || "that area";
	return {
		version: "1.0",
		intent: "refusal",
		sessionId: input.sessionId,
		summary: `I can only help with travel inside Rattanakosin, so I can’t plan for ${locationLabel}.`,
		places: [],
		tripDraft: null,
		actions: [],
		warnings: ["OUT_OF_SCOPE"],
		raw_text: `Sorry, I specialize only in ${focusArea}. I can’t recommend or plan trips for ${locationLabel}. If you want to visit places around Sanam Luang, Wat Phra Kaew, Wat Pho, or Khao San, I can help right away.`,
	};
}
