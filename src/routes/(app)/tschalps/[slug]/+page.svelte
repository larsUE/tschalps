<script lang="ts">
	import { resolve } from '$app/paths';
	import type { Feature, FeatureCollection, Geometry } from 'geojson';
	import ElevationProfile from '#lib/components/ElevationProfile.svelte';
	import FitBounds from '#lib/map/FitBounds.svelte';
	import HoverPoint from '#lib/map/HoverPoint.svelte';
	import LayerSwitcher from '#lib/map/LayerSwitcher.svelte';
	import MapView from '#lib/map/MapView.svelte';
	import RouteLayer, { type RouteProps } from '#lib/map/RouteLayer.svelte';
	import { mapPreferences } from '#lib/map/preferences.svelte.ts';
	import { formatKm, formatM, profile, type ProfilePoint } from '#lib/geo.ts';
	import { SEASON_LABELS, dayColor, formatDate, formatShortDate } from '#lib/labels.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const prefs = mapPreferences();

	/** Selected day (stage id); null shows the whole tour. */
	let selected = $state<string | null>(null);
	let hoveredKey = $state<string | null>(null);
	let hoverPoint = $state<ProfilePoint | null>(null);

	type Bounds = [number, number, number, number];

	const features = $derived<FeatureCollection<Geometry, RouteProps>>({
		type: 'FeatureCollection',
		features: data.stages
			.filter((s) => s.geojson)
			.map((s): Feature<Geometry, RouteProps> => ({
				type: 'Feature',
				properties: { key: s.id, color: dayColor(s.dayIndex) },
				geometry: s.geojson!
			}))
	});

	const boundsOf = (stages: typeof data.stages): Bounds | null => {
		const withBox = stages.filter((s) => s.minLng !== null);
		if (!withBox.length) return null;
		return [
			Math.min(...withBox.map((s) => s.minLng!)),
			Math.min(...withBox.map((s) => s.minLat!)),
			Math.max(...withBox.map((s) => s.maxLng!)),
			Math.max(...withBox.map((s) => s.maxLat!))
		];
	};

	const selectedStage = $derived(data.stages.find((s) => s.id === selected) ?? null);
	const tourBounds = $derived(boundsOf(data.stages));
	const focusBounds = $derived(selectedStage ? boundsOf([selectedStage]) : tourBounds);

	const sum = (key: 'distanceM' | 'ascentM' | 'descentM') =>
		data.stages.reduce((total, s) => total + (s[key] ?? 0), 0);
	const totals = $derived({
		distanceM: sum('distanceM'),
		ascentM: sum('ascentM'),
		descentM: sum('descentM'),
		maxEle: Math.max(...data.stages.map((s) => s.maxEle ?? -Infinity))
	});

	const profilePoints = $derived(
		profile(
			(selectedStage ? [selectedStage] : data.stages).flatMap((s) => (s.geojson ? [s.geojson] : []))
		)
	);

	const toggle = (id: string) => (selected = selected === id ? null : id);

	const subtitle = $derived(
		[
			data.tour.season && SEASON_LABELS[data.tour.season],
			data.tour.startDate &&
				(data.tour.endDate && data.tour.endDate !== data.tour.startDate
					? `${formatDate(data.tour.startDate)} – ${formatDate(data.tour.endDate)}`
					: formatDate(data.tour.startDate))
		]
			.filter(Boolean)
			.join(' · ') || String(data.tour.year)
	);
</script>

<svelte:head>
	<title>{data.tour.title} · Tschalps</title>
</svelte:head>

