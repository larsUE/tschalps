import { DOMParser, type Element } from '@xmldom/xmldom';
import { bbox, distance, routeStats, toStageGeometry, type TrackPoint } from '#lib/geo.ts';

export type GpxTrack = { name?: string; segments: TrackPoint[][] };
export type GpxWaypoint = { name?: string; lat: number; lng: number };
export type GpxFile = { name?: string; tracks: GpxTrack[]; waypoints: GpxWaypoint[] };

export class GpxError extends Error {}

const children = (parent: Element, localName: string) =>
	Array.from(parent.getElementsByTagNameNS('*', localName));

const directChild = (parent: Element, localName: string) =>
	Array.from(parent.childNodes).find(
		(n): n is Element => n.nodeType === 1 && (n as Element).localName === localName
	);

const text = (el: Element | undefined) => el?.textContent?.trim() || undefined;

function readPoint(el: Element): TrackPoint | null {
	const lat = Number(el.getAttribute('lat'));
	const lng = Number(el.getAttribute('lon'));
	if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
		return null;
	}
	const point: TrackPoint = { lng, lat };
	const ele = Number(text(directChild(el, 'ele')));
	if (text(directChild(el, 'ele')) !== undefined && Number.isFinite(ele)) point.ele = ele;
	const time = Date.parse(text(directChild(el, 'time')) ?? '');
	if (Number.isFinite(time)) point.time = time;
	return point;
}

/** Reads tracks (trk/trkseg), routes (rte) and top-level waypoints (wpt) from a GPX document. */
export function parseGpx(xml: string): GpxFile {
	let doc;
	try {
		doc = new DOMParser().parseFromString(xml, 'text/xml');
	} catch {
		throw new GpxError('Die Datei ist kein gültiges GPX (XML-Fehler).');
	}
	const root = doc.documentElement;
	if (!root || root.localName !== 'gpx') throw new GpxError('Die Datei ist keine GPX-Datei.');

	const metadata = directChild(root, 'metadata');
	const file: GpxFile = {
		name: text(metadata && directChild(metadata, 'name')),
		tracks: [],
		waypoints: []
	};

	for (const trk of children(root, 'trk')) {
		const segments = children(trk, 'trkseg')
			.map((seg) =>
				children(seg, 'trkpt')
					.map(readPoint)
					.filter((p) => p !== null)
			)
			.filter((s) => s.length >= 2);
		if (segments.length) file.tracks.push({ name: text(directChild(trk, 'name')), segments });
	}
	for (const rte of children(root, 'rte')) {
		const points = children(rte, 'rtept')
			.map(readPoint)
			.filter((p) => p !== null);
		if (points.length >= 2)
			file.tracks.push({ name: text(directChild(rte, 'name')), segments: [points] });
	}

	if (!file.tracks.length) throw new GpxError('Die Datei enthält keine Route (keine Trackpunkte).');

	for (const wpt of Array.from(root.childNodes)) {
		if (wpt.nodeType !== 1 || (wpt as Element).localName !== 'wpt') continue;
		const p = readPoint(wpt as Element);
		if (p)
			file.waypoints.push({
				name: text(directChild(wpt as Element, 'name')),
				lat: p.lat,
				lng: p.lng
			});
	}
	return file;
}

const zurichDate = new Intl.DateTimeFormat('en-CA', {
	timeZone: 'Europe/Zurich',
	year: 'numeric',
	month: '2-digit',
	day: '2-digit'
});
/** Local calendar day (YYYY-MM-DD) in Switzerland. */
export const localDate = (time: number) => zurichDate.format(time);

export type StageDraft = {
	date?: string;
	title?: string;
	segments: TrackPoint[][];
	/** Waypoint that marked the end of this day (the night's place), when split at waypoints. */
	night?: GpxWaypoint;
	/** Index of the uploaded file, when this stage is exactly that whole file (keep the original). */
	wholeFileIndex?: number;
};

/**
 * Waypoint names that mark a night: "1", "2.", "1.Nacht", "Nacht 2: Alpe Moesola".
 * Planners (e.g. SchweizMobil) number the night spots on a week-long route this way.
 */
const NIGHT_NAME = /nacht|^\s*\d+\s*\.?\s*$/i;
/** A night waypoint further than this from the track is not used to split it. */
const NIGHT_SNAP_M = 500;
/** Ignore cuts closer than this (along the track) to the start, the end or another cut. */
const MIN_DAY_M = 1000;

