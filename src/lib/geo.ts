// Geometry helpers shared by server (GPX import) and client (elevation profile).

export type TrackPoint = { lng: number; lat: number; ele?: number; time?: number };

/** Stored stage geometry: one line per recorded segment (gaps are not drawn or counted). */
export type StageGeometry = { type: 'MultiLineString'; coordinates: number[][][] };

export type RouteStats = {
	distanceM: number;
	ascentM: number;
	descentM: number;
	minEle: number | null;
	maxEle: number | null;
};

const EARTH_RADIUS_M = 6_371_008.8;
const rad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance in metres. */
export function distance(a: { lng: number; lat: number }, b: { lng: number; lat: number }) {
	const dLat = rad(b.lat - a.lat);
	const dLng = rad(b.lng - a.lng);
	const h =
		Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
	return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Elevation changes smaller than this are treated as GPS noise. Without it, a flat
 * walk with a jittery barometer adds hundreds of phantom metres of ascent.
 */
const ELEVATION_THRESHOLD_M = 5;

export function routeStats(segments: TrackPoint[][]): RouteStats {
	let distanceM = 0;
	let ascentM = 0;
	let descentM = 0;
	let minEle: number | null = null;
	let maxEle: number | null = null;

	for (const segment of segments) {
		let anchor: number | undefined; // last elevation that counted
		for (let i = 0; i < segment.length; i++) {
			const p = segment[i];
			if (i > 0) distanceM += distance(segment[i - 1], p);
			if (p.ele === undefined) continue;

			minEle = minEle === null ? p.ele : Math.min(minEle, p.ele);
			maxEle = maxEle === null ? p.ele : Math.max(maxEle, p.ele);

			if (anchor === undefined) {
				anchor = p.ele;
			} else if (p.ele - anchor >= ELEVATION_THRESHOLD_M) {
				ascentM += p.ele - anchor;
				anchor = p.ele;
			} else if (anchor - p.ele >= ELEVATION_THRESHOLD_M) {
				descentM += anchor - p.ele;
				anchor = p.ele;
			}
		}
	}

	return { distanceM, ascentM, descentM, minEle, maxEle };
}

export function bbox(segments: TrackPoint[][]): [number, number, number, number] {
	let minLng = Infinity;
	let minLat = Infinity;
	let maxLng = -Infinity;
	let maxLat = -Infinity;
	for (const segment of segments) {
		for (const p of segment) {
			minLng = Math.min(minLng, p.lng);
			minLat = Math.min(minLat, p.lat);
			maxLng = Math.max(maxLng, p.lng);
			maxLat = Math.max(maxLat, p.lat);
		}
	}
	return [minLng, minLat, maxLng, maxLat];
}

/** Douglas–Peucker simplification with a tolerance in metres; keeps elevation. */
export function simplify(points: TrackPoint[], toleranceM: number): TrackPoint[] {
	if (points.length <= 2) return points.slice();

	// Local equirectangular projection: accurate enough for a day's walk.
	const lat0 = rad(points[0].lat);
	const kx = EARTH_RADIUS_M * Math.cos(lat0) * (Math.PI / 180);
	const ky = EARTH_RADIUS_M * (Math.PI / 180);
	const xy = points.map((p) => [p.lng * kx, p.lat * ky]);

	const keep = new Uint8Array(points.length);
	keep[0] = keep[points.length - 1] = 1;
	const stack: [number, number][] = [[0, points.length - 1]];
	const tol2 = toleranceM * toleranceM;

	while (stack.length) {
		const [first, last] = stack.pop()!;
		let maxDist = 0;
		let index = -1;
		for (let i = first + 1; i < last; i++) {
			const d = segmentDistance2(xy[i], xy[first], xy[last]);
			if (d > maxDist) {
				maxDist = d;
				index = i;
			}
		}
		if (index !== -1 && maxDist > tol2) {
			keep[index] = 1;
			stack.push([first, index], [index, last]);
		}
	}

	return points.filter((_, i) => keep[i]);
}

function segmentDistance2(p: number[], a: number[], b: number[]) {
	let [x, y] = a;
	let dx = b[0] - x;
	let dy = b[1] - y;
	if (dx !== 0 || dy !== 0) {
		const t = ((p[0] - x) * dx + (p[1] - y) * dy) / (dx * dx + dy * dy);
		if (t > 1) {
			x = b[0];
			y = b[1];
		} else if (t > 0) {
			x += dx * t;
			y += dy * t;
		}
	}
	dx = p[0] - x;
	dy = p[1] - y;
	return dx * dx + dy * dy;
}

const round = (value: number, decimals: number) => {
	const f = 10 ** decimals;
	return Math.round(value * f) / f;
};

/** Simplified geometry for display (~1 m coordinate precision, whole-metre elevation). */
export function toStageGeometry(segments: TrackPoint[][], toleranceM = 5): StageGeometry {
	return {
		type: 'MultiLineString',
		coordinates: segments
			.filter((s) => s.length >= 2)
			.map((s) =>
				simplify(s, toleranceM).map((p) =>
					p.ele === undefined
						? [round(p.lng, 5), round(p.lat, 5)]
						: [round(p.lng, 5), round(p.lat, 5), Math.round(p.ele)]
				)
			)
	};
}

export type ProfilePoint = { d: number; ele: number; lng: number; lat: number };

/**
 * Distance/elevation series for an elevation profile across one or more geometries.
 * Distance runs on across segment gaps without counting the gap itself.
 */
export function profile(geometries: StageGeometry[]): ProfilePoint[] {
	const out: ProfilePoint[] = [];
	let d = 0;
	for (const geometry of geometries) {
		for (const line of geometry.coordinates) {
			for (let i = 0; i < line.length; i++) {
				const [lng, lat, ele] = line[i];
				if (i > 0) d += distance({ lng: line[i - 1][0], lat: line[i - 1][1] }, { lng, lat });
				if (ele !== undefined) out.push({ d, ele, lng, lat });
			}
		}
	}
	return out;
}

// Formatting (de-CH) -------------------------------------------------------

const km = new Intl.NumberFormat('de-CH', { maximumFractionDigits: 1, minimumFractionDigits: 1 });
const int = new Intl.NumberFormat('de-CH', { maximumFractionDigits: 0 });

export const formatKm = (m: number | null | undefined) =>
	m == null ? '–' : `${km.format(m / 1000)} km`;
export const formatM = (m: number | null | undefined) => (m == null ? '–' : `${int.format(m)} m`);

// Swiss coordinates ---------------------------------------------------------

/**
 * WGS84 → Swiss LV95 (E/N in metres), swisstopo's approximate formula (≈1 m accuracy).
 * Used for the swisstopo height service and to show the coordinates Swiss maps print.
 */
export function wgs84ToLv95(lat: number, lng: number) {
	const phi = (lat * 3600 - 169028.66) / 10000;
	const lambda = (lng * 3600 - 26782.5) / 10000;
	const e =
		2600072.37 +
		211455.93 * lambda -
		10938.51 * lambda * phi -
		0.36 * lambda * phi ** 2 -
		44.54 * lambda ** 3;
	const n =
		1200147.07 +
		308807.95 * phi +
		3745.25 * lambda ** 2 +
		76.63 * phi ** 2 -
		194.56 * lambda ** 2 * phi +
		119.79 * phi ** 3;
	return { e, n };
}

const lv95Format = new Intl.NumberFormat('de-CH', { maximumFractionDigits: 0 });
/** "2'700'000 / 1'100'000", as printed on Swiss maps. */
export const formatLv95 = (lat: number, lng: number) => {
	const { e, n } = wgs84ToLv95(lat, lng);
	return `${lv95Format.format(e)} / ${lv95Format.format(n)}`;
};
