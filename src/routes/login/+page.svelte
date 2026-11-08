<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import Logo from '#lib/components/Logo.svelte';
	import topo from '#lib/assets/topo.svg';
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

	// Decorative route line (a real week of Tschalps, without coordinates) for the title panel.
	const ROUTE =
		'M180 60 L187 67 L192 70 L197 74 L203 79 L201 83 L196 83 L194 89 L191 94 L186 92 L184 90 L178 98 L177 98 L170 104 L169 110 L170 119 L175 126 L177 134 L178 142 L175 150 L170 157 L172 166 L164 176 L158 182 L147 181 L141 180 L150 181 L158 186 L164 193 L168 201 L168 209 L175 215 L178 222 L179 232 L176 238 L173 247 L176 254 L185 255 L189 262 L194 269 L201 275 L212 272 L224 268 L233 269 L240 274 L241 283 L239 292 L238 300 L239 309 L241 318 L245 325 L247 333 L245 335 L240 337 L233 339 L221 337 L213 337 L211 346 L209 358 L207 360 L210 363 L211 372 L210 381 L211 389 L208 397 L207 405 L210 415 L216 420 L216 428 L217 433 L221 437 L212 438 L209 444 L208 449 L206 455 L201 456 L200 457 L200 460';
	const NIGHTS = [
		[177, 98],
		[141, 180],
		[233, 269],
		[207, 360],
		[212, 439]
	];
</script>

<svelte:head>
	<title>Anmelden · Tschalps</title>
</svelte:head>

<div class="flex min-h-dvh flex-col bg-paper text-ink lg:flex-row">
	<section
		aria-label="Tschalps"
		class="relative flex min-h-64 flex-col justify-between gap-10 overflow-hidden bg-map p-6 sm:p-10 lg:min-h-dvh lg:flex-1 lg:p-12"
	>
		<img src={topo} alt="" class="absolute inset-0 size-full object-cover" />
		<svg
			viewBox="0 0 390 520"
			aria-hidden="true"
			class="absolute top-10 -right-10 hidden h-[88%] w-[70%] lg:block"
		>
			<g fill="none" stroke-linecap="round" stroke-linejoin="round">
				<path d={ROUTE} stroke="#fff" stroke-width="8" />
				<path d={ROUTE} stroke="#be2a1f" stroke-width="4" />
			</g>
			{#each NIGHTS as [cx, cy] (`${cx}-${cy}`)}
				<circle {cx} {cy} r="6" fill="#fff" stroke="#be2a1f" stroke-width="2.5" />
			{/each}
		</svg>

		<div class="relative flex items-center gap-3">
			<Logo size={32} wordmark={false} />
			<span class="eyebrow text-ink">Kantonsschule Küsnacht</span>
		</div>

		<div class="relative flex max-w-lg flex-col gap-4">
			<h1 class="text-[88px] font-display leading-[0.82] sm:text-[120px] lg:text-[144px]">
				TSCH<br />ALPS
			</h1>
			<p class="max-w-sm text-lg leading-snug sm:text-xl">
				Eine Woche über die Alpen. Keine Dörfer, alles Essen im Rucksack, die Nächte im Heu.
			</p>
		</div>
	</section>

	<main class="flex flex-1 items-center justify-center px-4 py-12 sm:px-6">
		<div class="flex w-full max-w-100 flex-col gap-7">
			{#if step === 'email'}
				<div class="flex flex-col gap-2.5">
					<span class="eyebrow">Schritt 1 von 2</span>
					<h2 class="text-[44px] font-display leading-none">Anmelden</h2>
					<p class="text-ink-soft">
						Gib deine E-Mail-Adresse ein. Wir schicken dir einen 6-stelligen Code.
					</p>
				</div>
				<form method="POST" action="?/sendCode" use:enhance={submit} class="flex flex-col gap-5">
					<input type="hidden" name="redirectTo" value={redirectTo} />
					<label for="email">
						<span class="label">E-Mail-Adresse</span>
						<!-- svelte-ignore a11y_autofocus -->
						<input
							id="email"
							type="email"
							name="email"
							value={email}
							required
							autofocus
							autocomplete="email"
							placeholder="name@beispiel.ch"
							class="field h-13 text-lg"
						/>
					</label>
					{#if form?.error}<p class="notice notice-error" role="alert">{form.error}</p>{/if}
					<button disabled={pending} class="btn btn-primary h-13 text-[17px]">
						{pending ? 'Wird gesendet …' : 'Code senden'}
					</button>
				</form>
			{:else}
				<div class="flex flex-col gap-2.5">
					<span class="eyebrow">Schritt 2 von 2</span>
					<h2 class="text-[44px] font-display leading-none">Code eingeben</h2>
					<p class="text-ink-soft">
						Falls <strong class="text-ink">{email}</strong> als Mitglied eingetragen ist, haben wir dir
						einen 6-stelligen Code geschickt. Du kannst die Mail auch auf dem Handy öffnen.
					</p>
				</div>
				<form method="POST" action="?/verify" use:enhance={submit} class="flex flex-col gap-5">
					<input type="hidden" name="email" value={email} />
					<input type="hidden" name="redirectTo" value={redirectTo} />
					<label for="otp">
						<span class="label">Anmeldecode</span>
						<!-- svelte-ignore a11y_autofocus -->
						<input
							id="otp"
							name="otp"
							inputmode="numeric"
							autocomplete="one-time-code"
							pattern="[0-9 ]*"
							maxlength="7"
							required
							autofocus
							placeholder="000000"
							class="field h-16 text-center font-mono text-[28px] font-medium tracking-[0.5em] placeholder:text-line-strong"
						/>
					</label>
					{#if form?.error}<p class="notice notice-error" role="alert">{form.error}</p>{/if}
					<button disabled={pending} class="btn btn-primary h-13 text-[17px]">
						{pending ? 'Wird geprüft …' : 'Anmelden'}
					</button>
				</form>
				<div class="flex flex-wrap items-center justify-between gap-2 text-[15px]">
					<a href={resolve('/login')} class="py-1.5 underline">Andere E-Mail-Adresse</a>
					<form method="POST" action="?/sendCode" use:enhance={submit}>
						<input type="hidden" name="email" value={email} />
						<input type="hidden" name="redirectTo" value={redirectTo} />
						<button class="cursor-pointer py-1.5 underline hover:text-trail">
							Code erneut senden
						</button>
					</form>
				</div>
			{/if}

			<p class="border-t border-line pt-5 text-sm text-muted">
				Nur für Mitglieder. Neue Mitglieder werden von den Admins per E-Mail eingeladen.
			</p>
		</div>
	</main>
</div>
