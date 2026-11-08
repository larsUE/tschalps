<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { FeatureCollection, Point } from 'geojson';
	import FitBounds from '#lib/map/FitBounds.svelte';
	import LayerSwitcher from '#lib/map/LayerSwitcher.svelte';
	import MapEvents from '#lib/map/MapEvents.svelte';
	import MapView from '#lib/map/MapView.svelte';
	import PlaceLayer, { type PlaceProps } from '#lib/map/PlaceLayer.svelte';
	import { mapPreferences } from '#lib/map/preferences.svelte.ts';
	import { formatM } from '#lib/geo.ts';
	import {
		PLACE_STATUS_LABELS,
		PLACE_TYPE_COLORS,
		PLACE_TYPE_LABELS,
		type PlaceType
	} from '#lib/labels.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const prefs = mapPreferences();

	let query = $state('');
	let types = $state<PlaceType[]>([]);
	let hovered = $state<string | null>(null);
	let selected = $state<string | null>(null);
	let hoverInfo = $state<PlaceProps | null>(null);
	/** While true, the next click on the map chooses the position of a new place. */
	let adding = $state(false);
	let view = $state<[number, number, number, number] | null>(null);

	const typeEntries = Object.entries(PLACE_TYPE_LABELS) as [PlaceType, string][];

	const visible = $derived(
		data.places.filter(
			(p) =>
				(!types.length || types.includes(p.type)) &&
				(!query.trim() || p.name.toLowerCase().includes(query.trim().toLowerCase()))
		)
	);

	const features = $derived<FeatureCollection<Point, PlaceProps>>({
		type: 'FeatureCollection',
		features: visible.map((p) => ({
			type: 'Feature',
			properties: {
				key: p.id,
				name: p.name,
				type: p.type,
				status: p.status,
				color: PLACE_TYPE_COLORS[p.type]
			},
			geometry: { type: 'Point', coordinates: [p.lng, p.lat] }
		}))
	});

	const current = $derived(data.places.find((p) => p.id === selected) ?? null);
	const focus = $derived<[number, number, number, number] | null>(
		current ? [current.lng, current.lat, current.lng, current.lat] : null
	);

	const toggleType = (t: PlaceType) =>
		(types = types.includes(t) ? types.filter((x) => x !== t) : [...types, t]);

	const gpxHref = $derived.by(() => {
		const query: Record<string, string> = {};
		if (types.length) query.typ = types.join(',');
		if (view) query.bbox = view.map((v) => v.toFixed(5)).join(',');
		return resolve(`/api/gpx/orte?${new URLSearchParams(query)}`);
	});

	function addAt(position: { lng: number; lat: number }) {
		if (!adding) {
			selected = null;
			return;
		}
		adding = false;
		const params = new URLSearchParams({
			lat: position.lat.toFixed(6),
			lng: position.lng.toFixed(6)
		});
		goto(resolve(`/(app)/orte/neu?${params}`));
	}

	const meta = (p: (typeof data.places)[number]) =>
		[
			PLACE_TYPE_LABELS[p.type],
			p.status !== 'aktiv' && PLACE_STATUS_LABELS[p.status],
			p.nights && `${p.nights}× übernachtet`
		]
			.filter(Boolean)
			.join(' · ');
</script>

<svelte:head>
	<title>Orte · Tschalps</title>
</svelte:head>

