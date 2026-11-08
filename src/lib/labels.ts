// German display labels for stored enum values.

export const SEASON_LABELS = {
	fruehling: 'Frühling',
	sommer: 'Sommer',
	herbst: 'Herbst',
	winter: 'Winter'
} as const;

export type Season = keyof typeof SEASON_LABELS;

const dateFormat = new Intl.DateTimeFormat('de-CH', {
	day: 'numeric',
	month: 'long',
	year: 'numeric'
});
const shortDateFormat = new Intl.DateTimeFormat('de-CH', {
	weekday: 'short',
	day: 'numeric',
	month: 'numeric'
});

/** Formats a stored ISO date (YYYY-MM-DD) without time zone surprises. */
const parseDate = (iso: string) => {
	const [y, m, d] = iso.split('-').map(Number);
	return new Date(Date.UTC(y, m - 1, d, 12));
};

export const formatDate = (iso: string | null | undefined) =>
	iso ? dateFormat.format(parseDate(iso)) : '';
/** "20.–27. Juli 2026"; a single date when start and end match or one is missing. */
export function formatDateRange(start: string | null | undefined, end: string | null | undefined) {
	if (!start) return formatDate(end);
	if (!end || end === start) return formatDate(start);
	return dateFormat.formatRange(parseDate(start), parseDate(end));
}
export const formatShortDate = (iso: string | null | undefined) =>
	iso ? shortDateFormat.format(parseDate(iso)) : '';

/** Route red (mountain-trail marker). Used for a single tour's stages. */
export const TRAIL_COLOR = '#be2a1f';

/**
 * Route colours by year on the overview map: the newest year is trail red, older years
 * cycle through colours that stay distinct on the national map and aerial imagery.
 */
export const YEAR_COLORS = ['#be2a1f', '#c76a12', '#2d7a55', '#2a63a8', '#6e4c9e', '#8a5a2b'];

/** Maps each year to its colour, given all years present (any order, duplicates allowed). */
export function yearColors(years: Iterable<number>): Map<number, string> {
	const sorted = [...new Set(years)].sort((a, b) => b - a);
	return new Map(sorted.map((y, i) => [y, YEAR_COLORS[i % YEAR_COLORS.length]]));
}

// Places ---------------------------------------------------------------------

export const PLACE_TYPE_LABELS = {
	stall: 'Stall',
	scheune: 'Scheune',
	huette: 'Hütte',
	biwak: 'Biwak',
	wasser: 'Wasser',
	gipfel: 'Gipfel',
	pass: 'Pass',
	anderes: 'Anderes'
} as const;

export type PlaceType = keyof typeof PLACE_TYPE_LABELS;

/** Marker colours: places to sleep in the place blue, water in water blue, summits in ink. */
export const PLACE_TYPE_COLORS: Record<PlaceType, string> = {
	stall: '#1e4f7a',
	scheune: '#1e4f7a',
	huette: '#6e4c9e',
	biwak: '#8a5a2b',
	wasser: '#3d8fc6',
	gipfel: '#17201b',
	pass: '#5c7d2e',
	anderes: '#59615b'
};

export const PLACE_STATUS_LABELS = {
	aktiv: 'Aktiv',
	existiert_nicht_mehr: 'Existiert nicht mehr',
	unbekannt: 'Status unbekannt'
} as const;

export type PlaceStatus = keyof typeof PLACE_STATUS_LABELS;

// Tour categories --------------------------------------------------------------

export const TOUR_KIND_LABELS = {
	schueler: 'Schülertschalps',
	lehrer: 'Lehrertschalps'
} as const;

export type TourKind = keyof typeof TOUR_KIND_LABELS;

/** SAC hiking scale, as used on Swiss trail signs and in guide books. */
export const DIFFICULTY_LABELS = {
	T1: 'T1 · Wandern',
	T2: 'T2 · Bergwandern',
	T3: 'T3 · Anspruchsvolles Bergwandern',
	T4: 'T4 · Alpinwandern',
	T5: 'T5 · Anspruchsvolles Alpinwandern',
	T6: 'T6 · Schwieriges Alpinwandern'
} as const;

export type Difficulty = keyof typeof DIFFICULTY_LABELS;

/** Highest difficulty in a list (T1 < … < T6), or null. */
export const maxDifficulty = (values: (Difficulty | null | undefined)[]) =>
	values
		.filter((d): d is Difficulty => !!d)
		.sort()
		.at(-1) ?? null;

// Trail categories ------------------------------------------------------------

/** Swiss trail marking: yellow, white-red-white, white-blue-white, other paths, no path. */
export const TRAIL_CATEGORIES = ['gelb', 'rot', 'blau', 'unmarkiert', 'weglos'] as const;
export type TrailCategory = (typeof TRAIL_CATEGORIES)[number];

/** Metres walked per trail category; `unbekannt`: outside Switzerland (no data). */
export type TrailMix = Record<TrailCategory, number> & { unbekannt?: number };

export const TRAIL_LABELS: Record<TrailCategory, string> = {
	gelb: 'Wanderweg',
	rot: 'Bergwanderweg',
	blau: 'Alpinwanderweg',
	unmarkiert: 'Weg ohne Markierung',
	weglos: 'Weglos'
};

export const TRAIL_COLORS: Record<TrailCategory, string> = {
	gelb: '#e8b400',
	rot: '#be2a1f',
	blau: '#2a63a8',
	unmarkiert: '#8c928d',
	weglos: '#d9d9d1'
};

/** Adds up trail mixes (e.g. all stages of a tour); null when none was computed. */
export function sumTrailMix(mixes: (TrailMix | null | undefined)[]): TrailMix | null {
	const known = mixes.filter((m): m is TrailMix => !!m);
	if (!known.length) return null;
	const total = Object.fromEntries(TRAIL_CATEGORIES.map((c) => [c, 0])) as TrailMix;
	total.unbekannt = 0;
	for (const m of known) {
		for (const c of TRAIL_CATEGORIES) total[c] += m[c] ?? 0;
		total.unbekannt += m.unbekannt ?? 0;
	}
	return total;
}
