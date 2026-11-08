<script lang="ts" module>
	export type PlaceProps = {
		key: string;
		name: string;
		type: string;
		status: string;
		color: string;
	};
</script>

<script lang="ts">
	import type { FilterSpecification, GeoJSONSource, MapLayerMouseEvent } from 'maplibre-gl';
	import type { FeatureCollection, Point } from 'geojson';
	import { onMount } from 'svelte';
	import { getMapContext } from './context.ts';

	type Props = {
		id?: string;
		data: FeatureCollection<Point, PlaceProps> | string;
		/** `key` of the place drawn emphasised. */
		highlight?: string | null;
		filter?: FilterSpecification | null;
		/** Smaller dots, e.g. on the overview map where routes come first. */
		small?: boolean;
		onhover?: (props: PlaceProps | null) => void;
		onclick?: (props: PlaceProps) => void;
	};

	let {
		id = 'places',
		data,
		highlight = null,
		filter = null,
		small = false,
		onhover,
		onclick
	}: Props = $props();

	const map = getMapContext()()!;
	const layer = (suffix: string) => `${id}-${suffix}`;

	onMount(() => {
		const scale = small ? 0.75 : 1;
		map.addSource(id, { type: 'geojson', data });
		// Places that no longer exist are drawn hollow and grey.
		const gone = ['==', ['get', 'status'], 'existiert_nicht_mehr'];
		map.addLayer({
			id: layer('dot'),
			type: 'circle',
			source: id,
			paint: {
				'circle-radius': [
					'interpolate',
					['linear'],
					['zoom'],
					7,
					3.5 * scale,
					12,
					6 * scale,
					15,
					8 * scale
				],
				'circle-color': ['case', gone, '#ffffff', ['get', 'color']],
				'circle-stroke-color': ['case', gone, '#8c928d', '#ffffff'],
				'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 7, 1.5, 12, 2.5]
			} as never
		});
		map.addLayer({
			id: layer('highlight'),
			type: 'circle',
			source: id,
			filter: ['==', ['get', 'key'], ''],
			paint: {
				'circle-radius': 11,
				'circle-color': ['get', 'color'],
				'circle-stroke-color': '#17201b',
				'circle-stroke-width': 3
			}
		});

		const enter = (e: MapLayerMouseEvent) => {
			map.getCanvas().style.cursor = 'pointer';
			onhover?.(e.features?.[0]?.properties as PlaceProps);
		};
		const leave = () => {
			map.getCanvas().style.cursor = '';
			onhover?.(null);
		};
		const click = (e: MapLayerMouseEvent) => {
			const props = e.features?.[0]?.properties as PlaceProps | undefined;
			if (props) onclick?.(props);
		};
		map.on('mousemove', layer('dot'), enter);
		map.on('mouseleave', layer('dot'), leave);
		map.on('click', layer('dot'), click);

		return () => {
			map.off('mousemove', layer('dot'), enter);
			map.off('mouseleave', layer('dot'), leave);
			map.off('click', layer('dot'), click);
			if (!map.getStyle()) return;
			for (const suffix of ['highlight', 'dot']) {
				if (map.getLayer(layer(suffix))) map.removeLayer(layer(suffix));
			}
			if (map.getSource(id)) map.removeSource(id);
		};
	});

	$effect(() => {
		(map.getSource(id) as GeoJSONSource | undefined)?.setData(data);
	});

	$effect(() => {
		if (map.getLayer(layer('dot'))) map.setFilter(layer('dot'), filter);
	});

	$effect(() => {
		if (map.getLayer(layer('highlight'))) {
			map.setFilter(layer('highlight'), ['==', ['get', 'key'], highlight ?? '']);
		}
	});
</script>
