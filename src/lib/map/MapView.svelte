<script lang="ts">
	import 'maplibre-gl/dist/maplibre-gl.css';
	import type { Map } from 'maplibre-gl';
	import { onMount, type Snippet } from 'svelte';
	// Let Vite bundle MapLibre's worker: its default lookup (next to the library file)
	// breaks once Vite pre-bundles the library into its dependency cache.
	import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
	import {
		ALPS_BOUNDS,
		BASEMAPS,
		OVERLAYS,
		buildStyle,
		layerId,
		type BasemapId,
		type OverlayId
	} from './basemaps.ts';
	import { setMapContext } from './context.ts';

	type Props = {
		basemap: BasemapId;
		overlays: OverlayId[];
		/** Initial view [minLng, minLat, maxLng, maxLat]; defaults to the Swiss Alps. */
		initialBounds?: [number, number, number, number] | null;
		/** Rendered once the map is ready; children use getMapContext(). */
		children?: Snippet;
	};

	let { basemap, overlays, initialBounds = null, children }: Props = $props();

	const LOCALE_DE = {
		'NavigationControl.ZoomIn': 'Hineinzoomen',
		'NavigationControl.ZoomOut': 'Herauszoomen',
		'NavigationControl.ResetBearing': 'Nach Norden ausrichten',
		'GeolocateControl.FindMyLocation': 'Meinen Standort anzeigen',
		'GeolocateControl.LocationNotAvailable': 'Standort nicht verfügbar',
		'FullscreenControl.Enter': 'Vollbild',
		'FullscreenControl.Exit': 'Vollbild beenden',
		'AttributionControl.ToggleAttribution': 'Quellenangaben ein-/ausblenden',
		'ScaleControl.Meters': 'm',
		'ScaleControl.Kilometers': 'km'
	};

	let container: HTMLDivElement;
	let map = $state<Map | null>(null);

	setMapContext(() => map);

	onMount(() => {
		let instance: Map | undefined;
		let destroyed = false;

		(async () => {
			// MapLibre needs the browser (WebGL, workers), so it's loaded on the client only.
			const maplibre = await import('maplibre-gl');
			if (destroyed) return;
			maplibre.setWorkerUrl(maplibreWorkerUrl);

			instance = new maplibre.Map({
				container,
				style: buildStyle(basemap, overlays),
				bounds: initialBounds
					? [
							[initialBounds[0], initialBounds[1]],
							[initialBounds[2], initialBounds[3]]
						]
					: ALPS_BOUNDS,
				fitBoundsOptions: { padding: 40, maxZoom: 15 },
				minZoom: 6,
				maxZoom: 19,
				maxPitch: 0,
				dragRotate: false,
				attributionControl: false,
				locale: LOCALE_DE
			});
			instance.touchZoomRotate.disableRotation();

			instance.addControl(new maplibre.NavigationControl({ showCompass: false }), 'top-right');
			instance.addControl(
				new maplibre.GeolocateControl({ positionOptions: { enableHighAccuracy: true } }),
				'top-right'
			);
			instance.addControl(new maplibre.FullscreenControl(), 'top-right');
			instance.addControl(new maplibre.ScaleControl({ unit: 'metric' }), 'bottom-left');
			instance.addControl(new maplibre.AttributionControl({ compact: true }), 'bottom-right');

			instance.on('load', () => {
				if (!destroyed) map = instance!;
			});
		})();

		return () => {
			destroyed = true;
			map = null;
			instance?.remove();
		};
	});

	// Switch base map and overlays by visibility, keeping all other layers in place.
	$effect(() => {
		if (!map) return;
		for (const b of BASEMAPS) {
			map.setLayoutProperty(layerId(b.id), 'visibility', b.id === basemap ? 'visible' : 'none');
		}
		for (const o of OVERLAYS) {
			map.setLayoutProperty(
				layerId(o.id),
				'visibility',
				overlays.includes(o.id) ? 'visible' : 'none'
			);
		}
	});
</script>

<!-- MapLibre forces `position: relative` on its container, so positioning lives on a wrapper. -->
<div class="absolute inset-0">
	<div bind:this={container} class="h-full w-full"></div>
</div>
{#if map}
	{@render children?.()}
{/if}
