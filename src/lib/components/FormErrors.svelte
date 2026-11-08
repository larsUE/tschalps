<script lang="ts">
	let { errors }: { errors?: string[] } = $props();
</script>

{#if errors?.length}
	<ul class="notice notice-error space-y-1" role="alert">
		{#each errors as error, i (i)}
			<li>{error}</li>
		{/each}
	</ul>
{/if}
