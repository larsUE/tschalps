<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { FilterSpecification } from 'maplibre-gl';
	import FitBounds from '#lib/map/FitBounds.svelte';
	import LayerSwitcher from '#lib/map/LayerSwitcher.svelte';
	import MapView from '#lib/map/MapView.svelte';
	import PlaceLayer from '#lib/map/PlaceLayer.svelte';
	import RouteLayer, { type RouteProps } from '#lib/map/RouteLayer.svelte';
	import { mapPreferences } from '#lib/map/preferences.svelte.ts';
	import { formatKm, formatM } from '#lib/geo.ts';
	import { SEASON_LABELS, formatDateRange, yearColors } from '#lib/labels.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const prefs = mapPreferences();
	const QUICK_YEARS = 5;

	let query = $state('');
	let year = $state<number | null>(null);
	/** Tour under the pointer, on the map or in the list. */
	let hovered = $state<string | null>(null);
	/** Tour shown in the card on the map. */
	let selected = $state<string | null>(null);
	/** Last map hover, for the tooltip. */
	let hoverInfo = $state<RouteProps | null>(null);

	const colors = $derived(yearColors(data.tours.map((t) => t.year)));
	const years = $derived([...colors.keys()]);
	const olderYears = $derived(years.slice(QUICK_YEARS));

	const visible = $derived(
		data.tours.filter(
			(t) =>
				(year === null || t.year === year) &&
				(!query.trim() || `${t.title} ${t.year}`.toLowerCase().includes(query.trim().toLowerCase()))
		)
	);
	const filter = $derived<FilterSpecification | null>(
		visible.length === data.tours.length
			? null
			: ['in', ['get', 'slug'], ['literal', visible.map((t) => t.slug)]]
	);
	const current = $derived(data.tours.find((t) => t.slug === selected) ?? null);

	const meta = (t: (typeof data.tours)[number]) =>
		[
			formatDateRange(t.startDate, t.endDate) || (t.season && SEASON_LABELS[t.season]),
			`${t.days} ${t.days === 1 ? 'Etappe' : 'Etappen'}`
		]
			.filter(Boolean)
			.join(' · ');
</script>

<svelte:head>
	<title>Karte · Tschalps</title>
</svelte:head>

