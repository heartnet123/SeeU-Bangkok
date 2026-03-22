import type { AssistantTurn, ParsedItinerary, ParsedPlace } from "../types";

export function looksLikeMarkdown(text: string): boolean {
	return /(\*\*[\s\S]+?\*\*|^#{1,3}\s|^[-*+]\s|\n[-*+]\s|^\d+\.\s|\n\d+\.\s)/m.test(text);
}

export function isPlaceListText(text: string): boolean {
	const matches = text.match(/\n\d+\.\s+\*\*[^*]+\*\*/g);
	return matches !== null && matches.length >= 2;
}

export function extractIntroText(text: string): string {
	const idx = text.search(/\n\d+\.\s+\*\*/);
	if (idx === -1) return "";
	return text.slice(0, idx).trim();
}

export function parsePlacesFromMarkdown(text: string): ParsedPlace[] {
	const places: ParsedPlace[] = [];
	const sections = text.split(/\n(?=\d+\.\s+\*\*)/);
	for (const section of sections) {
		const nameMatch = section.match(/^\d+\.\s+\*\*([^*]+)\*\*/);
		if (!nameMatch) continue;
		const name = nameMatch[1].trim();
		const body = section.slice(nameMatch[0].length);

		const locMatch = body.match(/Location:\s*([\d.-]+),\s*([\d.-]+)/);
		const lat = locMatch ? parseFloat(locMatch[1]) : undefined;
		const lng = locMatch ? parseFloat(locMatch[2]) : undefined;

		const descMatch = body.match(/Description:\s*([\s\S]+?)(?=\n\s*\n|\s*$)/);
		const description = descMatch
			? descMatch[1].replace(/\n\s+/g, " ").trim()
			: body.replace(/Location:.*?(?:\n|$)/g, "").trim();

		if (name) places.push({ name, description, lat, lng });
	}
	return places;
}

export function isItineraryText(text: string): boolean {
	if (!/itinerary|tour|trip plan/i.test(text)) return false;
	const durCount = (text.match(/\bDuration:/gi) ?? []).length;
	const locCount = (text.match(/\bLocation:/gi) ?? []).length;
	if (durCount >= 2 || locCount >= 2) return true;
	const hasTotalDuration = /Total Duration/i.test(text);
	const stopCount = (text.match(/^\d+[\.\)]\s+/gm) ?? []).length;
	return (hasTotalDuration || locCount >= 2) && stopCount >= 2;
}

function parseDurationToMinutes(value: string, unit: string): number {
	const n = parseFloat(value);
	return unit.toLowerCase().startsWith("hour") ? Math.round(n * 60) : Math.round(n);
}

export function parseItineraryFromText(text: string): ParsedItinerary | null {
	const titleMatch = text.match(/^(.+(?:itinerary|tour|trip\splan).+)$/im);
	const title = titleMatch ? titleMatch[1].replace(/\*\*/g, "").trim() : "Trip Plan";

	const stopSections = text.split(/\n(?=\d+[\.\)]\s+\*{0,2}[A-Z\u0E00-\u0E7F])/);
	const stops: ParsedItinerary["stops"] = [];

	for (const section of stopSections) {
		const nameMatch = section.match(/^\d+[\.\)]\s+\*{0,2}([^*\n]+)\*{0,2}/);
		if (!nameMatch) continue;
		const name = nameMatch[1].replace(/\*\*/g, "").trim();
		if (/summary|validation|travel time|why this|overview/i.test(name)) continue;
		if (!name || name.length < 3) continue;

		const durMatch = section.match(/\bDuration:[^\d\n]*([\d.]+)\s*(minutes?|hours?)/i);
		const suggested_time_min = durMatch ? parseDurationToMinutes(durMatch[1], durMatch[2]) : 45;

		const distMatch = section.match(/Distance[^:\d]*[:~]?\s*~?([\d.]+)\s*km/i);
		const distance_from_prev_km = distMatch ? parseFloat(distMatch[1]) : 0;

		let notes = "Trip stop details";
		const explicitDesc = section.match(/\bDescription\b[^:\n]*:\s*\**([^*]+)\**/i) || section.match(/\bDescription\b[^:\n]*:\s*([^\n]+)/i);
		if (explicitDesc) {
			notes = explicitDesc[1].trim();
		} else {
			const inlineDesc = section.match(/\*{1,2}\s+([^*\n]{5,})/);
			if (inlineDesc) {
				notes = inlineDesc[1]
					.replace(/\s*-\s*\*\*Travel to next stop[^*]*\*\*/i, "")
					.replace(/\*\*/g, "")
					.trim();
			}
		}

		const locMatch = section.match(/\bLocation\b[^:\n]*:\s*\**([-\d.]+)[^\d,]*,\s*\**([-\d.]+)/i);
		const lat = locMatch ? parseFloat(locMatch[1]) : undefined;
		const lng = locMatch ? parseFloat(locMatch[2]) : undefined;

		stops.push({ name, suggested_time_min, distance_from_prev_km, notes, lat, lng });
	}

	if (stops.length < 2) return null;

	const totalDistMatch = text.match(
		/Total Distance[^:]*:\s*(?:About\s*)?~?([\d.]+)\s*(?:-\s*([\d.]+))?\s*km/i,
	);
	let total_distance_km: number;
	if (totalDistMatch) {
		const lo = parseFloat(totalDistMatch[1]);
		const hi = totalDistMatch[2] ? parseFloat(totalDistMatch[2]) : lo;
		total_distance_km = Math.round(((lo + hi) / 2) * 10) / 10;
	} else {
		total_distance_km =
			Math.round(stops.reduce((s, st) => s + st.distance_from_prev_km, 0) * 10) / 10;
	}

	const totalDurMatch = text.match(
		/Total Duration[^:\d]*[:~]?\s*(?:Approximately\s*)?([\d.]+)\s*(minutes?|hours?)/i,
	);
	const total_minutes = totalDurMatch
		? parseDurationToMinutes(totalDurMatch[1], totalDurMatch[2])
		: stops.reduce((s, st) => s + st.suggested_time_min, 0);

	return { title, stops, total_distance_km, total_minutes };
}

export function getFollowUpChips(turn: AssistantTurn, hasItinerary: boolean): string[] {
	if (turn.tripDraft || hasItinerary) {
		return [
			"Tell me about the first stop",
			"Find food along the route",
			"How long will this take?",
		];
	}
	if (turn.suggestions.length > 0) {
		const first = turn.suggestions[0]?.name;
		return [
			"Plan a route through these",
			first ? `Find food near ${first}` : "Find nearby food",
			"Which is best for families?",
		];
	}
	return ["Tell me more", "Show me something similar", "Plan a day trip"];
}
