<script lang="ts" module>
	export type GalleryPhoto = {
		id: string;
		caption: string | null;
		meta?: string;
		/** Shows caption editing and delete for this photo (posts to ?/captionPhoto and ?/deletePhoto). */
		manage?: boolean;
	};
</script>

<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import Lightbox from './Lightbox.svelte';

	let { photos, open = $bindable(null) }: { photos: GalleryPhoto[]; open?: number | null } =
		$props();
</script>

{#if photos.length}
	<ul class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
		{#each photos as p, i (p.id)}
			<li class="flex flex-col gap-1.5">
				<button
					type="button"
					onclick={() => (open = i)}
					class="group block aspect-[4/3] cursor-zoom-in overflow-hidden rounded-card bg-map"
					aria-label={p.caption ? `Foto: ${p.caption}` : `Foto ${i + 1} öffnen`}
				>
					<img
						src={resolve('/api/fotos/[id]/[size]', { id: p.id, size: 'klein' })}
						alt={p.caption ?? ''}
						loading="lazy"
						class="size-full object-cover transition group-hover:scale-[1.03]"
					/>
				</button>
				{#if p.manage}
					<form method="POST" action="?/captionPhoto" use:enhance class="flex gap-1">
						<input type="hidden" name="id" value={p.id} />
						<input
							name="caption"
							value={p.caption ?? ''}
							maxlength="300"
							placeholder="Bildlegende"
							aria-label="Bildlegende"
							class="field min-h-9 min-w-0 flex-1 py-1 text-sm"
						/>
						<button class="btn btn-outline btn-sm" aria-label="Bildlegende speichern">OK</button>
					</form>
					<form
						method="POST"
						action="?/deletePhoto"
						use:enhance
						onsubmit={(e) => {
							if (!confirm('Foto löschen?')) e.preventDefault();
						}}
					>
						<input type="hidden" name="id" value={p.id} />
						<button class="cursor-pointer text-xs text-muted underline hover:text-danger">
							Löschen
						</button>
					</form>
				{:else if p.caption}
					<p class="text-sm text-ink-soft">{p.caption}</p>
				{/if}
			</li>
		{/each}
	</ul>
{/if}

<Lightbox {photos} bind:index={open} />
