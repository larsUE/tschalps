import type { StyleSpecification } from 'maplibre-gl';

/**
 * Base maps and overlays. All are raster sources in one style, switched by layer
 * visibility, so data layers (routes, places) stay on the map when the base map changes.
 *
 * swisstopo tiles are free to use with attribution (geo.admin.ch terms of use).
 * The national map also covers the border regions; OpenTopoMap covers areas beyond that.
 */
const SWISSTOPO =
	'<a href="https://www.swisstopo.admin.ch/" target="_blank" rel="noopener">© swisstopo</a>';

const wmts = (layer: string, format: 'jpeg' | 'png') =>
	`https://wmts.geo.admin.ch/1.0.0/${layer}/default/current/3857/{z}/{x}/{y}.${format}`;

export const BASEMAPS = [
	{
		id: 'landeskarte',
		label: 'Landeskarte',
		tiles: [wmts('ch.swisstopo.pixelkarte-farbe', 'jpeg')],
		maxzoom: 18,
		attribution: SWISSTOPO
	},
	{
		id: 'luftbild',
		label: 'Luftbild',
		tiles: [wmts('ch.swisstopo.swissimage', 'jpeg')],
		maxzoom: 19,
		attribution: SWISSTOPO
	},
	{
		id: 'opentopomap',
		label: 'OpenTopoMap',
		tiles: ['a', 'b', 'c'].map((s) => `https://${s}.tile.opentopomap.org/{z}/{x}/{y}.png`),
		maxzoom: 17,
		attribution:
			'Kartendaten: © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>-Mitwirkende, SRTM | Darstellung: © <a href="https://opentopomap.org" target="_blank" rel="noopener">OpenTopoMap</a> (CC-BY-SA)'
	}
] as const;

export type BasemapId = (typeof BASEMAPS)[number]['id'];

export const OVERLAYS = [
	{
		id: 'wanderwege',
		label: 'Wanderwege',
		tiles: [wmts('ch.swisstopo.swisstlm3d-wanderwege', 'png')],
		maxzoom: 18,
		minzoom: 10,
		attribution: SWISSTOPO
	}
] as const;

export type OverlayId = (typeof OVERLAYS)[number]['id'];

export const DEFAULT_BASEMAP: BasemapId = 'landeskarte';

export const isBasemapId = (value: unknown): value is BasemapId =>
	BASEMAPS.some((b) => b.id === value);

/** Layer id of a base map or overlay inside the style. */
export const layerId = (id: BasemapId | OverlayId) => `base-${id}`;

/** Initial view: the Swiss Alps. */
export const ALPS_BOUNDS: [[number, number], [number, number]] = [
	[5.9, 45.8],
	[10.5, 47.0]
];

export function buildStyle(basemap: BasemapId, overlays: OverlayId[]): StyleSpecification {
	const style: StyleSpecification = {
		version: 8,
		sources: {},
		layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#ecede5' } }]
	};

	for (const b of BASEMAPS) {
		style.sources[b.id] = {
			type: 'raster',
			tiles: [...b.tiles],
			tileSize: 256,
			maxzoom: b.maxzoom,
			attribution: b.attribution
		};
		style.layers.push({
			id: layerId(b.id),
			type: 'raster',
			source: b.id,
			layout: { visibility: b.id === basemap ? 'visible' : 'none' }
		});
	}

	for (const o of OVERLAYS) {
		style.sources[o.id] = {
			type: 'raster',
			tiles: [...o.tiles],
			tileSize: 256,
			minzoom: o.minzoom,
			maxzoom: o.maxzoom,
			attribution: o.attribution
		};
		style.layers.push({
			id: layerId(o.id),
			type: 'raster',
			source: o.id,
			layout: { visibility: overlays.includes(o.id) ? 'visible' : 'none' }
		});
	}

	return style;
}
