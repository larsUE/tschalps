<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import FormErrors from '#lib/components/FormErrors.svelte';
	import GpxInput from '#lib/components/GpxInput.svelte';
	import MarkdownHint from '#lib/components/MarkdownHint.svelte';
	import TourFields from '#lib/components/TourFields.svelte';
	import TrailMixBar from '#lib/components/TrailMixBar.svelte';
	import { formatKm, formatM } from '#lib/geo.ts';
	import { DIFFICULTY_LABELS } from '#lib/labels.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	/** Distance from the end of the day, e.g. "350 m" or "1.2 km". */
	const distanceLabel = (m: number) =>
		m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1)} km`;

	let uploading = $state(false);
	let recomputing = $state(false);

	const card = 'card flex flex-col gap-5 p-5 sm:p-6';
	const primary = 'btn btn-primary';
	const feedback = (action: string) => (form?.action === action ? form : null);
</script>

<svelte:head>
	<title>{data.tour.title} bearbeiten · Tschalps</title>
</svelte:head>

<section class="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 pt-8 pb-20 sm:px-6">
	<div class="flex flex-col gap-3">
		<a
			href={resolve('/(app)/tschalps/[slug]', { slug: data.tour.slug })}
			class="nums text-[13px] text-muted hover:text-ink"
		>
			← Zurück zur Tschalps
		</a>
		<span class="eyebrow text-trail-dark">Bearbeiten</span>
		<h1 class="text-[48px] font-display sm:text-[64px]">{data.tour.title}</h1>
	</div>

	<form
		method="POST"
		action="?/save"
		use:enhance={() =>
			({ update }) =>
				update({ reset: false })}
		class={card}
	>
		<h2 class="text-[28px] font-display leading-none">Angaben</h2>
		<FormErrors errors={feedback('save')?.errors} />
		<TourFields values={feedback('save')?.values ?? data.tour} />

		<fieldset>
			<legend class="label">Dabei waren</legend>
			<div
				class="grid max-h-60 gap-1 overflow-y-auto rounded-ui border border-line bg-paper p-2 sm:grid-cols-2"
			>
				{#each data.members as m (m.id)}
					<label class="flex min-h-9 items-center gap-2.5 text-[15px]">
						<input
							type="checkbox"
							name="participants"
							value={m.id}
							checked={m.participant}
							class="check"
						/>
						{m.name}
					</label>
				{/each}
			</div>
		</fieldset>

		<div class="flex justify-end"><button class={primary}>Speichern</button></div>
	</form>

	<div class={card}>
		<h2 class="text-[28px] font-display leading-none">Etappen</h2>
		<FormErrors errors={feedback('stages')?.errors} />
		{#if feedback('stages')?.message}
			<p class="notice notice-ok">{feedback('stages')?.message}</p>
		{/if}

		<ol class="space-y-3">
			{#each data.stages as s (s.id)}
				<li class="rounded-ui border border-line p-3">
					<form
						method="POST"
						action="?/updateStage"
						use:enhance
						class="flex flex-wrap items-end gap-2"
					>
						<input type="hidden" name="id" value={s.id} />
						<span class="flex w-full items-baseline gap-2.5 font-semibold">
							<span class="nums font-medium text-muted">{String(s.dayIndex).padStart(2, '0')}</span>
							Tag {s.dayIndex}
							<span class="nums text-[13px] font-normal text-muted">
								{formatKm(s.distanceM)} · ↑ {formatM(s.ascentM)}
							</span>
						</span>
						<input
							name="title"
							value={s.title ?? ''}
							placeholder="Titel, z. B. Furkapass – Realp"
							aria-label="Titel von Tag {s.dayIndex}"
							class="field min-w-0 flex-1 text-[15px]"
						/>
						<input
							name="date"
							type="date"
							value={s.date ?? ''}
							aria-label="Datum von Tag {s.dayIndex}"
							class="field w-auto text-[15px]"
						/>
						<div class="flex w-full flex-wrap items-end gap-2">
							<label class="min-w-0 flex-1">
								<span class="mb-1 block text-[13px] text-muted">Schwierigkeit (SAC-Skala)</span>
								<select name="difficulty" value={s.difficulty ?? ''} class="field text-[15px]">
									<option value="">–</option>
									{#each Object.entries(DIFFICULTY_LABELS) as [value, text] (value)}
										<option {value}>{text}</option>
									{/each}
								</select>
							</label>
						</div>
						{#if s.trailMix}
							<TrailMixBar mix={s.trailMix} legend class="w-full py-1" />
						{/if}
						<div class="flex w-full flex-wrap items-end gap-2">
							<label class="min-w-0 flex-1">
								<span class="mb-1 block text-[13px] text-muted"
									>Übernachtung nach Tag {s.dayIndex}</span
								>
								<select name="nightPlaceId" value={s.nightPlaceId ?? ''} class="field text-[15px]">
									<option value="">– kein Ort –</option>
									{#each s.nightOptions as o (o.id)}
										<option value={o.id}
											>{o.name}{Number.isFinite(o.distanceM)
												? ` (${distanceLabel(o.distanceM)})`
												: ''}</option
										>
									{/each}
								</select>
							</label>
							{#if s.end}
								<a
									href={resolve(
										`/(app)/orte/neu?${new URLSearchParams({ lat: s.end.lat.toFixed(6), lng: s.end.lng.toFixed(6), etappe: s.id })}`
									)}
									class="btn btn-outline btn-sm min-h-11"
								>
									Neuer Ort
								</a>
							{/if}
						</div>
						<details class="w-full" open={!!s.reportMd}>
							<summary class="cursor-pointer text-[13px] text-muted hover:text-ink">
								Tagesbericht{s.reportMd ? '' : ' schreiben'}
							</summary>
							<label class="mt-2 block">
								<span class="sr-only">Tagesbericht von Tag {s.dayIndex}</span>
								<textarea
									name="reportMd"
									rows="6"
									placeholder="Was ist an diesem Tag passiert?"
									class="field text-[15px]">{s.reportMd ?? ''}</textarea
								>
								<MarkdownHint />
							</label>
						</details>
						<button class="btn btn-outline btn-sm min-h-11"> Speichern </button>
						<button
							formaction="?/deleteStage"
							class="btn btn-sm min-h-11 border border-[#e3b4ae] text-danger hover:bg-[#fbe9e7]"
							onclick={(e) => {
								if (!confirm(`Tag ${s.dayIndex} wirklich löschen?`)) e.preventDefault();
							}}
						>
							Löschen
						</button>
					</form>
				</li>
			{:else}
				<li class="text-sm text-muted">Noch keine Etappen.</li>
			{/each}
		</ol>
		<p class="text-sm text-muted">Die Tage werden nach Datum nummeriert.</p>
		{#if data.stages.length}
			<form
				method="POST"
				action="?/recomputeTrails"
				use:enhance={() => {
					recomputing = true;
					return async ({ update }) => {
						await update();
						recomputing = false;
					};
				}}
				class="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4"
			>
				<p class="max-w-md text-sm text-muted">
					Die Anteile der Wegtypen werden beim Hochladen aus dem heutigen Wanderwegnetz von
					swisstopo berechnet.
				</p>
				<button disabled={recomputing} class="btn btn-outline btn-sm min-h-11">
					{recomputing ? 'Wird berechnet …' : 'Wegtypen neu berechnen'}
				</button>
				<FormErrors errors={feedback('trails')?.errors} />
				{#if feedback('trails')?.message}
					<p class="notice notice-ok w-full">{feedback('trails')?.message}</p>
				{/if}
			</form>
		{/if}

		<form
			method="POST"
			action="?/addStages"
			enctype="multipart/form-data"
			class="flex flex-col gap-3 border-t border-line pt-5"
			use:enhance={() => {
				uploading = true;
				return async ({ update }) => {
					await update();
					uploading = false;
				};
			}}
		>
			<h3 class="font-semibold">Weitere GPX-Dateien hinzufügen</h3>
			<FormErrors errors={feedback('addStages')?.errors} />
			{#if feedback('addStages')?.message}
				<p class="notice notice-ok">{feedback('addStages')?.message}</p>
			{/if}
			<GpxInput />
			<div class="flex justify-end">
				<button disabled={uploading} class={primary}>
					{uploading ? 'Wird hochgeladen …' : 'Hochladen'}
				</button>
			</div>
		</form>
	</div>

	<form method="POST" action="?/deleteTour" use:enhance class="{card} border-[#e3b4ae]">
		<h2 class="text-[28px] font-display leading-none text-danger">Tschalps löschen</h2>
		<FormErrors errors={feedback('deleteTour')?.errors} />
		<p class="text-ink-soft">
			Löscht die Tschalps mit allen Etappen, GPX-Dateien und Fotos. Das kann nicht rückgängig
			gemacht werden.
		</p>
		<label class="flex min-h-11 items-center gap-2.5">
			<input type="checkbox" name="confirm" value="yes" class="check" />
			Ja, endgültig löschen
		</label>
		<div class="flex justify-end">
			<button class="btn btn-danger">Löschen</button>
		</div>
	</form>
</section>
