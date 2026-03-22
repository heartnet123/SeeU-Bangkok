import { describe, expect, test } from "bun:test";
import {
	applyPlaceFilters,
	cleanPlaceRecord,
	parsePlaceListQuery,
} from "../places-query";

const samplePlaces = [
	{
		id: "1",
		name: "Wat Arun",
		description: "Riverside temple with iconic spires",
		tags: ["temple", "attraction"],
		price: 100,
	},
	{
		id: "2",
		name: "Cafe Chao",
		description: "Coffee by the river",
		tags: ["cafe", "restaurant"],
		price: null,
	},
	{
		id: "3",
		name: "Chatuchak Market",
		description: "Weekend shopping market",
		tags: ["shopping", "market"],
		price: 0,
	},
];

describe("places query helpers", () => {
	test("parsePlaceListQuery accepts query alias and comma separated categories", () => {
		const parsed = parsePlaceListQuery({
			query: "temple",
			categories: "temple,cafe",
			limit: "20",
			offset: "5",
			locale: "th",
		});

		expect(parsed.searchTerm).toBe("temple");
		expect(parsed.categories).toEqual(["temple", "cafe"]);
		expect(parsed.limit).toBe(20);
		expect(parsed.offset).toBe(5);
		expect(parsed.locale).toBe("th");
	});

	test("parsePlaceListQuery falls back to legacy search parameter", () => {
		const parsed = parsePlaceListQuery({
			search: "market",
		});

		expect(parsed.searchTerm).toBe("market");
		expect(parsed.categories).toEqual([]);
	});

	test("applyPlaceFilters uses AND semantics for query plus categories", () => {
		const filtered = applyPlaceFilters(samplePlaces, {
			searchTerm: "river",
			categories: ["cafe"],
			limit: 10,
			offset: 0,
			locale: "en",
		});

		expect(filtered.map((place) => place.id)).toEqual(["2"]);
	});

	test("cleanPlaceRecord normalizes nullable fields and adds slug", () => {
		const cleaned = cleanPlaceRecord({
			id: "2",
			name: "Cafe Chao",
			description: null,
			tags: null,
			price: null,
			image_url: null,
		});

		expect(cleaned.slug).toBe("cafe-chao");
		expect(cleaned.tags).toEqual([]);
		expect(cleaned.price).toBe(0);
		expect(cleaned.image_url).toBe("");
	});
});
