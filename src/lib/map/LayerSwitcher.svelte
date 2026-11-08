<script lang="ts">
	import { BASEMAPS, OVERLAYS, type BasemapId, type OverlayId } from './basemaps.ts';

	type Props = { basemap: BasemapId; overlays: OverlayId[] };

	let { basemap = $bindable(), overlays = $bindable() }: Props = $props();

	function toggleOverlay(id: OverlayId) {
		overlays = overlays.includes(id) ? overlays.filter((o) => o !== id) : [...overlays, id];
	}
</script>

<!-- Base map as a segmented control, overlays as toggle chips beside it. -->
<div class="absolute top-3 left-3 z-10 flex max-w-[calc(100%-4.5rem)] flex-wrap gap-2">
	<div role="group" aria-label="Kartenhintergrund" class="segmented shadow-float">
		{#each BASEMAPS as b (b.id)}
			<button type="button" aria-pressed={basemap === b.id} onclick={() => (basemap = b.id)}>
				{b.label}
			</button>
		{/each}
	</div>
	{#each OVERLAYS as o (o.id)}
		<button
			type="button"
			aria-pressed={overlays.includes(o.id)}
			onclick={() => toggleOverlay(o.id)}
			class="chip min-h-11 border-0 shadow-float"
		>
			<svg
				viewBox="0 0 24 24"
				class="size-4"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				aria-hidden="true"><path d="M4 20 L9 13 L13 16 L20 6" stroke-dasharray="3 2" /></svg
			>
			{o.label}
		</button>
	{/each}
</div>
