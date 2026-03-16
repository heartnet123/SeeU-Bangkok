import { nameToSlug } from "@/lib/slug-utils";
import type {
	CandidatePlace,
	PlanningConstraints,
	TripDraft,
	TripValidation,
} from "../state";

interface RouteLegMetrics {
	from: string;
	to: string;
	distance_km: number;
	duration_min?: number;
}

interface BuiltRouteMetrics {
	order: string[];
	legs: RouteLegMetrics[];
	total_km: number;
	total_mins?: number;
}

interface ExtractPlanningConstraintsOptions {
	userLocation?: { lat: number; lng: number };
}

interface BuildTripDraftParams {
	title?: string;
	summary?: string;
	candidates: CandidatePlace[];
	constraints: PlanningConstraints;
	origin?: { lat: number; lng: number };
}

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
	const R = 6371;
	const dLat = ((b.lat - a.lat) * Math.PI) / 180;
	const dLng = ((b.lng - a.lng) * Math.PI) / 180;
	const lat1 = (a.lat * Math.PI) / 180;
	const lat2 = (b.lat * Math.PI) / 180;
	const h =
		Math.sin(dLat / 2) ** 2 +
		Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
	const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
	return R * c;
}

function parseRequestedStopCount(input: string): number | undefined {
	const match = input.match(/(\d+)\s+(?:stop|stops|place|places|spot|spots)/i);
	if (!match) return undefined;
	return Number(match[1]);
}

function parseRequestedDurationMinutes(input: string): number | undefined {
	const hourMatch = input.match(/(\d+)\s*(?:hour|hours|hr|hrs)/i);
	if (hourMatch) return Number(hourMatch[1]) * 60;

	if (/half[- ]day/i.test(input)) return 240;
	if (/full[- ]day|day trip|all day/i.test(input)) return 480;

	return undefined;
}

function inferThemes(input: string): string[] {
	const lower = input.toLowerCase();
	const themes = new Set<string>();
	if (lower.includes("temple")) themes.add("temple");
	if (lower.includes("cafe")) themes.add("cafe");
	if (lower.includes("food") || lower.includes("restaurant")) themes.add("restaurant");
	if (lower.includes("market")) themes.add("market");
	if (lower.includes("museum")) themes.add("museum");
	if (lower.includes("park")) themes.add("park");
	if (lower.includes("shopping")) themes.add("shopping");
	if (lower.includes("kid") || lower.includes("family")) themes.add("kid-friendly");
	return [...themes];
}

export function extractPlanningConstraints(
	request: string,
	options: ExtractPlanningConstraintsOptions = {}
): PlanningConstraints {
	const lower = request.toLowerCase();
	const durationMinutes = parseRequestedDurationMinutes(request) ?? 360;
	const maxStops =
		parseRequestedStopCount(request) ??
		(durationMinutes <= 120 ? 2 : durationMinutes <= 240 ? 4 : 5);

	const budgetLevel = /low budget|cheap|budget|under\s*฿/i.test(lower)
		? "low"
		: /luxury|premium|high[- ]end/i.test(lower)
			? "high"
			: "medium";

	const groupType = /family|kid|children/i.test(lower)
		? "family"
		: /couple|date/i.test(lower)
			? "couple"
			: /friends|group|team/i.test(lower)
				? "group"
				: "solo";

	const locationBias = /near me|close to me|around me/i.test(lower)
		? {
			mode: "near_user" as const,
			origin: options.userLocation,
		}
		: undefined;

	return {
		durationMinutes,
		maxStops: Math.min(Math.max(maxStops, 1), 8),
		budgetLevel,
		groupType,
		themes: inferThemes(request),
		locationBias,
	};
}

function scoreCandidate(
	place: CandidatePlace,
	constraints: PlanningConstraints,
	origin?: { lat: number; lng: number }
): number {
	let score = 0;

	if (constraints.themes.length > 0) {
		const tags = new Set((place.tags || []).map((tag) => tag.toLowerCase()));
		for (const theme of constraints.themes) {
			if (tags.has(theme.toLowerCase())) score += 25;
		}
	}

	if (constraints.budgetLevel === "low" && typeof place.price === "number") {
		score += Math.max(0, 20 - place.price / 50);
	}

	if (origin && typeof place.lat === "number" && typeof place.lng === "number") {
		score += Math.max(0, 15 - haversineKm(origin, { lat: place.lat, lng: place.lng }));
	}

	if (place.description) score += 2;
	return score;
}

export function selectTripCandidates(
	candidates: CandidatePlace[],
	constraints: PlanningConstraints,
	origin?: { lat: number; lng: number }
): CandidatePlace[] {
	return candidates
		.map((candidate) => ({
			...candidate,
			slug: candidate.slug || nameToSlug(candidate.name),
		}))
		.sort((a, b) => scoreCandidate(b, constraints, origin) - scoreCandidate(a, constraints, origin))
		.slice(0, constraints.maxStops);
}

function orderPlaces(
	places: CandidatePlace[],
	origin?: { lat: number; lng: number }
): CandidatePlace[] {
	if (places.length <= 1) return places;

	const byId = new Map(places.map((place) => [place.id, place]));
	const unvisited = new Set(places.map((place) => place.id));
	const ordered: CandidatePlace[] = [];

	let current = origin;
	while (unvisited.size > 0) {
		let bestId: string | null = null;
		let bestDistance = Number.POSITIVE_INFINITY;

		for (const id of unvisited) {
			const place = byId.get(id);
			if (!place || typeof place.lat !== "number" || typeof place.lng !== "number") continue;

			const distance = current
				? haversineKm(current, { lat: place.lat, lng: place.lng })
				: 0;

			if (distance < bestDistance) {
				bestDistance = distance;
				bestId = id;
			}
		}

		const fallbackId = bestId || [...unvisited][0] || null;
		if (!fallbackId) break;

		const next = byId.get(fallbackId);
		if (!next) break;

		ordered.push(next);
		unvisited.delete(fallbackId);
		if (typeof next.lat === "number" && typeof next.lng === "number") {
			current = { lat: next.lat, lng: next.lng };
		}
	}

	return ordered;
}

