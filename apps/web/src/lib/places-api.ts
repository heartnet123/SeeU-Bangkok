import { nameToSlug } from "@/lib/slug-utils";

interface PlaceApiRecord {
	id: string;
	name: string;
	description?: string | null;
	name_th?: string | null;
	description_th?: string | null;
	tags?: unknown;
	lat?: number;
	lng?: number;
	address?: string | null;
	price?: number | null;
	image_url?: string | null;
	slug?: string | null;
}

export interface PlaceListItem {
	id: string;
	name: string;
	description: string;
	name_th?: string;
	description_th?: string;
	tags: string[];
	lat?: number;
	lng?: number;
	address: string;
	price: number;
	image_url: string;
	slug: string;
}

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

interface FetchPlacesListOptions {
	serverUrl: string;
	fetchImpl?: FetchLike;
}

function normalizePlace(place: PlaceApiRecord): PlaceListItem {
	return {
		id: place.id,
		name: place.name,
		description: place.description || "No description available",
		...(place.name_th ? { name_th: place.name_th } : {}),
		...(place.description_th ? { description_th: place.description_th } : {}),
		tags: Array.isArray(place.tags) ? place.tags : [],
		...(typeof place.lat === "number" ? { lat: place.lat } : {}),
		...(typeof place.lng === "number" ? { lng: place.lng } : {}),
		address: place.address || "",
		price: typeof place.price === "number" ? place.price : 0,
		image_url: place.image_url || "",
		slug: place.slug || nameToSlug(place.name || "unknown-place"),
	};
}

export async function fetchPlacesList({
	serverUrl,
	fetchImpl = fetch,
}: FetchPlacesListOptions): Promise<PlaceListItem[]> {
	const baseUrl = serverUrl.replace(/\/$/, "");
	const response = await fetchImpl(`${baseUrl}/api/places?limit=100`);
	const isJson = (response.headers.get("content-type") || "").includes("application/json");
	const payload = isJson ? await response.json() : null;

	if (!response.ok || !payload?.success) {
		const message =
			payload?.error ||
			payload?.message ||
			`Failed to fetch places (status ${response.status})`;
		throw new Error(message);
	}

	return Array.isArray(payload.data) ? payload.data.map(normalizePlace) : [];
}
