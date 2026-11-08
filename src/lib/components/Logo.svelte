<script lang="ts">
	/** Brand mark (red square with a white peak) plus the condensed TSCHALPS wordmark. */
	let { size = 24, wordmark = true }: { size?: number; wordmark?: boolean } = $props();
</script>

<span class="inline-flex items-center gap-2.5">
	<svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" class="shrink-0">
		<rect width="24" height="24" rx="3" fill="#be2a1f" />
		<path
			d="M5 17 L12 7 L19 17"
			fill="none"
			stroke="#fff"
			stroke-width="2.4"
			stroke-linejoin="round"
		/>
	</svg>
	{#if wordmark}
		<span class="text-[22px] font-extrabold tracking-[0.04em]" style:font-stretch="72%">
			TSCHALPS
		</span>
	{/if}
</span>
