<script lang="ts" module>
	export type StagePoint = {
		lng: number;
		lat: number;
		kind: 'start' | 'night' | 'end';
		/** Night number, shown inside the marker. */
		label?: string;
	};
</script>

<script lang="ts">
	import type { Marker } from 'maplibre-gl';
	import { getMapContext } from './context.ts';

	/**
	 * Start, numbered nights and finish of a tour as HTML markers
	 * (the style has no glyphs, so text can't be drawn as a map layer).
	 */
	let { points }: { points: StagePoint[] } = $props();

	const map = getMapContext()()!;

	$effect(() => {
		const current = points;
		let markers: Marker[] = [];
		let cancelled = false;

		import('maplibre-gl').then(({ Marker }) => {
			if (cancelled) return;
			markers = current.map((p) => {
				const el = document.createElement('div');
				el.className = `stage-marker stage-marker-${p.kind}`;
				el.textContent = p.label ?? '';
				el.setAttribute('aria-hidden', 'true');
				return new Marker({ element: el }).setLngLat([p.lng, p.lat]).addTo(map);
			});
		});

		return () => {
			cancelled = true;
			for (const m of markers) m.remove();
		};
	});
</script>
