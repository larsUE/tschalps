<script lang="ts" module>
	/** Flat properties of a route feature (MapLibre flattens nested objects in events). */
	export type RouteProps = { key: string; color?: string } & Record<string, string | number>;
</script>

<script lang="ts">
	import type {
		ExpressionSpecification,
		FilterSpecification,
		GeoJSONSource,
		MapLayerMouseEvent
	} from 'maplibre-gl';
	import type { FeatureCollection, Geometry } from 'geojson';
	import { onMount } from 'svelte';
	import { getMapContext } from './context.ts';

	type Props = {
		id: string;
		data: FeatureCollection<Geometry, RouteProps> | string;
		/** Line colour for features without a `color` property. */
		color?: string;
		/** `key` of the feature(s) drawn emphasised. */
		highlight?: string | null;
		/** Fade the other routes while one is highlighted. */
		dimOthers?: boolean;
		/** Only draw features matching this MapLibre filter (null: all). */
		filter?: FilterSpecification | null;
		onhover?: (props: RouteProps | null) => void;
		onclick?: (props: RouteProps) => void;
	};

	let {
		id,
		data,
		color = '#be2a1f',
		highlight = null,
		dimOthers = false,
		filter = null,
		onhover,
		onclick
	}: Props = $props();

	const map = getMapContext()()!;
	const layer = (suffix: string) => `${id}-${suffix}`;
	onMount(() => {
		const lineColor = ['coalesce', ['get', 'color'], color] as unknown as string;
		map.addSource(id, { type: 'geojson', data });
		const layout = { 'line-cap': 'round', 'line-join': 'round' } as const;
		// White casing keeps routes readable on aerial imagery.
		map.addLayer({
			id: layer('casing'),
			type: 'line',
			source: id,
			layout,
			paint: { 'line-color': '#ffffff', 'line-width': 7, 'line-opacity': 0.9 }
		});
		map.addLayer({
			id: layer('line'),
			type: 'line',
			source: id,
			layout,
			paint: { 'line-color': lineColor, 'line-width': 4 }
		});
		map.addLayer({
			id: layer('highlight'),
			type: 'line',
			source: id,
			layout,
			filter: ['==', ['get', 'key'], ''],
			paint: { 'line-color': lineColor, 'line-width': 7 }
		});
		// Casing for the highlighted route, so it sits above faded neighbours.
		map.addLayer(
			{
				id: layer('highlight-casing'),
				type: 'line',
				source: id,
				layout,
				filter: ['==', ['get', 'key'], ''],
				paint: { 'line-color': '#ffffff', 'line-width': 11 }
			},
			layer('highlight')
		);
		// Wide invisible line: easier to hit with a finger or mouse.
		map.addLayer({
			id: layer('hit'),
			type: 'line',
			source: id,
			paint: { 'line-color': '#000000', 'line-width': 16, 'line-opacity': 0 }
		});

		const enter = (e: MapLayerMouseEvent) => {
			map.getCanvas().style.cursor = 'pointer';
			onhover?.(e.features?.[0]?.properties as RouteProps);
		};
		const leave = () => {
			map.getCanvas().style.cursor = '';
			onhover?.(null);
		};
		const click = (e: MapLayerMouseEvent) => {
			const props = e.features?.[0]?.properties as RouteProps | undefined;
			if (props) onclick?.(props);
		};
		map.on('mousemove', layer('hit'), enter);
		map.on('mouseleave', layer('hit'), leave);
		map.on('click', layer('hit'), click);

		return () => {
			map.off('mousemove', layer('hit'), enter);
			map.off('mouseleave', layer('hit'), leave);
			map.off('click', layer('hit'), click);
			// The map may already be gone when the whole page unmounts.
			if (!map.getStyle()) return;
			for (const suffix of ['hit', 'highlight', 'highlight-casing', 'line', 'casing']) {
				if (map.getLayer(layer(suffix))) map.removeLayer(layer(suffix));
			}
			if (map.getSource(id)) map.removeSource(id);
		};
	});

	$effect(() => {
		(map.getSource(id) as GeoJSONSource | undefined)?.setData(data);
	});

	$effect(() => {
		if (!map.getLayer(layer('highlight'))) return;
		const match: ExpressionSpecification = ['==', ['get', 'key'], highlight ?? ''];
		const combined: FilterSpecification = filter
			? (['all', filter, match] as FilterSpecification)
			: match;
		map.setFilter(layer('highlight'), combined);
		map.setFilter(layer('highlight-casing'), combined);
		for (const suffix of ['casing', 'line', 'hit']) map.setFilter(layer(suffix), filter);
		const faded = dimOthers && highlight ? 0.4 : 1;
		map.setPaintProperty(layer('line'), 'line-opacity', faded);
		map.setPaintProperty(layer('casing'), 'line-opacity', faded * 0.9);
	});
</script>
