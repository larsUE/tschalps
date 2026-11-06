<script lang="ts">
	let { required = false }: { required?: boolean } = $props();
	let names = $state<string[]>([]);
</script>

<label
	class="block cursor-pointer rounded-xl border-2 border-dashed border-stone-300 p-6 text-center hover:border-emerald-600"
>
	<span class="block font-medium text-stone-800">GPX-Dateien auswählen</span>
	<span class="mt-1 block text-sm text-stone-500">
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
		<span class="mt-3 block text-sm text-emerald-800">{names.join(', ')}</span>
	{/if}
</label>