export function computeTripValidation(draft: Pick<TripDraft, "stops" | "total_distance_km" | "total_minutes">): TripValidation {
	const warnings: string[] = [];
	const suggestions: string[] = [];
	let score = 100;

	if (draft.stops.length < 2) {
		warnings.push("Trip has fewer than 2 stops");
		suggestions.push("Add another place to make the route more worthwhile");
		score -= 20;
	}

	if (draft.stops.length > 8) {
		warnings.push("Trip has too many stops for one day");
		suggestions.push("Reduce stop count or split the trip");
		score -= 15;
	}

	if (draft.total_minutes > 600) {
		warnings.push("Trip is longer than 10 hours");
		suggestions.push("Reduce stop count or travel distance");
		score -= 15;
	}

	if (draft.total_distance_km > 50) {
		warnings.push("Trip covers too much distance for a relaxed day");
		suggestions.push("Focus on a smaller area");
		score -= 15;
	}

	if (draft.stops.some((stop) => typeof stop.lat !== "number" || typeof stop.lng !== "number")) {
		warnings.push("Some stops are missing map coordinates");
		suggestions.push("Use places with exact coordinates for reliable preview");
		score -= 10;
	}

	score = Math.max(0, score);

	return {
		isValid: score >= 50,
		score,
		warnings,
		suggestions,
	};
}

export function buildTripDraftFromCandidates({
	title = "Suggested Trip",
	summary,
	candidates,
	constraints,
	origin,
}: BuildTripDraftParams): TripDraft {
	const ranked = selectTripCandidates(candidates, constraints, origin);

	const ordered = orderPlaces(
		ranked,
		constraints.locationBias?.mode === "near_user"
			? constraints.locationBias.origin
			: origin
	);

	let totalDistance = 0;
	let totalTravelMinutes = 0;

	const stops = ordered.map((place, index) => {
		const prev = ordered[index - 1];
		const legDistance =
			prev && typeof prev.lat === "number" && typeof prev.lng === "number" && typeof place.lat === "number" && typeof place.lng === "number"
				? haversineKm({ lat: prev.lat, lng: prev.lng }, { lat: place.lat, lng: place.lng })
				: 0;
		const travelTime = index === 0 ? 0 : Math.max(1, Math.ceil((legDistance / 25) * 60));
		totalDistance += legDistance;
		totalTravelMinutes += travelTime;

		return {
			id: place.id,
			place_id: place.id,
			slug: place.slug,
			name: place.name,
			lat: place.lat,
			lng: place.lng,
			suggested_time_min: 60,
			travel_time_from_prev_min: travelTime,
			distance_from_prev_km: Math.round(legDistance * 10) / 10,
			notes: place.description || "",
		};
	});

	const computedSummary =
		summary ||
		`${stops.length} stop${stops.length === 1 ? "" : "s"} planned with a ${constraints.durationMinutes}-minute budget.`;

	const draftBase = {
		title,
		summary: computedSummary,
		constraints,
		places: ordered,
		stops,
		total_distance_km: Math.round(totalDistance * 10) / 10,
		total_minutes: stops.length * 60 + totalTravelMinutes,
	};

	const validation = computeTripValidation(draftBase);

	return {
		...draftBase,
		warnings: validation.warnings,
		validation,
	};
}

export function buildTripDraftFromRoute({
	title = "Suggested Trip",
	summary,
	candidates,
	constraints,
	route,
}: {
	title?: string;
	summary?: string;
	candidates: CandidatePlace[];
	constraints: PlanningConstraints;
	route: BuiltRouteMetrics;
}): TripDraft {
	const normalizedCandidates = candidates.map((candidate) => ({
		...candidate,
		slug: candidate.slug || nameToSlug(candidate.name),
	}));
	const bySlug = new Map(normalizedCandidates.map((candidate) => [candidate.slug, candidate] as const));
	const ordered = route.order
		.map((slug) => bySlug.get(slug))
		.filter((candidate): candidate is CandidatePlace => Boolean(candidate));

	const stops = ordered.map((place, index) => {
		const leg = route.legs.find((entry) => entry.to === place.slug);
		return {
			id: place.id,
			place_id: place.id,
			slug: place.slug || nameToSlug(place.name),
			name: place.name,
			lat: place.lat,
			lng: place.lng,
			suggested_time_min: 60,
			travel_time_from_prev_min: index === 0 ? 0 : leg?.duration_min || 0,
			distance_from_prev_km: index === 0 ? 0 : Math.round((leg?.distance_km || 0) * 10) / 10,
			notes: place.description || "",
		};
	});

	const computedSummary =
		summary ||
		`${stops.length} stop${stops.length === 1 ? "" : "s"} planned with a ${constraints.durationMinutes}-minute budget.`;

	const draftBase = {
		title,
		summary: computedSummary,
		constraints,
		places: ordered,
		stops,
		total_distance_km: route.total_km,
		total_minutes: stops.length * 60 + (route.total_mins || 0),
	};

	const validation = computeTripValidation(draftBase);

	return {
		...draftBase,
		warnings: validation.warnings,
		validation,
	};
}
