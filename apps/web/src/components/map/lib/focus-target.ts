interface FocusablePoint {
	lat: number;
	lng: number;
}

type PointTarget = {
	type: "point";
	center: [number, number];
};

type BoundsTarget = {
	type: "bounds";
	coordinates: [number, number][];
};

export type FocusTarget = PointTarget | BoundsTarget;

export function getFocusTarget(points: FocusablePoint[]): FocusTarget | null {
	const coordinates = points
		.filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng))
		.map((point) => [point.lng, point.lat] as [number, number]);

	if (coordinates.length === 0) {
		return null;
	}

	if (coordinates.length === 1) {
		return {
			type: "point",
			center: coordinates[0],
		};
	}

	return {
		type: "bounds",
		coordinates,
	};
}
