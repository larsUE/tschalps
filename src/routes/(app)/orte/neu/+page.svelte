<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import FormErrors from '#lib/components/FormErrors.svelte';
	import PlaceFields from '#lib/components/PlaceFields.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	let pending = $state(false);
</script>

<svelte:head>
	<title>Ort erfassen · Tschalps</title>
</svelte:head>

<section class="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 pt-10 pb-20 sm:px-6">
	<div class="flex flex-col gap-2">
		<a href={resolve('/(app)/orte')} class="nums text-[13px] text-muted hover:text-ink">← Orte</a>
		<span class="eyebrow text-trail-dark">Orte</span>
		<h1 class="text-[56px] font-display sm:text-[72px]">Ort erfassen</h1>
		{#if data.stage}
			<p class="notice notice-ok">
				Wird als Übernachtung von Tag {data.stage.dayIndex} der Tschalps «{data.stage.title}»
				eingetragen.
			</p>
		{/if}
	</div>

	<form
		method="POST"
		class="card flex flex-col gap-6 p-5 sm:p-6"
		use:enhance={() => {
			pending = true;
			return async ({ update }) => {
				await update({ reset: false });
				pending = false;
			};
		}}
	>
		<FormErrors errors={form?.errors} />
		{#if form?.nearby}
			<div class="notice notice-error flex flex-col gap-2" role="alert">
				<p class="font-semibold">In der Nähe gibt es schon:</p>
				<ul class="list-disc pl-5">
					{#each form.nearby as p (p.id)}
						<li>
							<a href={resolve('/(app)/orte/[id]', { id: p.id })} class="underline" target="_blank"
								>{p.name}</a
							>
							<span class="nums">({p.distanceM} m entfernt)</span>
						</li>
					{/each}
				</ul>
				<label class="flex min-h-11 items-center gap-2.5">
					<input type="checkbox" name="confirmNearby" value="yes" class="check" />
					Es ist ein anderer Ort, trotzdem erfassen
				</label>
			</div>
		{/if}

		<PlaceFields values={form?.values ?? data.values} />
		{#if data.stage}<input type="hidden" name="stageId" value={data.stage.id} />{/if}

		<div class="flex justify-end">
			<button disabled={pending} class="btn btn-primary">
				{pending ? 'Wird gespeichert …' : 'Ort speichern'}
			</button>
		</div>
	</form>
</section>