/**
 * Splits an undated track into days at its night waypoints. Numbered waypoints are
 * taken in number order along the track (so a route crossing itself splits correctly);
 * otherwise each waypoint goes to its nearest track point.
 */
export function splitAtNights(
	segments: TrackPoint[][],
	waypoints: GpxWaypoint[]
): { segments: TrackPoint[][]; night?: GpxWaypoint }[] {
	const nights = waypoints.filter((w) => w.name && NIGHT_NAME.test(w.name));
	if (!nights.length) return [{ segments }];

	// Flatten the track, remembering where segments start and the distance walked so far.
	const flat: { p: TrackPoint; seg: number; along: number }[] = [];
	let along = 0;
	segments.forEach((segment, seg) =>
		segment.forEach((p, i) => {
			if (i > 0) along += distance(segment[i - 1], p);
			flat.push({ p, seg, along });
		})
	);
	const total = along;

	const nearest = (w: GpxWaypoint, from: number) => {
		let best = -1;
		let bestD = NIGHT_SNAP_M;
		for (let i = from; i < flat.length; i++) {
			const d = distance(w, flat[i].p);
			if (d <= bestD) [best, bestD] = [i, d];
		}
		return best;
	};

	const number = (w: GpxWaypoint) => Number(w.name!.match(/\d+/)?.[0] ?? NaN);
	const numbered = nights.every((w) => Number.isFinite(number(w)));
	let cuts: { index: number; night: GpxWaypoint }[] = [];
	if (numbered) {
		let from = 0;
		for (const night of [...nights].sort((a, b) => number(a) - number(b))) {
			const index = nearest(night, from);
			if (index < 0) continue;
			cuts.push({ index, night });
			from = index + 1;
		}
	} else {
		cuts = nights
			.map((night) => ({ index: nearest(night, 0), night }))
			.filter((c) => c.index >= 0)
			.sort((a, b) => a.index - b.index);
	}

	let last = 0;
	cuts = cuts.filter((c) => {
		const a = flat[c.index].along;
		if (a - last < MIN_DAY_M || total - a < MIN_DAY_M) return false;
		last = a;
		return true;
	});

	const days: { segments: TrackPoint[][]; night?: GpxWaypoint }[] = [];
	let start = 0;
	for (const end of [...cuts, { index: flat.length - 1, night: undefined }]) {
		const daySegments: TrackPoint[][] = [];
		for (let i = start; i <= end.index; i++) {
			if (i === start || flat[i].seg !== flat[i - 1].seg) daySegments.push([]);
			daySegments.at(-1)!.push(flat[i].p);
		}
		days.push({ segments: daySegments.filter((s) => s.length >= 2), night: end.night });
		start = end.index; // the night's point ends one day and starts the next
	}
	return days.filter((d) => d.segments.length);
}

/**
 * Turns uploaded GPX files into one stage per day.
 * - Timestamped points are grouped by local date, across all files: one recording
 *   per day, a whole week in one file, or a day split over several files all work.
 * - Tracks without timestamps (e.g. planned routes) are split at night waypoints
 *   ("1", "2", "1.Nacht" …) when the file has them, else become one stage per track;
 *   they follow the dated stages in file-name order.
 */
