<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import FitBounds from '#lib/map/FitBounds.svelte';
	import LayerSwitcher from '#lib/map/LayerSwitcher.svelte';
	import MapView from '#lib/map/MapView.svelte';
	import PlaceLayer from '#lib/map/PlaceLayer.svelte';
	import { mapPreferences } from '#lib/map/preferences.svelte.ts';
	import { formatLv95, formatM } from '#lib/geo.ts';
	import {
		PLACE_STATUS_LABELS,
		PLACE_TYPE_COLORS,
		PLACE_TYPE_LABELS,
		formatDate,
		formatShortDate
	} from '#lib/labels.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const prefs = mapPreferences();
	const p = $derived(data.place);
	const point = $derived<[number, number, number, number]>([p.lng, p.lat, p.lng, p.lat]);
	const stamp = new Intl.DateTimeFormat('de-CH', { dateStyle: 'medium' });

	let commentKey = $state(0);
</script>

<svelte:head>
	<title>{p.name} · Orte · Tschalps</title>
</svelte:head>

<div class="mx-auto flex w-full max-w-7xl flex-col gap-10 px-4 pt-8 pb-20 sm:px-6">
	<section class="flex flex-col gap-5">
		<nav aria-label="Brotkrumen" class="nums text-[13px] text-muted">
			<a href={resolve('/(app)/orte')} class="hover:text-ink">Orte</a>
			/ {PLACE_TYPE_LABELS[p.type]} /
			<span class="text-ink">{p.name}</span>
		</nav>

		{#if p.removed}
			<form
				method="POST"
				action="?/restore"
				use:enhance
				class="notice notice-error flex flex-wrap items-center justify-between gap-3"
			>
				<span>Dieser Ort wurde entfernt und ist nur für Admins sichtbar.</span>
				<button class="btn btn-dark btn-sm">Wiederherstellen</button>
			</form>
		{/if}

		<div class="flex flex-wrap items-end justify-between gap-6">
			<div class="flex min-w-0 flex-col gap-2">
				<span class="eyebrow" style:color={PLACE_TYPE_COLORS[p.type]}>
					{PLACE_TYPE_LABELS[p.type]}{p.status !== 'aktiv'
						? ` · ${PLACE_STATUS_LABELS[p.status]}`
						: ''}
				</span>
				<h1
					class="text-[48px] font-display break-words sm:text-[72px] {p.status ===
					'existiert_nicht_mehr'
						? 'text-muted line-through decoration-4'
						: ''}"
				>
					{p.name}
				</h1>
			</div>
			<div class="flex flex-wrap gap-2">
				<a href={resolve('/(app)/orte/[id]/verlauf', { id: p.id })} class="btn btn-outline">
					Verlauf{data.revisions > 1 ? ` (${data.revisions})` : ''}
				</a>
				{#if !p.removed}
					<a href={resolve('/(app)/orte/[id]/bearbeiten', { id: p.id })} class="btn btn-outline">
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
			</div>
		</div>
	</section>

	<dl class="grid grid-cols-2 border-t-2 border-b border-t-ink border-b-line lg:grid-cols-4">
		{#each [['Höhe (ü. M.)', p.ele ? formatM(p.ele) : '–'], ['LV95', formatLv95(p.lat, p.lng)], ['WGS84', `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`], ['Übernachtungen', String(data.nights.length)]] as [label, value] (label)}
			<div class="py-4 pr-4">
				<dt class="text-[13px] text-muted">{label}</dt>
				<dd class="nums text-lg leading-tight font-medium sm:text-xl">{value}</dd>
			</div>
		{/each}
	</dl>

	<section class="flex flex-col gap-6 lg:flex-row">
		<div class="flex flex-col gap-6 lg:flex-[2]">
			<div class="flex flex-col gap-2">
				<h2 class="text-[32px] font-display leading-none">Beschreibung</h2>
				{#if p.description}
					<p class="max-w-[72ch] text-[17px] leading-relaxed whitespace-pre-line">
						{p.description}
					</p>
				{:else}
					<p class="text-muted">Noch keine Beschreibung.</p>
				{/if}
			</div>
			{#if p.access}
				<div class="flex flex-col gap-2">
					<h2 class="text-[32px] font-display leading-none">Zugang &amp; Erlaubnis</h2>
					<p class="max-w-[72ch] text-[17px] leading-relaxed whitespace-pre-line">{p.access}</p>
				</div>
			{/if}

			{#if data.nights.length}
				<div class="flex flex-col gap-2">
					<h2 class="text-[32px] font-display leading-none">Hier übernachtet</h2>
					<ul class="flex flex-col border-t border-line">
						{#each data.nights as n (`${n.slug}-${n.dayIndex}`)}
							<li class="border-b border-line">
								<a
									href={resolve('/(app)/tschalps/[slug]', { slug: n.slug })}
									class="flex items-baseline justify-between gap-3 py-3 hover:text-trail-dark"
								>
									<span class="font-semibold">{n.title}</span>
									<span class="nums text-[13px] text-muted">
										{n.year} · Nacht nach Tag {n.dayIndex}{n.date
											? ` · ${formatShortDate(n.date)}`
											: ''}
									</span>
								</a>
							</li>
						{/each}
					</ul>
				</div>
			{/if}

			<p class="text-[13px] text-muted">
				Erfasst{p.createdBy ? ` von ${p.createdBy}` : ''} am {stamp.format(
					p.createdAt
				)}{p.updatedAt.getTime() - p.createdAt.getTime() > 60_000
					? ` · zuletzt geändert${p.updatedBy ? ` von ${p.updatedBy}` : ''} am ${stamp.format(p.updatedAt)}`
					: ''}
			</p>
		</div>

		<div
			class="relative h-80 overflow-hidden rounded-card border border-line bg-map lg:h-[420px] lg:flex-[3]"
		>
			<MapView basemap={prefs.basemap} overlays={prefs.overlays} initialBounds={point}>
				<PlaceLayer data={resolve('/api/places')} highlight={p.id} />
				<FitBounds bounds={point} />
			</MapView>
			<LayerSwitcher bind:basemap={prefs.basemap} bind:overlays={prefs.overlays} />
		</div>
	</section>

	<section aria-labelledby="beitraege" class="flex max-w-3xl flex-col gap-4">
		<h2 id="beitraege" class="text-[32px] font-display leading-none">Erfahrungen &amp; Tipps</h2>

		{#if !p.removed}
			{#key commentKey}
				<form
					method="POST"
					action="?/comment"
					class="card flex flex-col gap-3 p-4"
					use:enhance={() =>
						async ({ result, update }) => {
							await update({ reset: false });
							if (result.type === 'success') commentKey++;
						}}
				>
					<label>
						<span class="sr-only">Dein Beitrag</span>
						<textarea
							name="body"
							rows="3"
							required
							placeholder="Warst du hier? Wie war es, was sollten andere wissen?"
							class="field">{form?.body ?? ''}</textarea
						>
					</label>
					<div class="flex flex-wrap items-end justify-between gap-3">
						<label class="text-sm">
							<span class="label">Besucht am (optional)</span>
							<input
								type="date"
								name="visitedOn"
								value={form?.visitedOn ?? ''}
								class="field w-auto"
							/>
						</label>
						<button class="btn btn-dark">Beitrag speichern</button>
					</div>
					{#if form?.error}<p class="text-sm text-danger">{form.error}</p>{/if}
				</form>
			{/key}
		{/if}

		<ul class="flex flex-col gap-3">
			{#each data.comments as c (c.id)}
				<li class="card flex flex-col gap-2 p-4">
					<div class="flex items-baseline justify-between gap-3">
						<span class="font-semibold">{c.author ?? 'Ehemaliges Mitglied'}</span>
						<span class="nums text-[13px] text-muted">
							{c.visitedOn ? `Besuch ${formatDate(c.visitedOn)} · ` : ''}{stamp.format(c.createdAt)}
						</span>
					</div>
					<p class="leading-relaxed whitespace-pre-line">{c.body}</p>
					{#if c.canDelete}
						<form
							method="POST"
							action="?/deleteComment"
							use:enhance
							class="self-end"
							onsubmit={(e) => {
								if (!confirm('Beitrag löschen?')) e.preventDefault();
							}}
						>
							<input type="hidden" name="id" value={c.id} />
							<button class="cursor-pointer text-sm text-muted underline hover:text-danger">
								Löschen
							</button>
						</form>
					{/if}
				</li>
			{:else}
				<li class="text-muted">Noch keine Beiträge.</li>
			{/each}
		</ul>
	</section>
</div>
