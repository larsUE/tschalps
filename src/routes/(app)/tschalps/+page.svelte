<script lang="ts">
	import { resolve } from '$app/paths';
	import { formatKm, formatM } from '#lib/geo.ts';
	import TrailMixBar from '#lib/components/TrailMixBar.svelte';
	import {
		SEASON_LABELS,
		TOUR_KIND_LABELS,
		formatDateRange,
		yearColors,
		type Season,
		type TourKind
	} from '#lib/labels.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let query = $state('');
	let season = $state<Season | null>(null);
	let kind = $state<TourKind | null>(null);
	let huts = $state(false);
	/** Number of days ('' = any). */
	let days = $state('');

	const colors = $derived(yearColors(data.tours.map((t) => t.year)));
	const seasons = $derived(
		(Object.keys(SEASON_LABELS) as Season[]).filter((s) => data.tours.some((t) => t.season === s))
	);

	const kinds = $derived(
		(Object.keys(TOUR_KIND_LABELS) as TourKind[]).filter((k) =>
			data.tours.some((t) => t.kind === k)
		)
	);
	const hasHuts = $derived(data.tours.some((t) => t.huts));
	const dayCounts = $derived(
		[...new Set(data.tours.map((t) => t.days).filter((d) => d > 0))].sort((a, b) => a - b)
	);
	const filtering = $derived(!!(query.trim() || season || kind || huts || days));

	const filtered = $derived(
		data.tours.filter(
			(t) =>
				(!season || t.season === season) &&
				(!kind || t.kind === kind) &&
				(!huts || t.huts) &&
				(!days || t.days === Number(days)) &&
				(!query.trim() || `${t.title} ${t.year}`.toLowerCase().includes(query.trim().toLowerCase()))
		)
	);
	const byYear = $derived(
		Object.entries(Object.groupBy(filtered, (t) => t.year)).sort(
			([a], [b]) => Number(b) - Number(a)
		)
	);
</script>

<svelte:head>
	<title>Tschalps · Archiv</title>
</svelte:head>

