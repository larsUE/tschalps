<script lang="ts">
	import { TRAIL_CATEGORIES, TRAIL_COLORS, TRAIL_LABELS, type TrailMix } from '#lib/labels.ts';

	let {
		mix,
		legend = false,
		class: className = ''
	}: { mix: TrailMix; legend?: boolean; class?: string } = $props();

	const known = $derived(TRAIL_CATEGORIES.reduce((sum, c) => sum + mix[c], 0));
	const parts = $derived(
		TRAIL_CATEGORIES.map((c) => ({ c, share: known ? mix[c] / known : 0 })).filter(
			(p) => p.share > 0
		)
	);
	const pct = (share: number) => (share > 0 && share < 0.01 ? '<1' : Math.round(share * 100));
	const summary = $derived(parts.map((p) => `${TRAIL_LABELS[p.c]} ${pct(p.share)} %`).join(', '));
</script>

{#if known > 0}
	<div class="flex flex-col gap-2 {className}">
		<div
			class="flex h-2.5 w-full overflow-hidden rounded-full bg-line"
			role="img"
			aria-label="Wegtypen: {summary}"
			title={summary}
		>
			{#each parts as p (p.c)}
				<span
					class="h-full {p.c === 'weglos' ? 'pathless' : ''}"
					style:width="{p.share * 100}%"
					style:background-color={TRAIL_COLORS[p.c]}
				></span>
			{/each}
		</div>
		{#if legend}
			<ul class="flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
				{#each parts as p (p.c)}
					<li class="flex items-center gap-1.5">
						<span
							class="size-2.5 rounded-full {p.c === 'weglos' ? 'pathless' : ''}"
							style:background-color={TRAIL_COLORS[p.c]}
						></span>
						{TRAIL_LABELS[p.c]}
						<span class="nums text-muted">{pct(p.share)} %</span>
					</li>
				{/each}
			</ul>
			{#if mix.unbekannt}
				<p class="text-[13px] text-muted">
					{(mix.unbekannt / 1000).toFixed(1)} km ausserhalb der Schweiz nicht erfasst.
				</p>
			{/if}
		{/if}
	</div>
{/if}

<style>
	/* Cross-country: hatched, so it reads as "no path" rather than another trail colour. */
	.pathless {
		background-image: repeating-linear-gradient(
			135deg,
			transparent 0 2px,
			rgb(0 0 0 / 0.18) 2px 3px
		);
	}
</style>
