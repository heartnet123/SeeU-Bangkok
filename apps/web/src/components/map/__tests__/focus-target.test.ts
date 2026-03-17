import { describe, expect, test } from "bun:test";
import { getFocusTarget } from "../lib/focus-target";

describe("getFocusTarget", () => {
	test("returns a point target for a single valid trip stop", () => {
		const target = getFocusTarget([
			{ lat: 13.7437, lng: 100.4889 },
		]);

		expect(target).toEqual({
			type: "point",
			center: [100.4889, 13.7437],
		});
	});

	test("returns bounds target for multiple valid trip stops", () => {
		const target = getFocusTarget([
			{ lat: 13.7437, lng: 100.4889 },
			{ lat: 13.7527, lng: 100.4931 },
		]);

		expect(target).toEqual({
			type: "bounds",
			coordinates: [
				[100.4889, 13.7437],
				[100.4931, 13.7527],
			],
		});
	});

	test("ignores invalid coordinates and returns null when nothing remains", () => {
		const target = getFocusTarget([
			{ lat: Number.NaN, lng: 100.4889 },
			{ lat: 13.7527, lng: Number.NaN },
		]);

		expect(target).toBeNull();
	});
});
