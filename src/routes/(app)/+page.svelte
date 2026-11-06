<script lang="ts">
	import { onMount } from 'svelte';
	import MapView from '#lib/map/MapView.svelte';
	import LayerSwitcher from '#lib/map/LayerSwitcher.svelte';
	import {
		DEFAULT_BASEMAP,
		OVERLAYS,
		isBasemapId,
		type BasemapId,
		type OverlayId
	} from '#lib/map/basemaps.ts';

	const STORAGE_KEY = 'tschalps.map';

	let basemap = $state<BasemapId>(DEFAULT_BASEMAP);
	let overlays = $state<OverlayId[]>([]);
	let restored = $state(false);

	// Remember the chosen base map per browser (a convenience only, so failures are ignored).
	onMount(() => {
		try {
			const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
			if (isBasemapId(saved.basemap)) basemap = saved.basemap;
			if (Array.isArray(saved.overlays)) {
				overlays = OVERLAYS.map((o) => o.id).filter((id) => saved.overlays.includes(id));
			}
		} catch {
			/* storage unavailable */
		}
		restored = true;
	});

	$effect(() => {
		const value = JSON.stringify({ basemap, overlays });
		if (!restored) return;
		try {
			localStorage.setItem(STORAGE_KEY, value);
		} catch {
			/* storage unavailable */
		}
	});
</script>

<svelte:head>
	<title>Karte · Tschalps</title>
</svelte:head>

<div class="relative min-h-[60vh] flex-1">
	<MapView {basemap} {overlays} />
	<LayerSwitcher bind:basemap bind:overlays />
</div>
