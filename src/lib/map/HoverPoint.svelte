<script lang="ts">
	import type { GeoJSONSource } from 'maplibre-gl';
	import { onMount } from 'svelte';
	import { getMapContext } from './context.ts';

	/** Marks a position on the map, e.g. the point hovered in the elevation profile. */
	let { position }: { position: { lng: number; lat: number } | null } = $props();

	const map = getMapContext()()!;
	const id = 'hover-point';

	const toData = (p: typeof position) => ({
		type: 'FeatureCollection' as const,
		features: p
			? [
					{
						type: 'Feature' as const,
						properties: {},
						geometry: { type: 'Point' as const, coordinates: [p.lng, p.lat] }
					}
				]
			: []
	});

	onMount(() => {
		map.addSource(id, { type: 'geojson', data: toData(null) });
		map.addLayer({
			id,
			type: 'circle',
			source: id,
			paint: {
				'circle-radius': 7,
				'circle-color': '#1c1917',
				'circle-stroke-color': '#ffffff',
				'circle-stroke-width': 3
			}
		});
		return () => {
			if (!map.getStyle()) return;
			if (map.getLayer(id)) map.removeLayer(id);
			if (map.getSource(id)) map.removeSource(id);
		};
	});

	$effect(() => {
		(map.getSource(id) as GeoJSONSource | undefined)?.setData(toData(position));
	});
</script>
