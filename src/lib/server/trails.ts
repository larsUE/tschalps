// Trail categories along a route, from the swisstopo base map vector tiles.
//
// The tiles' `transportation` layer carries swissTLM3D's hiking network as `sac_scale`:
// hiking = yellow Wanderweg, mountain_hiking = white-red-white Bergwanderweg,
// alpine_hiking = white-blue-white Alpinwanderweg. Lines without it are roads and paths
// outside the network. No line near the route means it went cross-country.
// The network is today's, so for old tours it is an approximation.

import { VectorTile, type VectorTileLayer } from '@mapbox/vector-tile';
import { PbfReader } from 'pbf';
import type { TrackPoint } from '#lib/geo.ts';
import { TRAIL_CATEGORIES, type TrailCategory, type TrailMix } from '#lib/labels.ts';

const TILE_URL = 'https://vectortiles.geo.admin.ch/tiles/ch.swisstopo.base.vt/v1.0.0';
const Z = 14; // highest zoom of the tileset
const EXTENT = 4096;
const WORLD = 2 ** Z * EXTENT; // tile units around the equator

/** Route pieces are classified at their midpoint; shorter pieces are more precise. */
const PIECE_M = 20;
/** A marked trail this close counts (GPS error, hand-drawn routes, generalised lines). */
const MARKED_RADIUS_M = 25;
/** Any other path or road this close counts as walking on it. */
const PATH_RADIUS_M = 20;

/** Lines nobody walks on. */
const NOT_WALKABLE = new Set([
	'rail',
	'transit',
	'cable_car',
	'chair_lift',
	'gondola',
	'drag_lift',
	'aerialway',
	'ferry',
	'car_ferry',
	'motorway',
	'motorway_construction'
]);

const SAC_CATEGORY: Record<string, TrailCategory> = {
	hiking: 'gelb',
	mountain_hiking: 'rot',
	demanding_mountain_hiking: 'rot',
	alpine_hiking: 'blau',
	demanding_alpine_hiking: 'blau',
	difficult_alpine_hiking: 'blau'
};

type Line = { category: TrailCategory | null; points: [number, number][] }; // null: unmarked
type Tile = { lines: Line[]; countries: { swiss: boolean; rings: [number, number][][] }[] };

// Web Mercator in global tile units (x right, y down).
const project = (p: { lng: number; lat: number }): [number, number] => {
	const s = Math.sin((p.lat * Math.PI) / 180);
	return [
		((p.lng + 180) / 360) * WORLD,
		(0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * WORLD
	];
};
/** Metres per tile unit at a latitude. */
const unitM = (lat: number) => (40_075_016.686 * Math.cos((lat * Math.PI) / 180)) / WORLD;

function decodeLayer<T>(
	layer: VectorTileLayer | undefined,
	x: number,
	y: number,
	map: (type: number, props: Record<string, unknown>, rings: [number, number][][]) => T | null
): T[] {
	if (!layer) return [];
	const out: T[] = [];
	for (let i = 0; i < layer.length; i++) {
		const f = layer.feature(i);
		const scale = EXTENT / layer.extent;
		const rings = f
			.loadGeometry()
			.map((ring) =>
				ring.map((p): [number, number] => [
					(x * layer.extent + p.x) * scale,
					(y * layer.extent + p.y) * scale
				])
			);
		const item = map(f.type, f.properties, rings);
		if (item) out.push(item);
	}
	return out;
}

async function fetchTile(x: number, y: number): Promise<Tile> {
	const res = await fetch(`${TILE_URL}/${Z}/${x}/${y}.pbf`, {
		signal: AbortSignal.timeout(20_000)
	});
	if (res.status === 204 || res.status === 404) return { lines: [], countries: [] };
	if (!res.ok) throw new Error(`swisstopo tile ${x}/${y}: HTTP ${res.status}`);
	const tile = new VectorTile(new PbfReader(new Uint8Array(await res.arrayBuffer())));

	const lines = decodeLayer(tile.layers.transportation, x, y, (type, props, rings) => {
		if (type !== 2 || NOT_WALKABLE.has(String(props.class))) return null;
		const category = SAC_CATEGORY[String(props.sac_scale)] ?? null;
		return rings.map((points) => ({ category, points }));
	}).flat();

	const countries = decodeLayer(tile.layers.administrative_unit, x, y, (type, props, rings) =>
		type === 3 && props.class === 'country'
			? { swiss: props.iso_a2 === 'CH' || props.iso_a2 === 'LI', rings }
			: null
	);
	return { lines, countries };
}

/** Even-odd point-in-polygon over all rings (holes included). */
function inside([px, py]: [number, number], rings: [number, number][][]) {
	let hit = false;
	for (const ring of rings) {
		for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
			const [xi, yi] = ring[i];
			const [xj, yj] = ring[j];
			if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) hit = !hit;
		}
	}
	return hit;
}

