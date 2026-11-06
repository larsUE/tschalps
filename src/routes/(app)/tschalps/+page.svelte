<script lang="ts">
	import { resolve } from '$app/paths';
	import { formatKm, formatM } from '#lib/geo.ts';
	import { SEASON_LABELS, formatDate } from '#lib/labels.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const byYear = $derived(
		Object.entries(Object.groupBy(data.tours, (t) => t.year)).sort(
			([a], [b]) => Number(b) - Number(a)
		)
	);
</script>

<svelte:head>
	<title>Tschalps · Archiv</title>
</svelte:head>

<section class="mx-auto w-full max-w-6xl space-y-8 px-4 py-8">
	<div class="flex flex-wrap items-end justify-between gap-4">
		<div>
			<h1 class="text-2xl font-bold">Tschalps</h1>
			<p class="mt-1 text-stone-600">
				{data.tours.length} Tschalps im Archiv.
			</p>
		</div>
		<a
			href={resolve('/(app)/tschalps/neu')}
			class="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800"
		>
			Neue Tschalps erfassen
		</a>
	</div>

	{#if data.tours.length === 0}
		<div class="rounded-xl border border-dashed border-stone-300 p-10 text-center text-stone-600">
			Noch keine Tschalps erfasst. Lade die GPX-Dateien einer Tour hoch, um zu beginnen.
		</div>
	{/if}

	{#each byYear as [year, tours] (year)}
		<div>
			<h2 class="mb-3 text-sm font-semibold tracking-wide text-stone-500">{year}</h2>
			<ul class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
				{#each tours ?? [] as t (t.slug)}
					<li>
						<a
							href={resolve('/(app)/tschalps/[slug]', { slug: t.slug })}
							class="block h-full rounded-xl bg-white p-4 shadow-sm ring-1 ring-stone-200 transition hover:ring-emerald-600"
						>
							<p class="font-semibold">{t.title}</p>
							<p class="mt-0.5 text-sm text-stone-500">
								{[t.season && SEASON_LABELS[t.season], t.startDate && formatDate(t.startDate)]
									.filter(Boolean)
									.join(' · ') || t.year}
							</p>
							<p class="mt-3 flex flex-wrap gap-x-4 text-sm text-stone-700">
								<span>{t.days} {t.days === 1 ? 'Tag' : 'Tage'}</span>
								<span>{formatKm(t.distanceM)}</span>
								<span>↑ {formatM(t.ascentM)}</span>
							</p>
						</a>
					</li>
				{/each}
			</ul>
		</div>
	{/each}
</section>
