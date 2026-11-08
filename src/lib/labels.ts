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
	anderes: 'Anderes'
} as const;

export type PlaceType = keyof typeof PLACE_TYPE_LABELS;

/** Marker colours: places to sleep in the place blue, water in water blue. */
export const PLACE_TYPE_COLORS: Record<PlaceType, string> = {
	stall: '#1e4f7a',
	scheune: '#1e4f7a',
	huette: '#6e4c9e',
	biwak: '#8a5a2b',
	wasser: '#3d8fc6',
	anderes: '#59615b'
};

export const PLACE_STATUS_LABELS = {
	aktiv: 'Aktiv',
	existiert_nicht_mehr: 'Existiert nicht mehr',
	unbekannt: 'Status unbekannt'
} as const;

export type PlaceStatus = keyof typeof PLACE_STATUS_LABELS;
