<script lang="ts">
	import { getMapContext } from './context.ts';

	type Bounds = [number, number, number, number];

	/** Moves the map to `bounds` whenever they change (minLng, minLat, maxLng, maxLat). */
	let { bounds, animate = true }: { bounds: Bounds | null; animate?: boolean } = $props();

	const map = getMapContext()()!;
	let first = true;

	$effect(() => {
		if (!bounds) return;
		map.fitBounds(
			[
				[bounds[0], bounds[1]],
				[bounds[2], bounds[3]]
			],
			{ padding: 40, maxZoom: 15, duration: animate && !first ? 600 : 0 }
		);
		first = false;
	});
</script>
