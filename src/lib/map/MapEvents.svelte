<script lang="ts">
	import type { MapMouseEvent } from 'maplibre-gl';
	import { onMount } from 'svelte';
	import { getMapContext } from './context.ts';

	type Bounds = [number, number, number, number];

	type Props = {
		/** Clicks on the map background (not on a place or route). */
		onclick?: (position: { lng: number; lat: number }) => void;
		/** Visible area after each move: [minLng, minLat, maxLng, maxLat]. */
		onmove?: (bounds: Bounds) => void;
		/** Crosshair cursor, e.g. while choosing where to add a place. */
		crosshair?: boolean;
	};

	let { onclick, onmove, crosshair = false }: Props = $props();

	const map = getMapContext()()!;

	onMount(() => {
		const click = (e: MapMouseEvent) => {
			// Let clicks on interactive layers (places, routes) go to those layers only.
			const hits = map
				.queryRenderedFeatures(e.point)
				.filter((f) => f.layer.id.endsWith('-dot') || f.layer.id.endsWith('-hit'));
			if (!hits.length) onclick?.(e.lngLat);
		};
		const move = () => {
			const b = map.getBounds();
			onmove?.([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]);
		};
		map.on('click', click);
		map.on('moveend', move);
		move();
		return () => {
			map.off('click', click);
			map.off('moveend', move);
		};
	});

	$effect(() => {
		map.getCanvasContainer().style.cursor = crosshair ? 'crosshair' : '';
	});
</script>
