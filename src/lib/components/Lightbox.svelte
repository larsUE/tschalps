<script lang="ts" module>
	export type LightboxPhoto = { id: string; caption: string | null; meta?: string };
</script>

<script lang="ts">
	import { resolve } from '$app/paths';

	/** Full-size photo viewer. `index` is the open photo, null when closed. */
	let { photos, index = $bindable() }: { photos: LightboxPhoto[]; index: number | null } = $props();

	let dialog: HTMLDialogElement;
	const current = $derived(index === null ? null : (photos[index] ?? null));

	$effect(() => {
		if (current && !dialog.open) dialog.showModal();
		if (!current && dialog.open) dialog.close();
	});

	const step = (delta: number) => {
		if (index === null || photos.length < 2) return;
		index = (index + delta + photos.length) % photos.length;
	};

	function keydown(e: KeyboardEvent) {
		if (e.key === 'ArrowRight') step(1);
		if (e.key === 'ArrowLeft') step(-1);
	}

	let touchX: number | null = null;
</script>

<dialog
	bind:this={dialog}
	onclose={() => (index = null)}
	onkeydown={keydown}
	onclick={(e) => {
		if (e.target === dialog) dialog.close();
	}}
	aria-label="Foto"
	class="m-0 h-dvh max-h-none w-screen max-w-none bg-ink/95 p-0 text-white backdrop:bg-black/60"
>
	{#if current}
		<div
			class="flex h-full flex-col"
			role="group"
			aria-label="Fotoansicht, wischen zum Blättern"
			ontouchstart={(e) => (touchX = e.touches[0].clientX)}
			ontouchend={(e) => {
				if (touchX === null) return;
				const dx = e.changedTouches[0].clientX - touchX;
				if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1);
				touchX = null;
			}}
		>
			<div class="flex items-center justify-between gap-3 p-3">
				<span class="nums text-sm text-header-muted">
					{(index ?? 0) + 1} / {photos.length}
				</span>
				<button
					type="button"
					onclick={() => dialog.close()}
					aria-label="Schliessen"
					class="grid size-11 cursor-pointer place-items-center rounded-ui hover:bg-white/10"
				>
					<svg
						class="size-5"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						aria-hidden="true"><path d="M6 6 L18 18 M18 6 L6 18" /></svg
					>
				</button>
			</div>
			<div class="relative flex min-h-0 flex-1 items-center justify-center px-2 sm:px-16">
				<img
					src={resolve('/api/fotos/[id]/[size]', { id: current.id, size: 'gross' })}
					alt={current.caption ?? 'Foto'}
					class="max-h-full max-w-full object-contain"
				/>
				{#if photos.length > 1}
					<button
						type="button"
						onclick={() => step(-1)}
						aria-label="Vorheriges Foto"
						class="absolute top-1/2 left-2 hidden size-12 -translate-y-1/2 cursor-pointer place-items-center rounded-full bg-black/40 hover:bg-black/60 sm:grid"
					>
						<svg
							class="size-5"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							aria-hidden="true"><path d="M15 5 L8 12 L15 19" /></svg
						>
					</button>
					<button
						type="button"
						onclick={() => step(1)}
						aria-label="Nächstes Foto"
						class="absolute top-1/2 right-2 hidden size-12 -translate-y-1/2 cursor-pointer place-items-center rounded-full bg-black/40 hover:bg-black/60 sm:grid"
					>
						<svg
							class="size-5"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							aria-hidden="true"><path d="M9 5 L16 12 L9 19" /></svg
						>
					</button>
				{/if}
			</div>
			<div class="min-h-16 p-4 text-center">
				{#if current.caption}<p class="text-[15px]">{current.caption}</p>{/if}
				{#if current.meta}<p class="mt-1 nums text-xs text-header-muted">{current.meta}</p>{/if}
			</div>
		</div>
	{/if}
</dialog>