<section class="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 pt-10 pb-24 sm:px-6 sm:pt-12">
	<div class="flex flex-wrap items-end justify-between gap-6">
		<div class="flex max-w-2xl flex-col gap-3">
			<span class="eyebrow text-trail-dark">Archiv</span>
			<h1 class="text-[64px] font-display sm:text-[96px] lg:text-[112px]">Alle Tschalps</h1>
			<p class="text-lg text-ink-soft">
				{data.tours.length} Tschalps, nach Jahr sortiert. Jede Route als GPX zum Herunterladen.
			</p>
		</div>
		<a href={resolve('/(app)/tschalps/neu')} class="btn btn-primary h-12 px-5">
			<svg
				class="size-4"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2.4"
				aria-hidden="true"><path d="M12 5 V19 M5 12 H19" /></svg
			>
			Neue Tschalps
		</a>
	</div>

	{#if data.tours.length}
		<div
			class="flex flex-wrap items-center gap-3 border-t-2 border-b border-t-ink border-b-line py-3"
		>
			<label
				class="flex h-11 min-w-0 flex-[1_1_280px] items-center gap-2.5 rounded-ui border border-line-strong bg-surface px-3.5"
			>
				<svg
					class="size-[18px] shrink-0 text-muted"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20 L16 16" /></svg
				>
				<span class="sr-only">Tschalps durchsuchen</span>
				<input
					type="search"
					bind:value={query}
					placeholder="Tour oder Jahr"
					class="min-w-0 flex-1 border-0 bg-transparent p-0 focus:ring-0"
				/>
			</label>
			{#if seasons.length > 1}
				<div role="group" aria-label="Jahreszeit" class="segmented border border-line-strong">
					<button type="button" aria-pressed={season === null} onclick={() => (season = null)}>
						Alle
					</button>
					{#each seasons as s (s)}
						<button type="button" aria-pressed={season === s} onclick={() => (season = s)}>
							{SEASON_LABELS[s]}
						</button>
					{/each}
				</div>
			{/if}
			{#if kinds.length}
				<div role="group" aria-label="Art" class="segmented border border-line-strong">
					<button type="button" aria-pressed={kind === null} onclick={() => (kind = null)}>
						Alle
					</button>
					{#each kinds as k (k)}
						<button type="button" aria-pressed={kind === k} onclick={() => (kind = k)}>
							{TOUR_KIND_LABELS[k].replace('tschalps', '')}
						</button>
					{/each}
				</div>
			{/if}
			{#if hasHuts}
				<div class="segmented border border-line-strong">
					<button type="button" aria-pressed={huts} onclick={() => (huts = !huts)}>
						Hüttentschalps
					</button>
				</div>
			{/if}
			{#if dayCounts.length > 1}
				<label
					class="flex h-11 items-center gap-2 rounded-ui border border-line-strong bg-surface pl-3.5"
				>
					<span class="text-[15px] text-muted">Tage</span>
					<select
						bind:value={days}
						class="h-full border-0 bg-transparent py-0 pr-8 pl-1 focus:ring-0"
					>
						<option value="">Alle</option>
						{#each dayCounts as d (d)}
							<option value={String(d)}>{d}</option>
						{/each}
					</select>
				</label>
			{/if}
			{#if filtering}
				<button
					type="button"
					class="cursor-pointer text-sm underline hover:text-trail"
					onclick={() => {
						query = '';
						season = kind = null;
						huts = false;
						days = '';
					}}
				>
					Filter zurücksetzen
				</button>
				<span class="nums text-sm text-muted">{filtered.length} von {data.tours.length}</span>
			{/if}
		</div>
	{:else}
		<div class="rounded-card border border-dashed border-line-strong p-10 text-center text-muted">
			Noch keine Tschalps erfasst. Lade die GPX-Dateien einer Tour hoch, um zu beginnen.
		</div>
	{/if}

	{#each byYear as [year, tours], i (year)}
		<section
			aria-labelledby="y{year}"
			class="grid gap-x-8 gap-y-4 md:grid-cols-[200px_1fr] {i ? 'border-t border-line pt-8' : ''}"
		>
			<h2 id="y{year}" class="nums text-[56px] leading-none font-medium">{year}</h2>
			<ul class="flex min-w-0 flex-col gap-3">
				{#each tours ?? [] as t (t.slug)}
					<li>
						<a
							href={resolve('/(app)/tschalps/[slug]', { slug: t.slug })}
							class="card grid grid-cols-[88px_1fr] items-center gap-4 p-3 transition-colors hover:border-ink sm:grid-cols-[120px_1fr] sm:gap-5"
						>
							<svg
								viewBox="0 0 120 120"
								role="img"
								aria-label="Routenskizze"
								class="w-full rounded-ui bg-map"
							>
								{#if t.thumb}
									<path
										d={t.thumb.path}
										fill="none"
										stroke={colors.get(t.year)}
										stroke-width="2.5"
										stroke-linejoin="round"
										stroke-linecap="round"
									/>
									{#each t.thumb.nights as [cx, cy], n (n)}
										<circle
											{cx}
											{cy}
											r="2.5"
											fill="#fff"
											stroke={colors.get(t.year)}
											stroke-width="1.5"
										/>
									{/each}
								{/if}
							</svg>
							<div class="flex min-w-0 flex-col gap-1.5">
								<div class="flex flex-wrap items-baseline gap-x-4 gap-y-1">
									<span class="text-[26px] font-display leading-[1.05] sm:text-[30px]"
										>{t.title}</span
									>
									<span class="text-[15px] text-muted">
										{[formatDateRange(t.startDate, t.endDate), t.season && SEASON_LABELS[t.season]]
											.filter(Boolean)
											.join(' · ')}
									</span>
								</div>
								{#if t.days}
									<p class="nums text-sm">
										{formatKm(t.distanceM)} · ↑{formatM(t.ascentM)} · ↓{formatM(t.descentM)} · max.
										{formatM(t.maxEle)} · {t.days}
										{t.days === 1 ? 'Tag' : 'Tage'}{t.difficulty ? ` · bis ${t.difficulty}` : ''}
									</p>
								{/if}
								{#if t.trailMix}
									<TrailMixBar mix={t.trailMix} class="max-w-80" />
								{/if}
								<div class="flex flex-wrap gap-1.5 text-[13px]">
									{#if t.days}
										<span class="rounded border border-line bg-paper px-2 py-0.5">GPX</span>
									{:else}
										<span
											class="rounded border border-dashed border-line-strong px-2 py-0.5 text-muted"
										>
											Noch keine GPX
										</span>
									{/if}
									{#if t.hasReport}
										<span class="rounded border border-line bg-paper px-2 py-0.5">Bericht</span>
									{/if}
									{#if t.kind}
										<span class="rounded border border-line bg-paper px-2 py-0.5"
											>{TOUR_KIND_LABELS[t.kind]}</span
										>
									{/if}
									{#if t.huts}
										<span class="rounded border border-line bg-paper px-2 py-0.5">Hütten</span>
									{/if}
								</div>
							</div>
						</a>
					</li>
				{/each}
			</ul>
		</section>
	{:else}
		{#if data.tours.length}
			<p class="text-muted">Keine Tschalps gefunden.</p>
		{/if}
	{/each}
</section>
