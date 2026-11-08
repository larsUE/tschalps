<script lang="ts">
	import { invalidateAll } from '$app/navigation';

	type Props = {
		/** POST endpoint taking one file per request (field `file`). */
		endpoint: string;
		/** How many more photos are allowed (undefined: no limit). */
		remaining?: number;
		label?: string;
	};

	let { endpoint, remaining, label = 'Fotos hinzufügen' }: Props = $props();

	let progress = $state<{ done: number; total: number } | null>(null);
	let errors = $state<string[]>([]);

	async function upload(files: File[]) {
		errors = [];
		let list = files;
		if (remaining !== undefined && list.length > remaining) {
			errors.push(
				`Nur noch ${remaining} ${remaining === 1 ? 'Foto' : 'Fotos'} möglich, die übrigen wurden ausgelassen.`
			);
			list = list.slice(0, remaining);
		}
		progress = { done: 0, total: list.length };
		// One file per request keeps each upload small and shows progress.
		for (const file of list) {
			const body = new FormData();
			body.append('file', file);
			try {
				const res = await fetch(endpoint, { method: 'POST', body });
				if (!res.ok) {
					const data = await res.json().catch(() => null);
					errors.push(data?.error ?? data?.message ?? `${file.name}: Hochladen fehlgeschlagen.`);
				}
			} catch {
				errors.push(`${file.name}: keine Verbindung.`);
			}
			progress.done++;
		}
		progress = null;
		await invalidateAll();
	}
</script>

<div class="flex flex-col gap-2">
	{#if remaining === 0}
		<p class="text-sm text-muted">Die maximale Anzahl Fotos ist erreicht.</p>
	{:else}
		<label
			class="flex cursor-pointer items-center justify-center gap-2 rounded-card border-[1.5px] border-dashed border-[#8c928d] bg-paper p-5 text-center focus-within:border-ink hover:border-ink {progress
				? 'pointer-events-none opacity-70'
				: ''}"
		>
			<svg
				class="size-5 text-ink-soft"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				aria-hidden="true"
				><path d="M4 7 H8 L10 4 H14 L16 7 H20 V19 H4 Z" /><circle cx="12" cy="13" r="3.5" /></svg
			>
			<span class="font-semibold">
				{#if progress}
					Wird hochgeladen … {progress.done} von {progress.total}
				{:else}
					{label}{remaining !== undefined ? ` (noch ${remaining})` : ''}
				{/if}
			</span>
			<input
				type="file"
				accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
				multiple
				class="sr-only"
				disabled={!!progress}
				onchange={(e) => {
					const files = Array.from(e.currentTarget.files ?? []);
					e.currentTarget.value = '';
					if (files.length) upload(files);
				}}
			/>
		</label>
		<p class="text-xs text-muted">
			Fotos werden verkleinert. Ort und Zeit werden aus dem Foto übernommen, Kameradaten entfernt.
		</p>
	{/if}
	{#if errors.length}
		<ul class="notice notice-error space-y-1" role="alert">
			{#each errors as e, i (i)}<li>{e}</li>{/each}
		</ul>
	{/if}
</div>