<div class="flex flex-1 flex-col lg:min-h-0 lg:flex-row">
	<div class="relative h-[55vh] shrink-0 lg:h-auto lg:flex-1">
		<MapView basemap={prefs.basemap} overlays={prefs.overlays} initialBounds={tourBounds}>
			<RouteLayer
				id="stages"
				data={features}
				highlight={hoveredKey ?? selected}
				onhover={(p) => (hoveredKey = p?.key ?? null)}
				onclick={(p) => toggle(p.key)}
			/>
			<HoverPoint position={hoverPoint} />
			<FitBounds bounds={focusBounds} />
		</MapView>
		<LayerSwitcher bind:basemap={prefs.basemap} bind:overlays={prefs.overlays} />
	</div>

	<aside class="border-stone-200 bg-white lg:w-[26rem] lg:shrink-0 lg:overflow-y-auto lg:border-l">
		<div class="space-y-6 p-5">
			<div>
				<a href={resolve('/(app)/tschalps')} class="text-sm text-stone-500 hover:text-stone-800">
					← Alle Tschalps
				</a>
				<div class="mt-2 flex items-start justify-between gap-3">
					<h1 class="text-xl leading-tight font-bold">{data.tour.title}</h1>
					{#if data.canEdit}
						<a
							href={resolve('/(app)/tschalps/[slug]/bearbeiten', { slug: data.tour.slug })}
							class="shrink-0 rounded-md px-2 py-1 text-sm text-stone-600 ring-1 ring-stone-300 hover:bg-stone-50"
						>
							Bearbeiten
						</a>
					{/if}
				</div>
				<p class="mt-1 text-sm text-stone-600">{subtitle}</p>
			</div>

			<dl class="grid grid-cols-4 gap-2 text-center">
				{#each [['Tage', String(data.stages.length)], ['Distanz', formatKm(totals.distanceM)], ['Aufstieg', formatM(totals.ascentM)], ['Höchster Punkt', Number.isFinite(totals.maxEle) ? formatM(totals.maxEle) : '–']] as [label, value] (label)}
					<div class="rounded-lg bg-stone-50 px-1 py-2">
						<dt class="text-[11px] leading-tight text-stone-500">{label}</dt>
						<dd class="mt-0.5 text-sm font-semibold">{value}</dd>
					</div>
				{/each}
			</dl>

			<section>
				<div class="mb-1 flex items-baseline justify-between">
					<h2 class="text-sm font-semibold">
						Höhenprofil{selectedStage ? `: Tag ${selectedStage.dayIndex}` : ''}
					</h2>
					{#if selectedStage}
						<button onclick={() => (selected = null)} class="text-xs text-stone-500 underline">
							Ganze Tour
						</button>
					{/if}
				</div>
				<ElevationProfile
					points={profilePoints}
					color={selectedStage ? dayColor(selectedStage.dayIndex) : '#047857'}
					onhover={(p) => (hoverPoint = p)}
				/>
			</section>

			<section>
				<div class="mb-2 flex items-baseline justify-between">
					<h2 class="text-sm font-semibold">Etappen</h2>
					{#if data.stages.length}
						<a
							href={resolve('/api/gpx/tour/[slug]', { slug: data.tour.slug })}
							download
							class="text-sm text-emerald-800 underline hover:text-emerald-950"
						>
							Ganze Tour als GPX
						</a>
					{/if}
				</div>
				<ol class="divide-y divide-stone-100 rounded-lg ring-1 ring-stone-200">
					{#each data.stages as s (s.id)}
						<li
							class="flex items-center gap-3 px-3 py-2.5 {selected === s.id ? 'bg-stone-50' : ''}"
							onmouseenter={() => (hoveredKey = s.id)}
							onmouseleave={() => (hoveredKey = null)}
						>
							<span
								class="size-3 shrink-0 rounded-full"
								style:background-color={dayColor(s.dayIndex)}
							></span>
							<button onclick={() => toggle(s.id)} class="min-w-0 flex-1 text-left">
								<span class="block text-sm font-medium">
									Tag {s.dayIndex}{s.date ? ` · ${formatShortDate(s.date)}` : ''}
								</span>
								{#if s.title}<span class="block truncate text-xs text-stone-500">{s.title}</span
									>{/if}
								<span class="block text-xs text-stone-600">
									{formatKm(s.distanceM)} · ↑ {formatM(s.ascentM)} · ↓ {formatM(s.descentM)}
								</span>
							</button>
							<a
								href={resolve('/api/gpx/stage/[id]', { id: s.id })}
								download
								class="shrink-0 rounded px-1.5 py-0.5 text-xs text-stone-600 ring-1 ring-stone-300 hover:bg-white"
								aria-label="GPX von Tag {s.dayIndex} herunterladen"
							>
								GPX
							</a>
						</li>
					{:else}
						<li class="px-3 py-4 text-sm text-stone-500">Noch keine Etappen.</li>
					{/each}
				</ol>
			</section>

			{#if data.tour.summaryMd}
				<section>
					<h2 class="mb-1 text-sm font-semibold">Bericht</h2>
					<p class="text-sm whitespace-pre-line text-stone-700">{data.tour.summaryMd}</p>
				</section>
			{/if}

			{#if data.participants.length || data.creator}
				<section class="text-sm text-stone-600">
					{#if data.participants.length}
						<p>
							<span class="font-semibold text-stone-800">Dabei:</span>
							{data.participants.join(', ')}
						</p>
					{/if}
					{#if data.creator}<p class="mt-1 text-xs text-stone-500">
							Erfasst von {data.creator}
						</p>{/if}
				</section>
			{/if}
		</div>
	</aside>
</div>
