<script lang="ts">
	import { SEASON_LABELS } from '#lib/labels.ts';

	type Values = {
		title?: string;
		year?: string | number;
		season?: string | null;
		startDate?: string | null;
		endDate?: string | null;
		summaryMd?: string | null;
	};

	let { values }: { values: Values } = $props();

	const input =
		'w-full rounded-lg border-stone-300 focus:border-emerald-600 focus:ring-emerald-600';
	const label = 'mb-1 block text-sm font-medium text-stone-700';
</script>

<div class="grid gap-4 sm:grid-cols-6">
	<label class="sm:col-span-6">
		<span class={label}>Titel</span>
		<input
			name="title"
			required
			maxlength="120"
			value={values.title ?? ''}
			placeholder="z. B. Vom Gotthard ins Val Bregaglia"
			class={input}
		/>
	</label>
	<label class="sm:col-span-2">
		<span class={label}>Jahr</span>
		<input name="year" type="number" required min="1970" value={values.year ?? ''} class={input} />
	</label>
	<label class="sm:col-span-4">
		<span class={label}>Jahreszeit</span>
		<select name="season" value={values.season ?? ''} class={input}>
			<option value="">–</option>
			{#each Object.entries(SEASON_LABELS) as [value, text] (value)}
				<option {value}>{text}</option>
			{/each}
		</select>
	</label>
	<label class="sm:col-span-3">
		<span class={label}>Von</span>
		<input name="startDate" type="date" value={values.startDate ?? ''} class={input} />
	</label>
	<label class="sm:col-span-3">
		<span class={label}>Bis</span>
		<input name="endDate" type="date" value={values.endDate ?? ''} class={input} />
	</label>
	<p class="-mt-2 text-xs text-stone-500 sm:col-span-6">
		Leer lassen, wenn die GPX-Dateien Zeitstempel haben: Die Daten werden dann übernommen.
	</p>
	<label class="sm:col-span-6">
		<span class={label}>Bericht / Zusammenfassung</span>
		<textarea name="summaryMd" rows="5" class={input}>{values.summaryMd ?? ''}</textarea>
	</label>
</div>
