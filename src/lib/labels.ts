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
export const formatShortDate = (iso: string | null | undefined) =>
	iso ? shortDateFormat.format(parseDate(iso)) : '';

/** Distinct colours for the days of a tour, readable on both the map and aerial imagery. */
export const DAY_COLORS = [
	'#c026d3',
	'#2563eb',
	'#ea580c',
	'#0d9488',
	'#7c3aed',
	'#dc2626',
	'#0891b2',
	'#65a30d'
];
export const dayColor = (dayIndex: number) => DAY_COLORS[(dayIndex - 1) % DAY_COLORS.length];
