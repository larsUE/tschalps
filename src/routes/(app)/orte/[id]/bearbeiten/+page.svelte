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
	<title>{data.place.name} bearbeiten · Tschalps</title>
</svelte:head>

<section class="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 pt-10 pb-20 sm:px-6">
	<div class="flex flex-col gap-2">
		<a
			href={resolve('/(app)/orte/[id]', { id: data.place.id })}
			class="nums text-[13px] text-muted hover:text-ink">← {data.place.name}</a
		>
		<h1 class="text-[48px] font-display sm:text-[64px]">Ort bearbeiten</h1>
		<p class="text-sm text-ink-soft">
			Alle Mitglieder können Orte ändern. Jede Änderung wird im Verlauf festgehalten.
		</p>
	</div>

	<form
		method="POST"
		action="?/save"
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
		<PlaceFields values={form?.values ?? data.place} showStatus />
		<div class="flex justify-end">
			<button disabled={pending} class="btn btn-primary">
				{pending ? 'Wird gespeichert …' : 'Speichern'}
			</button>
		</div>
	</form>

	<form
		method="POST"
		action="?/remove"
		use:enhance
		class="card flex flex-col gap-4 border-[#e3b4ae] p-5 sm:p-6"
	>
		<h2 class="text-2xl font-display text-danger">Ort entfernen</h2>
		<p class="text-sm text-ink-soft">
			Für Orte, die falsch oder doppelt erfasst sind. Gibt es den Stall nicht mehr, setze besser den
			Status auf «Existiert nicht mehr»: So bleibt das Wissen erhalten. Entfernte Orte können Admins
			wiederherstellen.
		</p>
		{#if form?.removeError}<p class="notice notice-error">{form.removeError}</p>{/if}
		<label class="flex min-h-11 items-center gap-2.5">
			<input type="checkbox" name="confirm" value="yes" class="check" />
			Ja, diesen Ort entfernen
		</label>
		<div class="flex justify-end"><button class="btn btn-danger">Entfernen</button></div>
	</form>
</section>
