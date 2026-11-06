<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import type { PageProps } from './$types';

	let { form }: PageProps = $props();

	let step = $derived(form?.step ?? 'email');
	let email = $derived(form?.email ?? '');
	let redirectTo = $derived(form?.redirectTo ?? page.url.searchParams.get('redirectTo') ?? '');
	let pending = $state(false);

	const submit = () => {
		pending = true;
		return async ({ update }: { update: () => Promise<void> }) => {
			await update();
			pending = false;
		};
	};
</script>

<svelte:head>
	<title>Anmelden · Tschalps</title>
</svelte:head>

<main class="flex min-h-dvh items-center justify-center bg-stone-100 px-4">
	<div class="w-full max-w-sm">
		<h1 class="mb-1 text-3xl font-bold tracking-tight text-stone-900">Tschalps</h1>
		<p class="mb-8 text-stone-600">Archiv und Karte für Mitglieder.</p>

		<div class="rounded-xl bg-white p-6 shadow-sm ring-1 ring-stone-200">
			{#if step === 'email'}
				<form method="POST" action="?/sendCode" use:enhance={submit} class="space-y-4">
					<input type="hidden" name="redirectTo" value={redirectTo} />
					<label class="block">
						<span class="mb-1 block text-sm font-medium text-stone-700">E-Mail-Adresse</span>
						<input
							type="email"
							name="email"
							value={email}
							required
							autocomplete="email"
							class="w-full rounded-lg border-stone-300 focus:border-emerald-600 focus:ring-emerald-600"
						/>
					</label>
					{#if form?.error}<p class="text-sm text-red-700">{form.error}</p>{/if}
					<button
						disabled={pending}
						class="w-full rounded-lg bg-emerald-700 px-4 py-2 font-medium text-white hover:bg-emerald-800 disabled:opacity-60"
					>
						{pending ? 'Wird gesendet …' : 'Code senden'}
					</button>
				</form>
			{:else}
				<form method="POST" action="?/verify" use:enhance={submit} class="space-y-4">
					<p class="text-sm text-stone-700">
						Falls <strong>{email}</strong> als Mitglied eingetragen ist, haben wir dir einen 6-stelligen
						Code geschickt.
					</p>
					<input type="hidden" name="email" value={email} />
					<input type="hidden" name="redirectTo" value={redirectTo} />
					<label class="block">
						<span class="mb-1 block text-sm font-medium text-stone-700">Code</span>
						<!-- svelte-ignore a11y_autofocus -->
						<input
							name="otp"
							inputmode="numeric"
							autocomplete="one-time-code"
							pattern="[0-9 ]*"
							maxlength="7"
							required
							autofocus
							class="w-full rounded-lg border-stone-300 text-center font-mono text-2xl tracking-[0.4em] focus:border-emerald-600 focus:ring-emerald-600"
						/>
					</label>
					{#if form?.error}<p class="text-sm text-red-700">{form.error}</p>{/if}
					<button
						disabled={pending}
						class="w-full rounded-lg bg-emerald-700 px-4 py-2 font-medium text-white hover:bg-emerald-800 disabled:opacity-60"
					>
						{pending ? 'Wird geprüft …' : 'Anmelden'}
					</button>
				</form>
				<form method="POST" action="?/sendCode" use:enhance={submit} class="mt-3 text-center">
					<input type="hidden" name="email" value={email} />
					<input type="hidden" name="redirectTo" value={redirectTo} />
					<button class="text-sm text-stone-600 underline hover:text-stone-900"
						>Neuen Code senden</button
					>
				</form>
			{/if}
		</div>

		<p class="mt-6 text-center text-sm text-stone-500">
			Kein Zugang? Melde dich bei einer Leiterin oder einem Leiter.
		</p>
	</div>
</main>
