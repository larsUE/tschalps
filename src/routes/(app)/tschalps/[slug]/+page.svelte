<script lang="ts">
	import { resolve } from '$app/paths';
	import type { Feature, FeatureCollection, Geometry } from 'geojson';
	import ElevationProfile from '#lib/components/ElevationProfile.svelte';
	import FitBounds from '#lib/map/FitBounds.svelte';
	import HoverPoint from '#lib/map/HoverPoint.svelte';
	import LayerSwitcher from '#lib/map/LayerSwitcher.svelte';
	import MapView from '#lib/map/MapView.svelte';
	import RouteLayer, { type RouteProps } from '#lib/map/RouteLayer.svelte';
	import StageMarkers, { type StagePoint } from '#lib/map/StageMarkers.svelte';
	import { mapPreferences } from '#lib/map/preferences.svelte.ts';
	import { formatKm, formatM, profile, type ProfilePoint } from '#lib/geo.ts';
	import { SEASON_LABELS, TRAIL_COLOR, formatDateRange, formatShortDate } from '#lib/labels.ts';
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
				properties: { key: s.id, color: TRAIL_COLOR },
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

	const withGeometry = $derived(data.stages.filter((s) => s.geojson));
	const profilePoints = $derived(
		profile(
			(selectedStage ? [selectedStage] : withGeometry).flatMap((s) =>
				s.geojson ? [s.geojson] : []
			)
		)
	);
	/** Where each day after the first starts along the whole-tour profile. */
	const dayStarts = $derived.by(() => {
		if (selectedStage) return [];
		const starts: number[] = [];
		let d = 0;
		for (const s of withGeometry.slice(0, -1)) {
			d += profile([s.geojson!]).at(-1)?.d ?? 0;
			starts.push(d);
		}
		return starts;
	});

	/** Start, nights (end of each day but the last) and finish. */
	const markers = $derived.by((): StagePoint[] => {
		const lines = withGeometry.map((s) => s.geojson!.coordinates.flat());
		if (!lines.length || !lines[0].length) return [];
		const at = (p: number[]) => ({ lng: p[0], lat: p[1] });
		const lastLine = lines.at(-1)!;
		return [
			{ ...at(lines[0][0]), kind: 'start' },
			...lines
				.slice(0, -1)
				.map((l, i): StagePoint => ({ ...at(l.at(-1)!), kind: 'night', label: String(i + 1) })),
			{ ...at(lastLine.at(-1)!), kind: 'end' }
		];
	});

	const toggle = (id: string) => (selected = selected === id ? null : id);

	const eyebrow = $derived(
		[
			[data.tour.season && SEASON_LABELS[data.tour.season], data.tour.year]
				.filter(Boolean)
				.join(' '),
			formatDateRange(data.tour.startDate, data.tour.endDate)
		]
			.filter(Boolean)
			.join(' · ')
	);

	const pad = (n: number) => String(n).padStart(2, '0');
	const longest = $derived(
		data.stages.length > 2
			? data.stages.reduce((a, b) => ((b.distanceM ?? 0) > (a.distanceM ?? 0) ? b : a)).id
			: null
	);
</script>

<svelte:head>
	<title>{data.tour.title} · Tschalps</title>
</svelte:head>

