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

<section class="mx-auto w-full max-w-2xl space-y-6 px-4 py-8">
	<h1 class="text-2xl font-bold">Neue Tschalps erfassen</h1>

	<form
		method="POST"
		enctype="multipart/form-data"
		class="space-y-6 rounded-xl bg-white p-5 shadow-sm ring-1 ring-stone-200"
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
		<label class="flex items-center gap-2 text-sm">
			<input
				type="checkbox"
				name="participated"
				checked
				class="rounded text-emerald-700 focus:ring-emerald-600"
			/>
			Ich war dabei
		</label>
		<div class="flex justify-end">
			<button
				disabled={pending}
				class="rounded-lg bg-emerald-700 px-4 py-2 font-medium text-white hover:bg-emerald-800 disabled:opacity-60"
			>
				{pending ? 'Wird gespeichert …' : 'Speichern'}
			</button>
		</div>
	</form>
</section>
