<script lang="ts">
	import type { Marker } from 'maplibre-gl';
	import { onMount } from 'svelte';
	import { getMapContext } from './context.ts';

	/** A draggable pin for choosing a position. */
	let {
		position = $bindable(),
		color = '#be2a1f'
	}: { position: { lng: number; lat: number } | null; color?: string } = $props();

	const map = getMapContext()()!;
	let marker: Marker | undefined;

	onMount(() => {
		let cancelled = false;
		import('maplibre-gl').then(({ Marker }) => {
			if (cancelled) return;
			marker = new Marker({ color, draggable: true });
			marker.on('dragend', () => {
				const { lng, lat } = marker!.getLngLat();
				position = { lng, lat };
			});
			if (position) marker.setLngLat([position.lng, position.lat]).addTo(map);
		});
		return () => {
			cancelled = true;
			marker?.remove();
		};
	});

	$effect(() => {
		if (!marker) return;
		if (position) marker.setLngLat([position.lng, position.lat]).addTo(map);
		else marker.remove();
	});
</script>
