<script lang="ts">
	import FitBounds from '#lib/map/FitBounds.svelte';
	import LayerSwitcher from '#lib/map/LayerSwitcher.svelte';
	import LocationMarker from '#lib/map/LocationMarker.svelte';
	import MapEvents from '#lib/map/MapEvents.svelte';
	import MapView from '#lib/map/MapView.svelte';
	import PlaceLayer from '#lib/map/PlaceLayer.svelte';
	import { mapPreferences } from '#lib/map/preferences.svelte.ts';
	import { formatLv95 } from '#lib/geo.ts';
	import {
		PLACE_STATUS_LABELS,
		PLACE_TYPE_COLORS,
		PLACE_TYPE_LABELS,
		type PlaceType
	} from '#lib/labels.ts';
	import { resolve } from '$app/paths';
	import { untrack } from 'svelte';

	type Values = {
		name?: string;
		type?: string;
		lat?: string | number | null;
		lng?: string | number | null;
		ele?: string | number | null;
		description?: string | null;
		access?: string | null;
		status?: string;
	};

	let { values, showStatus = false }: { values: Values; showStatus?: boolean } = $props();

	const prefs = mapPreferences();
	const initial = (() => {
		const lat = Number(values.lat);
		const lng = Number(values.lng);
		return values.lat && values.lng && Number.isFinite(lat) && Number.isFinite(lng)
			? { lat, lng }
			: null;
	})();

	let position = $state<{ lng: number; lat: number } | null>(initial);
	// Form state starts from the given values; later prop changes don't reset what the user picked.
	let type = $state<string>(untrack(() => values.type) ?? 'stall');
	let locating = $state(false);
	let locateError = $state('');

	const zoomTo = $state<{ bounds: [number, number, number, number] | null }>({
		bounds: initial ? [initial.lng, initial.lat, initial.lng, initial.lat] : null
	});

	function useMyLocation() {
		locateError = '';
		if (!navigator.geolocation) {
			locateError = 'Dein Browser kann den Standort nicht bestimmen.';
			return;
		}
		locating = true;
		navigator.geolocation.getCurrentPosition(
			(pos) => {
				locating = false;
				position = { lat: pos.coords.latitude, lng: pos.coords.longitude };
				zoomTo.bounds = [position.lng, position.lat, position.lng, position.lat];
			},
			() => {
				locating = false;
				locateError = 'Standort nicht verfügbar. Setze den Ort auf der Karte.';
			},
			{ enableHighAccuracy: true, timeout: 10000 }
		);
	}

	const typeEntries = Object.entries(PLACE_TYPE_LABELS) as [PlaceType, string][];
</script>

<div class="flex flex-col gap-5">
	<label>
		<span class="label">Name</span>
		<input
			name="name"
			required
			maxlength="120"
			value={values.name ?? ''}
			placeholder="z. B. Stall Alp Gren"
			class="field"
		/>
	</label>

	<fieldset>
		<legend class="label">Art</legend>
		<div class="flex flex-wrap gap-1.5">
			{#each typeEntries as [t, label] (t)}
				<label class="chip has-checked:border-ink has-checked:bg-ink has-checked:text-white">
					<input type="radio" name="type" value={t} bind:group={type} class="sr-only" />
					<span class="size-2.5 rounded-full" style:background-color={PLACE_TYPE_COLORS[t]}></span>
					{label}
				</label>
			{/each}
		</div>
	</fieldset>

	<fieldset class="flex flex-col gap-2">
		<legend class="label">Lage</legend>
		<p class="-mt-1 text-sm text-muted">Klicke auf die Karte oder verschiebe die Markierung.</p>
		<div class="relative h-80 overflow-hidden rounded-card border border-line bg-map">
			<MapView basemap={prefs.basemap} overlays={prefs.overlays} initialBounds={zoomTo.bounds}>
				<PlaceLayer id="other-places" data={resolve('/api/places')} small />
				<LocationMarker bind:position />
				<MapEvents onclick={(p) => (position = p)} crosshair />
				<FitBounds bounds={zoomTo.bounds} />
			</MapView>
			<LayerSwitcher bind:basemap={prefs.basemap} bind:overlays={prefs.overlays} />
		</div>
		<div class="flex flex-wrap items-center justify-between gap-2 text-sm">
			<span class="nums text-muted">
				{#if position}
					{position.lat.toFixed(5)}, {position.lng.toFixed(5)} · LV95 {formatLv95(
						position.lat,
						position.lng
					)}
				{:else}
					Noch kein Ort gesetzt.
				{/if}
			</span>
			<button
				type="button"
				class="btn btn-outline btn-sm"
				onclick={useMyLocation}
				disabled={locating}
			>
				{locating ? 'Standort wird gesucht …' : 'Meinen Standort verwenden'}
			</button>
		</div>
		{#if locateError}<p class="text-sm text-danger">{locateError}</p>{/if}
		<input type="hidden" name="lat" value={position?.lat.toFixed(6) ?? ''} />
		<input type="hidden" name="lng" value={position?.lng.toFixed(6) ?? ''} />
	</fieldset>

	<div class="grid gap-5 sm:grid-cols-2">
		<label>
			<span class="label">Höhe (m ü. M.)</span>
			<input
				name="ele"
				inputmode="numeric"
				value={values.ele ?? ''}
				placeholder="leer = automatisch"
				class="field nums"
			/>
		</label>
		{#if showStatus}
			<label>
				<span class="label">Status</span>
				<select name="status" value={values.status ?? 'aktiv'} class="field">
					{#each Object.entries(PLACE_STATUS_LABELS) as [value, label] (value)}
						<option {value}>{label}</option>
					{/each}
				</select>
			</label>
		{/if}
	</div>

	<label>
		<span class="label">Beschreibung</span>
		<textarea
			name="description"
			rows="5"
			placeholder="Wie ist der Stall? Platz für wie viele? Heu, Wasser, Besonderheiten …"
			class="field">{values.description ?? ''}</textarea
		>
	</label>

	<label>
		<span class="label">Zugang &amp; Erlaubnis</span>
		<textarea
			name="access"
			rows="3"
			placeholder="Wie kommt man hin? Muss man fragen? (Keine Namen oder Telefonnummern von Älplern.)"
			class="field">{values.access ?? ''}</textarea
		>
	</label>
</div>
