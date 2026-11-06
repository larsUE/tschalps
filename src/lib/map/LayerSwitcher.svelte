<script lang="ts">
	import { BASEMAPS, OVERLAYS, type BasemapId, type OverlayId } from './basemaps.ts';

	type Props = { basemap: BasemapId; overlays: OverlayId[] };

	let { basemap = $bindable(), overlays = $bindable() }: Props = $props();

	let open = $state(false);

	function toggleOverlay(id: OverlayId, on: boolean) {
		overlays = on ? [...overlays, id] : overlays.filter((o) => o !== id);
	}
</script>

<div class="absolute top-2.5 left-2.5 z-10 text-sm">
	<button
		type="button"
		onclick={() => (open = !open)}
		aria-expanded={open}
		aria-controls="layer-switcher"
		class="flex items-center gap-2 rounded-md bg-white px-3 py-1.5 font-medium shadow ring-1 ring-black/10 hover:bg-stone-50"
	>
		<svg viewBox="0 0 20 20" fill="currentColor" class="size-4 text-stone-600" aria-hidden="true">
			<path
				d="M10 2 1.5 6.5 10 11l8.5-4.5L10 2Zm-6.4 7.6L1.5 10.7 10 15.2l8.5-4.5-2.1-1.1L10 13 3.6 9.6Zm0 4.2-2.1 1.1L10 19.4l8.5-4.5-2.1-1.1L10 17.2l-6.4-3.4Z"
			/>
		</svg>
		Karte
	</button>

	{#if open}
		<div
			id="layer-switcher"
			class="mt-1.5 w-48 space-y-3 rounded-md bg-white p-3 shadow-lg ring-1 ring-black/10"
		>
			<fieldset class="space-y-1.5">
				<legend class="mb-1 text-xs font-semibold tracking-wide text-stone-500 uppercase">
					Hintergrund
				</legend>
				{#each BASEMAPS as b (b.id)}
					<label class="flex cursor-pointer items-center gap-2">
						<input
							type="radio"
							name="basemap"
							value={b.id}
							bind:group={basemap}
							class="text-emerald-700 focus:ring-emerald-600"
						/>
						{b.label}
					</label>
				{/each}
			</fieldset>
			<fieldset class="space-y-1.5 border-t border-stone-200 pt-3">
				<legend class="sr-only">Überlagerungen</legend>
				{#each OVERLAYS as o (o.id)}
					<label class="flex cursor-pointer items-center gap-2">
						<input
							type="checkbox"
							checked={overlays.includes(o.id)}
							onchange={(e) => toggleOverlay(o.id, e.currentTarget.checked)}
							class="rounded text-emerald-700 focus:ring-emerald-600"
						/>
						{o.label}
					</label>
				{/each}
			</fieldset>
		</div>
	{/if}
</div>
