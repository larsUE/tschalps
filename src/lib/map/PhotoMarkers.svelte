<script lang="ts">
	import type { Marker } from 'maplibre-gl';
	import { resolve } from '$app/paths';
	import { getMapContext } from './context.ts';

	type Photo = { id: string; lat: number; lng: number; caption: string | null };

	/** Small photo thumbnails at the places they were taken. */
	let { photos, onopen }: { photos: Photo[]; onopen?: (id: string) => void } = $props();

	const map = getMapContext()()!;

	$effect(() => {
		const current = photos;
		let markers: Marker[] = [];
		let cancelled = false;

		import('maplibre-gl').then(({ Marker }) => {
			if (cancelled) return;
			markers = current.map((p) => {
				const el = document.createElement('button');
				el.type = 'button';
				el.className = 'photo-marker';
				el.setAttribute('aria-label', p.caption ? `Foto: ${p.caption}` : 'Foto öffnen');
				const img = document.createElement('img');
				img.src = resolve('/api/fotos/[id]/[size]', { id: p.id, size: 'klein' });
				img.alt = '';
				el.append(img);
				el.addEventListener('click', (e) => {
					e.stopPropagation();
					onopen?.(p.id);
				});
				return new Marker({ element: el, anchor: 'bottom' }).setLngLat([p.lng, p.lat]).addTo(map);
			});
		});

		return () => {
			cancelled = true;
			for (const m of markers) m.remove();
		};
	});
</script>