function segmentDistance([px, py]: [number, number], [ax, ay]: number[], [bx, by]: number[]) {
	const dx = bx - ax;
	const dy = by - ay;
	const len = dx * dx + dy * dy;
	const t = len ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len)) : 0;
	return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Cuts the route into pieces of at most PIECE_M; returns each piece's midpoint and length. */
function pieces(segments: TrackPoint[][]) {
	const out: { mid: { lng: number; lat: number }; m: number }[] = [];
	for (const segment of segments) {
		for (let i = 1; i < segment.length; i++) {
			const a = segment[i - 1];
			const b = segment[i];
			const dLat = (b.lat - a.lat) * 111_195;
			const dLng = (b.lng - a.lng) * 111_195 * Math.cos((a.lat * Math.PI) / 180);
			const m = Math.hypot(dLat, dLng);
			const n = Math.max(1, Math.ceil(m / PIECE_M));
			for (let k = 0; k < n; k++) {
				const t = (k + 0.5) / n;
				out.push({
					mid: { lng: a.lng + t * (b.lng - a.lng), lat: a.lat + t * (b.lat - a.lat) },
					m: m / n
				});
			}
		}
	}
	return out;
}

/**
 * Metres of the route per trail category (`unbekannt`: outside Switzerland and
 * Liechtenstein, where the tiles have no paths). Fetches the needed swisstopo tiles
 * (about one per 1.5 km of route); throws when they cannot be loaded.
 */
export async function analyseTrails(
	segments: TrackPoint[][],
	cache = new Map<string, Promise<Tile>>()
): Promise<TrailMix> {
	const items = pieces(segments).map((p) => {
		const xy = project(p.mid);
		const r = MARKED_RADIUS_M / unitM(p.mid.lat);
		// The piece's tile, plus neighbours when a line there could be within reach.
		const keys = new Set<string>();
		for (const dx of [-r, 0, r])
			for (const dy of [-r, 0, r])
				keys.add(`${Math.floor((xy[0] + dx) / EXTENT)}/${Math.floor((xy[1] + dy) / EXTENT)}`);
		return { ...p, xy, unit: unitM(p.mid.lat), keys: [...keys] };
	});

	const load = (key: string) => {
		let tile = cache.get(key);
		if (!tile) {
			const [x, y] = key.split('/').map(Number);
			tile = fetchTile(x, y);
			cache.set(key, tile);
		}
		return tile;
	};
	// A few requests at a time, to be polite to the tile server.
	const keys = [...new Set(items.flatMap((i) => i.keys))];
	const tiles = new Map<string, Tile>();
	for (let i = 0; i < keys.length; i += 6) {
		const batch = keys.slice(i, i + 6);
		const loaded = await Promise.all(batch.map(load));
		batch.forEach((k, j) => tiles.set(k, loaded[j]));
	}

	const mix = Object.fromEntries(TRAIL_CATEGORIES.map((c) => [c, 0])) as TrailMix;
	mix.unbekannt = 0;
	for (const item of items) {
		const own = tiles.get(`${Math.floor(item.xy[0] / EXTENT)}/${Math.floor(item.xy[1] / EXTENT)}`)!;
		const country = own.countries.find((c) => inside(item.xy, c.rings));
		if (!country?.swiss) {
			mix.unbekannt += item.m;
			continue;
		}

		let marked: { d: number; category: TrailCategory } | null = null;
		let path = Infinity;
		for (const key of item.keys) {
			for (const line of tiles.get(key)!.lines) {
				for (let i = 1; i < line.points.length; i++) {
					const d = segmentDistance(item.xy, line.points[i - 1], line.points[i]) * item.unit;
					if (line.category && d <= MARKED_RADIUS_M && (!marked || d < marked.d))
						marked = { d, category: line.category };
					if (d < path) path = d;
				}
			}
		}
		const category = marked?.category ?? (path <= PATH_RADIUS_M ? 'unmarkiert' : 'weglos');
		mix[category] += item.m;
	}

	for (const c of TRAIL_CATEGORIES) mix[c] = Math.round(mix[c]);
	mix.unbekannt = Math.round(mix.unbekannt);
	return mix;
}
