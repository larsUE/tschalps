<script lang="ts">
	let { required = false }: { required?: boolean } = $props();
	let names = $state<string[]>([]);
</script>

<label
	class="block cursor-pointer rounded-card border-[1.5px] border-dashed border-[#8c928d] bg-paper p-6 text-center focus-within:border-ink hover:border-ink"
>
	<svg
		class="mx-auto mb-2 size-6 text-ink-soft"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		aria-hidden="true"><path d="M12 20 V9 M7 14 L12 9 L17 14 M5 4 H19" /></svg
	>
	<span class="block font-semibold">GPX-Dateien auswählen</span>
	<span class="mt-1 block text-sm text-muted">
		Eine Datei pro Tag oder eine Datei für die ganze Woche. Mit Zeitstempeln werden die Tage
		automatisch erkannt.
	</span>
	<input
		type="file"
		name="gpx"
		accept=".gpx,application/gpx+xml"
		multiple
		{required}
		class="sr-only"
		onchange={(e) => (names = Array.from(e.currentTarget.files ?? []).map((f) => f.name))}
	/>
	{#if names.length}
		<span class="mt-3 block nums text-sm text-ok">{names.join(', ')}</span>
	{/if}
</label>
