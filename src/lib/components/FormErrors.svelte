<script lang="ts">
	let { errors }: { errors?: string[] } = $props();
</script>

{#if errors?.length}
	<ul class="space-y-1 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
		{#each errors as error, i (i)}
			<li>{error}</li>
		{/each}
	</ul>
{/if}