<div class="flex flex-1 flex-col-reverse lg:min-h-0 lg:flex-row">
	<aside
		class="flex flex-col gap-6 border-line bg-paper p-4 sm:p-6 lg:w-[380px] lg:shrink-0 lg:overflow-y-auto lg:border-r"
	>
		<div class="flex flex-col gap-1">
			<span class="eyebrow text-trail-dark">Orte</span>
			<h1 class="text-[44px] font-display">Ställe &amp; Scheunen</h1>
			<p class="text-sm text-ink-soft">
				Übernachtungsorte und Wasserstellen, gesammelt von allen Mitgliedern.
			</p>
		</div>

		<div class="flex flex-wrap gap-2">
			<button
				type="button"
				class="btn btn-primary btn-sm"
				aria-pressed={adding}
				onclick={() => (adding = !adding)}
			>
				{adding ? 'Abbrechen' : 'Ort erfassen'}
			</button>
			<a href={gpxHref} download class="btn btn-outline btn-sm">
				<svg
					class="size-4"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					aria-hidden="true"><path d="M12 4 V15 M7 10 L12 15 L17 10 M5 20 H19" /></svg
				>
				Sichtbare als GPX
			</a>
		</div>

		<label
			class="flex h-11 items-center gap-2.5 rounded-ui border border-line-strong bg-surface px-3.5"
		>
			<svg
				class="size-[18px] shrink-0 text-muted"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20 L16 16" /></svg
			>
			<span class="sr-only">Orte suchen</span>
			<input
				type="search"
				bind:value={query}
				placeholder="Name"
				class="min-w-0 flex-1 border-0 bg-transparent p-0 focus:ring-0"
			/>
		</label>

		<section class="flex flex-col gap-2.5">
			<h2 class="eyebrow">Art</h2>
			<div class="flex flex-wrap gap-1.5">
				{#each typeEntries as [t, label] (t)}
					<button
						type="button"
						class="chip"
						aria-pressed={types.includes(t)}
						onclick={() => toggleType(t)}
					>
						<span class="size-2.5 rounded-full" style:background-color={PLACE_TYPE_COLORS[t]}
						></span>
						{label}
					</button>
				{/each}
			</div>
		</section>

		<section class="flex flex-col gap-2">
			<div class="flex items-baseline justify-between">
				<h2 class="eyebrow">Orte</h2>
				<span class="nums text-xs text-muted">{visible.length} von {data.places.length}</span>
			</div>
			<ul class="flex flex-col gap-0.5">
				{#each visible as p (p.id)}
					<li>
						<a
							href={resolve('/(app)/orte/[id]', { id: p.id })}
							onmouseenter={() => (hovered = p.id)}
							onmouseleave={() => (hovered = null)}
							onfocus={() => (hovered = p.id)}
							onblur={() => (hovered = null)}
							class="grid grid-cols-[12px_1fr_auto] items-baseline gap-x-3 gap-y-0.5 rounded-ui p-3 hover:bg-surface {selected ===
							p.id
								? 'bg-surface ring-[1.5px] ring-ink'
								: ''}"
						>
							<span
								class="size-2.5 self-center rounded-full"
								style:background-color={PLACE_TYPE_COLORS[p.type]}
							></span>
							<span
								class="font-semibold {p.status === 'existiert_nicht_mehr' ? 'line-through' : ''}"
								>{p.name}</span
							>
							<span class="nums text-[13px]">{p.ele ? formatM(p.ele) : ''}</span>
							<span></span>
							<span class="text-[13px] text-muted">{meta(p)}</span>
							<span class="nums text-[13px] text-muted"
								>{p.comments
									? `${p.comments} ${p.comments === 1 ? 'Beitrag' : 'Beiträge'}`
									: ''}</span
							>
						</a>
					</li>
				{:else}
					<li class="rounded-ui border border-dashed border-line-strong p-4 text-sm text-muted">
						{data.places.length
							? 'Keine Orte gefunden.'
							: 'Noch keine Orte erfasst. Mit «Ort erfassen» den ersten Stall auf der Karte setzen.'}
					</li>
				{/each}
			</ul>
		</section>

		{#if data.removed.length}
			<section class="flex flex-col gap-2">
				<h2 class="eyebrow">Entfernt (nur für Admins sichtbar)</h2>
				<ul class="flex flex-col gap-1 text-sm">
					{#each data.removed as r (r.id)}
						<li>
							<a
								href={resolve('/(app)/orte/[id]', { id: r.id })}
								class="text-muted underline hover:text-ink">{r.name}</a
							>
						</li>
					{/each}
				</ul>
			</section>
		{/if}
	</aside>

	<section
		aria-label="Karte der Orte"
		class="relative h-[60vh] shrink-0 bg-map lg:h-auto lg:flex-1"
	>
		<MapView basemap={prefs.basemap} overlays={prefs.overlays}>
			<PlaceLayer
				data={features}
				highlight={hovered ?? selected}
				onhover={(p) => (hoverInfo = p)}
				onclick={(p) => {
					if (!adding) selected = p.key;
				}}
			/>
			<MapEvents onclick={addAt} onmove={(b) => (view = b)} crosshair={adding} />
			<FitBounds bounds={focus} />
		</MapView>
		<LayerSwitcher bind:basemap={prefs.basemap} bind:overlays={prefs.overlays} />

		{#if adding}
			<p
				class="absolute top-16 left-1/2 z-10 -translate-x-1/2 rounded-ui bg-ink px-4 py-2 text-sm whitespace-nowrap text-white shadow-float"
			>
				Klicke auf die Karte, wo der Ort liegt.
			</p>
		{:else if hoverInfo && hoverInfo.key !== selected}
			<div
				class="pointer-events-none absolute top-16 left-1/2 z-10 -translate-x-1/2 rounded-ui bg-ink px-3 py-1.5 text-sm whitespace-nowrap text-white shadow-float"
			>
				<span class="font-semibold">{hoverInfo.name}</span>
				<span class="text-header-muted"
					>· {PLACE_TYPE_LABELS[hoverInfo.type as PlaceType] ?? hoverInfo.type}</span
				>
			</div>
		{/if}

		{#if current && !adding}
			<article
				class="absolute inset-x-3 bottom-10 z-10 overflow-hidden rounded-card bg-surface shadow-pop sm:right-4 sm:left-auto sm:w-[320px]"
			>
				<div class="flex flex-col gap-1 p-4 pb-3">
					<div class="flex items-center justify-between">
						<span class="eyebrow" style:color={PLACE_TYPE_COLORS[current.type]}>
							{PLACE_TYPE_LABELS[current.type]}{current.ele ? ` · ${formatM(current.ele)}` : ''}
						</span>
						<button
							type="button"
							aria-label="Schliessen"
							onclick={() => (selected = null)}
							class="-mt-1.5 -mr-1.5 grid size-9 cursor-pointer place-items-center rounded-ui hover:bg-paper"
						>
							<svg
								class="size-4 text-muted"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								aria-hidden="true"><path d="M6 6 L18 18 M18 6 L6 18" /></svg
							>
						</button>
					</div>
					<h3 class="text-[26px] font-display leading-[1.05]">{current.name}</h3>
					<p class="text-sm text-muted">{meta(current)}</p>
				</div>
				<div class="p-4 pt-1">
					<a href={resolve('/(app)/orte/[id]', { id: current.id })} class="btn btn-dark w-full">
						Ort öffnen
					</a>
				</div>
			</article>
		{/if}
	</section>
</div>