<div class="flex flex-1 flex-col-reverse lg:min-h-0 lg:flex-row">
	<aside
		class="flex flex-col gap-6 border-line bg-paper p-4 sm:p-6 lg:w-[380px] lg:shrink-0 lg:overflow-y-auto lg:border-r"
	>
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
			<span class="sr-only">Tschalps suchen</span>
			<input
				type="search"
				bind:value={query}
				placeholder="Tour oder Jahr"
				class="min-w-0 flex-1 border-0 bg-transparent p-0 focus:ring-0"
			/>
		</label>

		{#if years.length > 1}
			<section class="flex flex-col gap-2.5">
				<h2 class="eyebrow">Jahre</h2>
				<div class="flex flex-wrap gap-1.5">
					<button
						type="button"
						class="chip"
						aria-pressed={year === null}
						onclick={() => (year = null)}
					>
						Alle
					</button>
					{#each years.slice(0, QUICK_YEARS) as y (y)}
						<button
							type="button"
							class="chip"
							aria-pressed={year === y}
							onclick={() => (year = year === y ? null : y)}
						>
							<span class="h-[3px] w-2.5" style:background-color={colors.get(y)}></span>
							{y}
						</button>
					{/each}
					{#if olderYears.length}
						<label class="sr-only" for="older-years">Älteres Jahr wählen</label>
						<select
							id="older-years"
							class="chip border-dashed py-0 pr-8 text-muted"
							value={year !== null && olderYears.includes(year) ? String(year) : ''}
							onchange={(e) =>
								(year = e.currentTarget.value ? Number(e.currentTarget.value) : null)}
						>
							<option value="">Ältere …</option>
							{#each olderYears as y (y)}<option value={String(y)}>{y}</option>{/each}
						</select>
					{/if}
				</div>
			</section>
		{/if}

		<section class="flex flex-col gap-2">
			<div class="flex items-baseline justify-between">
				<h2 class="eyebrow">Tschalps</h2>
				<span class="nums text-xs text-muted">{visible.length} von {data.tours.length}</span>
			</div>
			<ul class="flex flex-col gap-0.5">
				{#each visible as t (t.slug)}
					<li>
						<a
							href={resolve('/(app)/tschalps/[slug]', { slug: t.slug })}
							onmouseenter={() => (hovered = t.slug)}
							onmouseleave={() => (hovered = null)}
							onfocus={() => (hovered = t.slug)}
							onblur={() => (hovered = null)}
							class="grid grid-cols-[14px_1fr_auto] items-baseline gap-x-3 gap-y-1 rounded-ui p-3 hover:bg-surface {selected ===
							t.slug
								? 'bg-surface ring-[1.5px] ring-ink'
								: ''}"
						>
							<span class="h-1 w-3.5 self-center" style:background-color={colors.get(t.year)}
							></span>
							<span class="font-semibold">{t.title}</span>
							<span class="nums text-[13px]">{formatKm(t.distanceM)}</span>
							<span></span>
							<span class="text-[13px] text-muted">{meta(t)}</span>
							<span class="nums text-[13px] text-muted">↑{formatM(t.ascentM)}</span>
						</a>
					</li>
				{:else}
					<li class="rounded-ui border border-dashed border-line-strong p-4 text-sm text-muted">
						{data.tours.length ? 'Keine Tschalps gefunden.' : 'Noch keine Tschalps erfasst.'}
					</li>
				{/each}
			</ul>
			<a href={resolve('/(app)/tschalps/neu')} class="btn btn-outline btn-sm mt-2 self-start">
				Neue Tschalps erfassen
			</a>
		</section>
	</aside>

	<section aria-label="Karte" class="relative h-[60vh] shrink-0 bg-map lg:h-auto lg:flex-1">
		<MapView basemap={prefs.basemap} overlays={prefs.overlays}>
			<RouteLayer
				id="routes"
				data={resolve('/api/routes')}
				{filter}
				highlight={hovered ?? selected}
				dimOthers
				onhover={(p) => {
					hoverInfo = p;
					hovered = p ? String(p.slug) : null;
				}}
				onclick={(p) => (selected = String(p.slug))}
			/>
			<PlaceLayer
				data={resolve('/api/places')}
				small
				onclick={(p) => goto(resolve('/(app)/orte/[id]', { id: p.key }))}
			/>
			<FitBounds bounds={current?.bbox ?? null} />
		</MapView>
		<LayerSwitcher bind:basemap={prefs.basemap} bind:overlays={prefs.overlays} />

		{#if hoverInfo && hoverInfo.slug !== selected}
			<div
				class="pointer-events-none absolute top-16 left-1/2 z-10 -translate-x-1/2 rounded-ui bg-ink px-3 py-1.5 text-sm whitespace-nowrap text-white shadow-float"
			>
				<span class="font-semibold">{hoverInfo.title}</span>
				<span class="text-header-muted">· {hoverInfo.year} · Tag {hoverInfo.dayIndex}</span>
			</div>
		{/if}

		{#if current}
			<article
				class="absolute inset-x-3 bottom-10 z-10 overflow-hidden rounded-card bg-surface shadow-pop sm:right-4 sm:left-auto sm:w-[340px]"
			>
				<div class="flex flex-col gap-1 p-4 pb-3">
					<div class="flex items-center justify-between">
						<span class="eyebrow text-trail-dark">
							{[current.season && SEASON_LABELS[current.season], current.year]
								.filter(Boolean)
								.join(' ')}
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
					<h3 class="text-[26px] font-display leading-[1.05]">{current.title}</h3>
					<p class="text-sm text-muted">{meta(current)}</p>
				</div>
				<dl class="grid grid-cols-3 border-t border-line">
					{#each [['Distanz', formatKm(current.distanceM)], ['Aufstieg', formatM(current.ascentM)], ['Max.', formatM(current.maxEle)]] as [label, value], i (label)}
						<div class="px-4 py-2.5 {i ? 'border-l border-line' : ''}">
							<dt class="text-xs text-muted">{label}</dt>
							<dd class="nums font-medium">{value}</dd>
						</div>
					{/each}
				</dl>
				<div class="flex gap-2 p-4 pt-3">
					<a
						href={resolve('/(app)/tschalps/[slug]', { slug: current.slug })}
						class="btn btn-dark flex-1"
					>
						Tour öffnen
						<svg
							class="size-4"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							aria-hidden="true"><path d="M5 12 H19 M13 6 L19 12 L13 18" /></svg
						>
					</a>
					<a
						href={resolve('/api/gpx/tour/[slug]', { slug: current.slug })}
						download
						aria-label="Ganze Tour als GPX herunterladen"
						class="btn btn-outline btn-icon"
					>
						<svg
							class="size-[18px]"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							aria-hidden="true"><path d="M12 4 V15 M7 10 L12 15 L17 10 M5 20 H19" /></svg
						>
					</a>
				</div>
			</article>
		{/if}
	</section>
</div>
