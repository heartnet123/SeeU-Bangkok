import { nameToSlug } from "../lib/slug-utils";

export interface PlaceListQuery {
	searchTerm?: string;
	categories: string[];
	limit: number;
	offset: number;
	locale?: string;
}

interface RawPlaceLike {
	id?: string;
	name?: string | null;
	description?: string | null;
	tags?: string[] | null;
	price?: number | null;
	image_url?: string | null;
}

type CleanPlaceRecord<T extends RawPlaceLike> = Omit<T, "name" | "image_url" | "tags" | "price"> & {
	name: string;
	image_url: string;
	tags: string[];
	price: number;
	slug: string;
};

export function parsePlaceListQuery(query: Record<string, string | undefined>): PlaceListQuery {
	const searchTerm = query.query?.trim() || query.search?.trim() || undefined;
	const categories = (query.categories || "")
		.split(",")
		.map((category) => category.trim().toLowerCase())
		.filter(Boolean);

	const limit = Number.parseInt(query.limit || "10", 10);
	const offset = Number.parseInt(query.offset || "0", 10);

	return {
		searchTerm,
		categories,
		limit: Number.isFinite(limit) && limit > 0 ? limit : 10,
		offset: Number.isFinite(offset) && offset >= 0 ? offset : 0,
		locale: query.locale,
	};
}

export function applyPlaceFilters<T extends RawPlaceLike>(
	places: T[],
	query: PlaceListQuery,
): T[] {
	return places.filter((place) => {
		const normalizedTags = Array.isArray(place.tags)
			? place.tags.map((tag) => tag.toLowerCase())
			: [];
		const haystack = `${place.name || ""} ${place.description || ""}`.toLowerCase();
		const matchesSearch = query.searchTerm
			? haystack.includes(query.searchTerm.toLowerCase())
			: true;
		const matchesCategory = query.categories.length > 0
			? query.categories.some((category) =>
				normalizedTags.some((tag) => tag.includes(category)),
			)
			: true;

		return matchesSearch && matchesCategory;
	});
}

export function cleanPlaceRecord<T extends RawPlaceLike>(place: T): CleanPlaceRecord<T> {
	return {
		...place,
		name: place.name || "Unknown Place",
		image_url: place.image_url || "",
		tags: Array.isArray(place.tags) ? place.tags : [],
		price: typeof place.price === "number" ? place.price : 0,
		slug: nameToSlug(place.name || "unknown-place"),
	} as CleanPlaceRecord<T>;
}
