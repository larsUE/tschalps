<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { formatM } from '#lib/geo.ts';
	import { PLACE_STATUS_LABELS, PLACE_TYPE_LABELS } from '#lib/labels.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const ACTION_LABELS = {
		create: 'Erfasst',
		update: 'Bearbeitet',
		status: 'Status geändert',
		delete: 'Entfernt',
		restore: 'Wiederhergestellt'
	} as const;

	const stamp = new Intl.DateTimeFormat('de-CH', { dateStyle: 'medium', timeStyle: 'short' });
</script>

<svelte:head>
	<title>Verlauf: {data.place.name} · Tschalps</title>
</svelte:head>

<section class="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 pt-10 pb-20 sm:px-6">
	<div class="flex flex-col gap-2">
		<a
			href={resolve('/(app)/orte/[id]', { id: data.place.id })}
			class="nums text-[13px] text-muted hover:text-ink">← {data.place.name}</a
		>
		<h1 class="text-[48px] font-display sm:text-[64px]">Verlauf</h1>
		<p class="text-sm text-ink-soft">
			Alle Änderungen an diesem Ort, die neueste zuoberst.{data.isAdmin
				? ' Als Admin kannst du den Ort auf einen früheren Stand zurücksetzen.'
				: ''}
		</p>
	</div>

	{#if form?.error}<p class="notice notice-error">{form.error}</p>{/if}

	<ol class="flex flex-col gap-3">
		{#each data.revisions as r (r.id)}
			<li class="card flex flex-col gap-3 p-4">
				<div class="flex flex-wrap items-baseline justify-between gap-2">
					<span class="font-semibold">
						{ACTION_LABELS[r.action]}{r.author ? ` von ${r.author}` : ''}
						{#if r.isCurrent}<span class="ml-2 eyebrow text-ok">aktuell</span>{/if}
					</span>
					<span class="nums text-[13px] text-muted">{stamp.format(r.createdAt)}</span>
				</div>
				{#if r.note}<p class="text-sm text-ink-soft">{r.note}</p>{/if}
				{#if r.changed.length}
					<p class="text-sm text-muted">Geändert: {r.changed.join(', ')}</p>
				{/if}
				<details class="text-sm">
					<summary class="cursor-pointer text-muted hover:text-ink">Stand anzeigen</summary>
					<dl class="mt-2 grid grid-cols-[8rem_1fr] gap-x-3 gap-y-1">
						<dt class="text-muted">Name</dt>
						<dd>{r.snapshot.name}</dd>
						<dt class="text-muted">Art</dt>
						<dd>{PLACE_TYPE_LABELS[r.snapshot.type]}</dd>
						<dt class="text-muted">Status</dt>
						<dd>{PLACE_STATUS_LABELS[r.snapshot.status]}</dd>
						<dt class="text-muted">Lage</dt>
						<dd class="nums">{r.snapshot.lat.toFixed(5)}, {r.snapshot.lng.toFixed(5)}</dd>
						<dt class="text-muted">Höhe</dt>
						<dd class="nums">{r.snapshot.ele ? formatM(r.snapshot.ele) : '–'}</dd>
						<dt class="text-muted">Beschreibung</dt>
						<dd class="whitespace-pre-line">{r.snapshot.description ?? '–'}</dd>
						<dt class="text-muted">Zugang</dt>
						<dd class="whitespace-pre-line">{r.snapshot.access ?? '–'}</dd>
					</dl>
				</details>
				{#if data.isAdmin && !r.isCurrent}
					<form
						method="POST"
						action="?/revert"
						use:enhance
						class="self-end"
						onsubmit={(e) => {
							if (!confirm('Ort auf diesen Stand zurücksetzen?')) e.preventDefault();
						}}
					>
						<input type="hidden" name="revision" value={r.id} />
						<button class="btn btn-outline btn-sm">Auf diesen Stand zurücksetzen</button>
					</form>
				{/if}
			</li>
		{/each}
	</ol>
</section>