export function splitIntoStages(files: { fileName: string; gpx: GpxFile }[]): StageDraft[] {
	const byDate = new Map<
		string,
		{ segments: TrackPoint[][]; titles: string[]; files: Set<number> }
	>();
	const undated: (StageDraft & { files: Set<number> })[] = [];
	const splitFiles = new Set<number>();

	const order = files
		.map((f, index) => ({ ...f, index }))
		.sort((a, b) => a.fileName.localeCompare(b.fileName, 'de', { numeric: true }));

	for (const { gpx, index } of order) {
		for (const track of gpx.tracks) {
			const title = track.name ?? gpx.name;
			const timed = track.segments.every((s) => s.every((p) => p.time !== undefined));

			if (!timed) {
				const days = splitAtNights(track.segments, gpx.waypoints);
				for (const day of days) {
					undated.push({
						// A week's name is not a day's name.
						title: days.length > 1 ? undefined : title,
						segments: day.segments,
						night: day.night,
						files: new Set([index])
					});
				}
				if (days.length > 1) splitFiles.add(index);
				continue;
			}

			for (const segment of track.segments) {
				let current: TrackPoint[] = [];
				let currentDate = localDate(segment[0].time!);
				const flush = () => {
					if (current.length < 2) return;
					const day = byDate.get(currentDate) ?? { segments: [], titles: [], files: new Set() };
					day.segments.push(current);
					if (title && !day.titles.includes(title)) day.titles.push(title);
					day.files.add(index);
					byDate.set(currentDate, day);
				};
				for (const p of segment) {
					const date = localDate(p.time!);
					if (date !== currentDate) {
						flush();
						splitFiles.add(index);
						current = [];
						currentDate = date;
					}
					current.push(p);
				}
				flush();
			}
		}
	}

	const stages: (StageDraft & { files: Set<number> })[] = [...byDate.entries()]
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([date, day]) => ({
			date,
			title: day.titles.join(' / ') || undefined,
			segments: day.segments.sort((a, b) => a[0].time! - b[0].time!),
			files: day.files
		}));
	stages.push(...undated);

	// A stage can reuse the uploaded file as-is when it is that file and nothing else.
	const stagesPerFile = new Map<number, number>();
	for (const s of stages)
		for (const f of s.files) stagesPerFile.set(f, (stagesPerFile.get(f) ?? 0) + 1);

	return stages.map(({ files: sourceFiles, ...stage }) => {
		const [only] = sourceFiles;
		const whole = sourceFiles.size === 1 && stagesPerFile.get(only) === 1 && !splitFiles.has(only);
		return whole ? { ...stage, wholeFileIndex: only } : stage;
	});
}

/** Everything stored on a stage row that is derived from its track. */
export function stageMetrics(segments: TrackPoint[][]) {
	const stats = routeStats(segments);
	const [minLng, minLat, maxLng, maxLat] = bbox(segments);
	return { ...stats, minLng, minLat, maxLng, maxLat, geojson: toStageGeometry(segments) };
}

const escapeXml = (s: string) =>
	s.replace(
		/[<>&'"]/g,
		(c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]!
	);

/** Serializes tracks to GPX 1.1 (full resolution, with elevation and time). */
export function toGpx(name: string, tracks: GpxTrack[]): string {
	const lines = [
		'<?xml version="1.0" encoding="UTF-8"?>',
		'<gpx version="1.1" creator="Tschalps" xmlns="http://www.topografix.com/GPX/1/1">',
		`<metadata><name>${escapeXml(name)}</name></metadata>`
	];
	for (const track of tracks) {
		lines.push('<trk>');
		if (track.name) lines.push(`<name>${escapeXml(track.name)}</name>`);
		for (const segment of track.segments) {
			lines.push('<trkseg>');
			for (const p of segment) {
				let pt = `<trkpt lat="${p.lat}" lon="${p.lng}">`;
				if (p.ele !== undefined) pt += `<ele>${p.ele}</ele>`;
				if (p.time !== undefined) pt += `<time>${new Date(p.time).toISOString()}</time>`;
				lines.push(`${pt}</trkpt>`);
			}
			lines.push('</trkseg>');
		}
		lines.push('</trk>');
	}
	lines.push('</gpx>');
	return lines.join('\n');
}

export type Waypoint = {
	name: string;
	lat: number;
	lng: number;
	ele?: number | null;
	description?: string | null;
	type?: string;
};

/** Places as GPX waypoints, e.g. to load all known stables onto a GPS before a tour. */
export function toWaypointsGpx(name: string, waypoints: Waypoint[]): string {
	const lines = [
		'<?xml version="1.0" encoding="UTF-8"?>',
		'<gpx version="1.1" creator="Tschalps" xmlns="http://www.topografix.com/GPX/1/1">',
		`<metadata><name>${escapeXml(name)}</name></metadata>`
	];
	for (const w of waypoints) {
		let wpt = `<wpt lat="${w.lat}" lon="${w.lng}">`;
		if (w.ele != null) wpt += `<ele>${Math.round(w.ele)}</ele>`;
		wpt += `<name>${escapeXml(w.name)}</name>`;
		if (w.description) wpt += `<desc>${escapeXml(w.description)}</desc>`;
		if (w.type) wpt += `<type>${escapeXml(w.type)}</type>`;
		lines.push(`${wpt}</wpt>`);
	}
	lines.push('</gpx>');
	return lines.join('\n');
}
