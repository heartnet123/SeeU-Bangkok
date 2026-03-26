import { openaiGenerateText } from "@/lib/openai";
import { isWithinRattanakosin } from "@/lib/tools";
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

interface ScopeLocationExtractionResult {
	areas: string[];
}

interface ResolvedArea {
	label: string;
	lat: number;
	lng: number;
}

interface ScopeResolutionDeps {
	extractAreas?: (message: string) => Promise<string[]>;
	resolveArea?: (area: string) => Promise<ResolvedArea | null>;
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

function extractJsonObject(text: string): string | null {
	const start = text.indexOf("{");
	const end = text.lastIndexOf("}");
	if (start === -1 || end === -1 || end <= start) {
		return null;
	}

	return text.slice(start, end + 1);
}

async function extractExplicitAreasWithLlm(message: string): Promise<string[]> {
	const response = await openaiGenerateText(message, {
		model: "gpt-5-mini-2025-08-07",
		temperature: 0,
		max_completion_tokens: 180,
		system: `You extract explicitly mentioned geographic areas from travel requests.

Return JSON only with this exact shape:
{"areas":["..."]}

Rules:
- Extract only explicitly mentioned areas, neighborhoods, districts, cities, stations, landmarks, roads, or venues.
- Do not infer hidden locations.
- Preserve the original wording when possible.
- Return an empty array when no explicit geographic area is mentioned.
- Examples of explicit areas: "Ekkamai", "Thonglor", "Chiang Mai", "Asok", "Siam", "Rattanakosin", "Wat Pho".`,
	});

	const jsonText = extractJsonObject(response);
	if (!jsonText) {
		return [];
	}

	try {
		const parsed = JSON.parse(jsonText) as Partial<ScopeLocationExtractionResult>;
		if (!Array.isArray(parsed.areas)) {
			return [];
		}

		return parsed.areas
			.filter((area): area is string => typeof area === "string")
			.map((area) => area.trim())
			.filter(Boolean);
	} catch {
		return [];
	}
}

async function resolveAreaWithMapbox(area: string): Promise<ResolvedArea | null> {
	const token = process.env.MAPBOX_ACCESS_TOKEN || process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
	if (!token) {
		return null;
	}

	const url = new URL("https://api.mapbox.com/search/geocode/v6/forward");
	url.searchParams.set("q", area);
	url.searchParams.set("access_token", token);
	url.searchParams.set("limit", "1");
	url.searchParams.set("country", "TH");
	url.searchParams.set("language", "th,en");
	url.searchParams.set("proximity", "100.5018,13.7563");

	try {
		const response = await fetch(url.toString());
		if (!response.ok) {
			return null;
		}

		const payload = await response.json() as {
			features?: Array<{
				properties?: { full_address?: string; name?: string };
				geometry?: { coordinates?: [number, number] };
			}>;
		};

		const feature = payload.features?.[0];
		const coordinates = feature?.geometry?.coordinates;
		if (!coordinates || coordinates.length < 2) {
			return null;
		}

		return {
			label: feature?.properties?.full_address || feature?.properties?.name || area,
			lng: coordinates[0],
			lat: coordinates[1],
		};
	} catch {
		return null;
	}
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

export async function classifyScopeWithResolution(
	input: {
		messages: Array<{ role: string; content: string }>;
	},
	deps: ScopeResolutionDeps = {}
): Promise<ScopeClassificationResult> {
	const baseClassification = classifyScope(input);
	if (baseClassification.classification !== "implicit_in_scope") {
		return baseClassification;
	}

	const latestUserMessage = [...input.messages]
		.reverse()
		.find((message) => message.role === "user")?.content;

	if (!latestUserMessage) {
		return baseClassification;
	}

	const extractAreas = deps.extractAreas || extractExplicitAreasWithLlm;
	const resolveArea = deps.resolveArea || resolveAreaWithMapbox;

	let extractedAreas: string[] = [];
	try {
		extractedAreas = await extractAreas(latestUserMessage);
	} catch {
		return baseClassification;
	}

	if (extractedAreas.length === 0) {
		return baseClassification;
	}

	for (const area of extractedAreas) {
		const normalizedArea = normalizeInput(area);
		if (matchTerms(normalizedArea, IN_SCOPE_TERMS).length > 0) {
			return {
				classification: "in_scope",
				matchedTerms: [area],
			};
		}

		const resolvedArea = await resolveArea(area);
		if (!resolvedArea) {
			continue;
		}

		if (!isWithinRattanakosin({ lat: resolvedArea.lat, lng: resolvedArea.lng })) {
			return {
				classification: looksLikeTripRequest(normalizeInput(latestUserMessage))
					? "out_of_scope_trip"
					: "out_of_scope_place",
				reasonCode: "OUT_OF_SCOPE",
				matchedTerms: [area],
			};
		}

		return {
			classification: "in_scope",
			matchedTerms: [area],
		};
	}

	return baseClassification;
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
			summary: `I only have travel data for Rattanakosin, and there is no real ${requestedFeature} setting in this area.`,
			places: [],
			tripDraft: null,
			actions: [],
			warnings: ["IMPOSSIBLE_GEOGRAPHY"],
			raw_text: `I currently only have travel data for Rattanakosin, and there is no real ${requestedFeature} setting in this area. If you want, I can suggest realistic options inside Rattanakosin such as temples, museums, cafés, or old-town walking spots.`,
		};
	}

	if (input.classification === "non_tourism") {
		return {
			version: "1.0",
			intent: "refusal",
			sessionId: input.sessionId,
			summary: "I currently only support tourism-related requests within Rattanakosin.",
			places: [],
			tripDraft: null,
			actions: [],
			warnings: ["NON_TOURISM"],
			raw_text: `I currently only support tourism-related requests within Rattanakosin. I can help with attractions, temples, museums, cafés, walking routes, and short trip planning in this area.`,
		};
	}

	const locationLabel = matched[0] || "that area";
	return {
		version: "1.0",
		intent: "refusal",
		sessionId: input.sessionId,
		summary: `I do not have data for ${locationLabel} yet. Right now I only have travel data for the Rattanakosin area.`,
		places: [],
		tripDraft: null,
		actions: [],
		warnings: ["OUT_OF_SCOPE"],
		raw_text: `I currently only have data for ${focusArea}, so I cannot recommend or plan trips for ${locationLabel} yet. If you want to travel within Rattanakosin, such as Sanam Luang, Wat Phra Kaew, Wat Pho, or Khao San, I can help right away.`,
	};
}