<div class="mx-auto flex w-full max-w-7xl flex-col gap-12 px-4 pt-8 pb-20 sm:px-6">
	<section class="flex flex-col gap-5">
		<nav aria-label="Brotkrumen" class="nums text-[13px] text-muted">
			<a href={resolve('/(app)/tschalps')} class="hover:text-ink">Tschalps</a>
			/ {data.tour.year} /
			<span class="text-ink">{data.tour.title}</span>
		</nav>
		<div class="flex flex-wrap items-end justify-between gap-6">
			<div class="flex min-w-0 flex-col gap-2">
				<span class="eyebrow text-trail-dark">{eyebrow}</span>
				<h1 class="text-[56px] font-display break-words sm:text-[88px] lg:text-[112px]">
					{data.tour.title}
				</h1>
			</div>
			<div class="flex flex-wrap gap-2">
				{#if data.canEdit}
					<a
						href={resolve('/(app)/tschalps/[slug]/bearbeiten', { slug: data.tour.slug })}
						class="btn btn-outline"
					>
						<svg
							class="size-4"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							aria-hidden="true"><path d="M4 20 H8 L19 9 L15 5 L4 16 Z" /></svg
						>
						Bearbeiten
					</a>
				{/if}
				{#if data.stages.length}
					<a
						href={resolve('/api/gpx/tour/[slug]', { slug: data.tour.slug })}
						download
						class="btn btn-primary"
					>
						<svg
							class="size-4"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							aria-hidden="true"><path d="M12 4 V15 M7 10 L12 15 L17 10 M5 20 H19" /></svg
						>
						Ganze Tour als GPX
					</a>
				{/if}
			</div>
		</div>
		{#if data.participants.length || data.creator}
			<p class="text-[15px] text-ink-soft">
				{#if data.participants.length}
					<span class="font-semibold text-ink">Dabei:</span> {data.participants.join(', ')}
				{/if}
				{#if data.creator}
					<span class="block text-sm text-muted">Erfasst von {data.creator}</span>
				{/if}
			</p>
		{/if}
	</section>

	<dl
		class="grid grid-cols-2 border-t-2 border-b border-t-ink border-b-line sm:grid-cols-3 lg:grid-cols-5"
	>
		{#each [['Distanz', formatKm(totals.distanceM)], ['Aufstieg', formatM(totals.ascentM)], ['Abstieg', formatM(totals.descentM)], ['Höchster Punkt (ü. M.)', Number.isFinite(totals.maxEle) ? formatM(totals.maxEle) : '–'], ['Etappen', String(data.stages.length)]] as [label, value] (label)}
			<div class="py-4 pr-4">
				<dt class="text-[13px] text-muted">{label}</dt>
				<dd class="nums text-2xl leading-tight font-medium sm:text-[30px]">{value}</dd>
			</div>
		{/each}
	</dl>

	<section aria-label="Karte und Etappen" class="flex flex-col gap-6 lg:flex-row">
		<div
			class="relative h-[60vh] min-h-80 overflow-hidden rounded-card border border-line bg-map lg:h-[600px] lg:flex-[3]"
		>
			<MapView basemap={prefs.basemap} overlays={prefs.overlays} initialBounds={tourBounds}>
				<RouteLayer
					id="stages"
					data={features}
					highlight={hoveredKey ?? selected}
					dimOthers
					onhover={(p) => (hoveredKey = p?.key ?? null)}
					onclick={(p) => toggle(p.key)}
				/>
				<StageMarkers points={markers} />
				<HoverPoint position={hoverPoint} />
				<FitBounds bounds={focusBounds} />
			</MapView>
			<LayerSwitcher bind:basemap={prefs.basemap} bind:overlays={prefs.overlays} />
		</div>

		<div class="flex flex-col gap-3 lg:flex-[2]">
			<div class="flex items-baseline justify-between">
				<h2 class="text-[32px] font-display leading-none">Etappen</h2>
				{#if selectedStage}
					<button
						type="button"
						onclick={() => (selected = null)}
						class="cursor-pointer text-sm underline hover:text-trail"
					>
						Ganze Tour zeigen
					</button>
				{/if}
			</div>
			<ol class="flex flex-col border-t border-line">
				{#each data.stages as s (s.id)}
					{@const active = selected === s.id}
					<li
						class="grid grid-cols-[44px_1fr_44px] items-center gap-3 border-b border-line py-1 {active
							? '-mx-3 rounded-card border-transparent bg-surface px-3 ring-[1.5px] ring-trail'
							: ''}"
						onmouseenter={() => (hoveredKey = s.id)}
						onmouseleave={() => (hoveredKey = null)}
					>
						<span class="nums text-[22px] font-medium {active ? 'text-trail-dark' : 'text-muted'}">
							{pad(s.dayIndex)}
						</span>
						<button
							type="button"
							onclick={() => toggle(s.id)}
							aria-pressed={active}
							class="min-w-0 cursor-pointer py-2.5 text-left"
						>
							<span class="block font-semibold">
								Tag {s.dayIndex}{s.date ? ` · ${formatShortDate(s.date)}` : ''}{s.id === longest
									? ' · längste Etappe'
									: ''}
							</span>
							{#if s.title}<span class="block truncate text-sm text-ink-soft">{s.title}</span>{/if}
							<span class="block nums text-[13px] text-muted">
								{formatKm(s.distanceM)} · ↑{formatM(s.ascentM)} · ↓{formatM(s.descentM)}
							</span>
						</button>
						{#if s.nightPlaceId}
							<a
								href={resolve('/(app)/orte/[id]', { id: s.nightPlaceId })}
								class="col-start-2 -mt-1.5 mb-2 flex items-center gap-1.5 text-[13px] text-place hover:underline"
							>
								<svg
									class="size-3.5"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									aria-hidden="true"><path d="M3 11 L12 4 L21 11 V20 H3 Z" /></svg
								>
								Übernachtung: {s.nightPlaceName}
							</a>
						{/if}
						<a
							href={resolve('/api/gpx/stage/[id]', { id: s.id })}
							download
							class="btn btn-icon hover:bg-paper"
							aria-label="GPX von Tag {s.dayIndex} herunterladen"
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
					</li>
				{:else}
					<li class="py-4 text-sm text-muted">Noch keine Etappen.</li>
				{/each}
			</ol>
		</div>
	</section>

	{#if profilePoints.length > 1}
		<section aria-labelledby="profil" class="flex flex-col gap-4">
			<div class="flex flex-wrap items-baseline justify-between gap-2">
				<h2 id="profil" class="text-[32px] font-display leading-none">
					Höhenprofil{selectedStage ? ` · Tag ${selectedStage.dayIndex}` : ''}
				</h2>
				<span class="text-sm text-muted"
					>Über das Profil fahren zeigt die Position auf der Karte.</span
				>
			</div>
			<ElevationProfile
				points={profilePoints}
				{dayStarts}
				height={220}
				onhover={(p) => (hoverPoint = p)}
			/>
		</section>
	{/if}

	{#if data.tour.summaryMd}
		<section aria-labelledby="bericht" class="flex flex-col gap-4">
			<h2 id="bericht" class="text-[32px] font-display leading-none">Bericht</h2>
			<div class="card max-w-[72ch] px-6 py-6 sm:px-8">
				<p class="text-[17px] leading-relaxed whitespace-pre-line text-[#2b332e]">
					{data.tour.summaryMd}
				</p>
			</div>
		</section>
	{/if}

	{#if data.stages.length}
		<section aria-labelledby="downloads" class="flex flex-col gap-4">
			<h2 id="downloads" class="text-[32px] font-display leading-none">Downloads</h2>
			<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
				<a
					href={resolve('/api/gpx/tour/[slug]', { slug: data.tour.slug })}
					download
					class="card flex items-center gap-3.5 p-4.5 hover:border-ink"
				>
					<span class="grid size-11 shrink-0 place-items-center rounded-ui bg-trail text-white">
						<svg
							class="size-5"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							aria-hidden="true"><path d="M12 4 V15 M7 10 L12 15 L17 10 M5 20 H19" /></svg
						>
					</span>
					<span>
						<span class="block font-bold">Ganze Tour</span>
						<span class="text-sm text-muted">
							{data.stages.length === 1 ? 'Eine Etappe' : `Alle ${data.stages.length} Etappen`} in einer
							GPX-Datei
						</span>
					</span>
				</a>
				<div class="card flex items-center gap-3.5 p-4.5">
					<span class="grid size-11 shrink-0 place-items-center rounded-ui bg-ink text-white">
						<svg
							class="size-5"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							aria-hidden="true"><path d="M4 6 H20 M4 12 H20 M4 18 H14" /></svg
						>
					</span>
					<span>
						<span class="block font-bold">Etappen einzeln</span>
						<span class="text-sm text-muted">Original-GPX pro Tag, bei jeder Etappe oben</span>
					</span>
				</div>
			</div>
		</section>
	{/if}
</div>
