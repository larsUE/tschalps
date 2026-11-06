import { onMount } from 'svelte';
import {
	DEFAULT_BASEMAP,
	OVERLAYS,
	isBasemapId,
	type BasemapId,
	type OverlayId
} from './basemaps.ts';

const STORAGE_KEY = 'tschalps.map';

/**
 * Base map and overlays chosen by the viewer, remembered per browser.
 * Call during component initialisation; bind the fields to <LayerSwitcher>.
 */
export function mapPreferences() {
	const prefs = $state<{ basemap: BasemapId; overlays: OverlayId[] }>({
		basemap: DEFAULT_BASEMAP,
		overlays: []
	});
	let restored = false;

	onMount(() => {
		try {
			const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
			if (isBasemapId(saved.basemap)) prefs.basemap = saved.basemap;
			if (Array.isArray(saved.overlays)) {
				prefs.overlays = OVERLAYS.map((o) => o.id).filter((id) => saved.overlays.includes(id));
			}
		} catch {
			/* storage unavailable: a convenience only */
		}
		restored = true;
	});

	$effect(() => {
		const value = JSON.stringify(prefs);
		if (!restored) return;
		try {
			localStorage.setItem(STORAGE_KEY, value);
		} catch {
			/* storage unavailable */
		}
	});

	return prefs;
}
