<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import LayerSwitcher from '#lib/map/LayerSwitcher.svelte';
	import MapView from '#lib/map/MapView.svelte';
	import RouteLayer, { type RouteProps } from '#lib/map/RouteLayer.svelte';
	import { mapPreferences } from '#lib/map/preferences.svelte.ts';

	const prefs = mapPreferences();

	/** Hovered tour (all its days are highlighted). */
	let hovered = $state<RouteProps | null>(null);
</script>

<svelte:head>
	<title>Karte · Tschalps</title>
</svelte:head>

<div class="relative min-h-[60vh] flex-1">
	<MapView basemap={prefs.basemap} overlays={prefs.overlays}>
		<RouteLayer
			id="routes"
			data={resolve('/api/routes')}
			highlight={hovered?.key ?? null}
			onhover={(p) => (hovered = p)}
			onclick={(p) => goto(resolve('/(app)/tschalps/[slug]', { slug: String(p.slug) }))}
		/>
	</MapView>
	<LayerSwitcher bind:basemap={prefs.basemap} bind:overlays={prefs.overlays} />

	{#if hovered}
		<div
			class="pointer-events-none absolute bottom-8 left-1/2 z-10 -translate-x-1/2 rounded-lg bg-white px-3 py-2 text-sm shadow-lg ring-1 ring-black/10"
		>
			<span class="font-semibold">{hovered.title}</span>
			<span class="text-stone-500">· {hovered.year} · Tag {hovered.dayIndex}</span>
		</div>
	{/if}
</div>
