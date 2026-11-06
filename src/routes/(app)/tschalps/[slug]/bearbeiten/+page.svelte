<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import FormErrors from '#lib/components/FormErrors.svelte';
	import GpxInput from '#lib/components/GpxInput.svelte';
	import TourFields from '#lib/components/TourFields.svelte';
	import { formatKm, formatM } from '#lib/geo.ts';
	import { dayColor } from '#lib/labels.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	let uploading = $state(false);

	const card = 'space-y-5 rounded-xl bg-white p-5 shadow-sm ring-1 ring-stone-200';
	const primary =
		'rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-60';
	const feedback = (action: string) => (form?.action === action ? form : null);
</script>

<svelte:head>
	<title>{data.tour.title} bearbeiten · Tschalps</title>
</svelte:head>

<section class="mx-auto w-full max-w-2xl space-y-6 px-4 py-8">
	<div>
		<a
			href={resolve('/(app)/tschalps/[slug]', { slug: data.tour.slug })}
			class="text-sm text-stone-500 hover:text-stone-800"
		>
			← Zurück zur Tschalps
		</a>
		<h1 class="mt-2 text-2xl font-bold">{data.tour.title} bearbeiten</h1>
	</div>

	<form
		method="POST"
		action="?/save"
		use:enhance={() =>
			({ update }) =>
				update({ reset: false })}
		class={card}
	>
		<h2 class="font-semibold">Angaben</h2>
		<FormErrors errors={feedback('save')?.errors} />
		<TourFields values={feedback('save')?.values ?? data.tour} />

		<fieldset>
			<legend class="mb-2 text-sm font-medium text-stone-700">Dabei waren</legend>
			<div class="grid max-h-60 gap-1.5 overflow-y-auto rounded-lg p-1 sm:grid-cols-2">
				{#each data.members as m (m.id)}
					<label class="flex items-center gap-2 text-sm">
						<input
							type="checkbox"
							name="participants"
							value={m.id}
							checked={m.participant}
							class="rounded text-emerald-700 focus:ring-emerald-600"
						/>
						{m.name}
					</label>
				{/each}
			</div>
		</fieldset>

		<div class="flex justify-end"><button class={primary}>Speichern</button></div>
	</form>

	<div class={card}>
		<h2 class="font-semibold">Etappen</h2>
		<FormErrors errors={feedback('stages')?.errors} />
		{#if feedback('stages')?.message}
			<p class="text-sm text-emerald-800">{feedback('stages')?.message}</p>
		{/if}

		<ol class="space-y-3">
			{#each data.stages as s (s.id)}
				<li class="rounded-lg p-3 ring-1 ring-stone-200">
					<form
						method="POST"
						action="?/updateStage"
						use:enhance
						class="flex flex-wrap items-end gap-2"
					>
						<input type="hidden" name="id" value={s.id} />
						<span class="flex w-full items-center gap-2 text-sm font-medium">
							<span class="size-3 rounded-full" style:background-color={dayColor(s.dayIndex)}
							></span>
							Tag {s.dayIndex}
							<span class="font-normal text-stone-500">
								{formatKm(s.distanceM)} · ↑ {formatM(s.ascentM)}
							</span>
						</span>
						<input
							name="title"
							value={s.title ?? ''}
							placeholder="Titel, z. B. Furkapass – Realp"
							aria-label="Titel von Tag {s.dayIndex}"
							class="min-w-0 flex-1 rounded-md border-stone-300 text-sm"
						/>
						<input
							name="date"
							type="date"
							value={s.date ?? ''}
							aria-label="Datum von Tag {s.dayIndex}"
							class="rounded-md border-stone-300 text-sm"
						/>
						<button class="rounded-md px-3 py-2 text-sm ring-1 ring-stone-300 hover:bg-stone-50">
							Speichern
						</button>
						<button
							formaction="?/deleteStage"
							class="rounded-md px-3 py-2 text-sm text-red-700 ring-1 ring-red-200 hover:bg-red-50"
							onclick={(e) => {
								if (!confirm(`Tag ${s.dayIndex} wirklich löschen?`)) e.preventDefault();
							}}
						>
							Löschen
						</button>
					</form>
				</li>
			{:else}
				<li class="text-sm text-stone-500">Noch keine Etappen.</li>
			{/each}
		</ol>
		<p class="text-xs text-stone-500">Die Tage werden nach Datum nummeriert.</p>

		<form
			method="POST"
			action="?/addStages"
			enctype="multipart/form-data"
			class="space-y-3 border-t border-stone-200 pt-5"
			use:enhance={() => {
				uploading = true;
				return async ({ update }) => {
					await update();
					uploading = false;
				};
			}}
		>
			<h3 class="text-sm font-semibold">Weitere GPX-Dateien hinzufügen</h3>
			<FormErrors errors={feedback('addStages')?.errors} />
			{#if feedback('addStages')?.message}
				<p class="text-sm text-emerald-800">{feedback('addStages')?.message}</p>
			{/if}
			<GpxInput />
			<div class="flex justify-end">
				<button disabled={uploading} class={primary}>
					{uploading ? 'Wird hochgeladen …' : 'Hochladen'}
				</button>
			</div>
		</form>
	</div>

	<form method="POST" action="?/deleteTour" use:enhance class="{card} ring-red-200">
		<h2 class="font-semibold text-red-800">Tschalps löschen</h2>
		<FormErrors errors={feedback('deleteTour')?.errors} />
		<p class="text-sm text-stone-600">
			Löscht die Tschalps mit allen Etappen, GPX-Dateien und Fotos. Das kann nicht rückgängig
			gemacht werden.
		</p>
		<label class="flex items-center gap-2 text-sm">
			<input
				type="checkbox"
				name="confirm"
				value="yes"
				class="rounded text-red-700 focus:ring-red-600"
			/>
			Ja, endgültig löschen
		</label>
		<div class="flex justify-end">
			<button
				class="rounded-lg bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800"
			>
				Löschen
			</button>
		</div>
	</form>
</section>
