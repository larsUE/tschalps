<script lang="ts">
	import { enhance } from '$app/forms';
	import FormErrors from '#lib/components/FormErrors.svelte';
	import GpxInput from '#lib/components/GpxInput.svelte';
	import TourFields from '#lib/components/TourFields.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	let pending = $state(false);
</script>

<svelte:head>
	<title>Neue Tschalps · Tschalps</title>
</svelte:head>

<section class="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 pt-10 pb-20 sm:px-6">
	<div class="flex flex-col gap-2">
		<span class="eyebrow text-trail-dark">Archiv</span>
		<h1 class="text-[56px] font-display sm:text-[72px]">Neue Tschalps</h1>
	</div>

	<form
		method="POST"
		enctype="multipart/form-data"
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
		<TourFields values={form?.values ?? { year: data.year }} />
		<GpxInput required />
		<label class="flex min-h-11 items-center gap-2.5">
			<input type="checkbox" name="participated" checked class="check" />
			Ich war dabei
		</label>
		<div class="flex justify-end">
			<button disabled={pending} class="btn btn-primary">
				{pending ? 'Wird gespeichert …' : 'Speichern'}
			</button>
		</div>
	</form>
</section>
