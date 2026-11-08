<script lang="ts">
	import { formatKm, formatM, type ProfilePoint } from '#lib/geo.ts';

	type Props = {
		points: ProfilePoint[];
		color?: string;
		/** Day boundaries: distance (m) where each day after the first starts. */
		dayStarts?: number[];
		height?: number;
		onhover?: (point: ProfilePoint | null) => void;
	};

	let { points, color = '#be2a1f', dayStarts = [], height = 180, onhover }: Props = $props();

	const HEIGHT = $derived(height);
	const PAD = { top: 22, right: 8, bottom: 24, left: 52 };

	let width = $state(0);
	let hovered = $state<ProfilePoint | null>(null);

	const extent = $derived.by(() => {
		let min = Infinity;
		let max = -Infinity;
		for (const p of points) {
			min = Math.min(min, p.ele);
			max = Math.max(max, p.ele);
		}
		// Round to 100 m and keep at least 200 m of range, so flat days don't look dramatic.
		const lo = Math.floor(min / 100) * 100;
		const hi = Math.max(Math.ceil(max / 100) * 100, lo + 200);
		return { lo, hi, total: points.at(-1)?.d ?? 0 };
	});

	const innerW = $derived(Math.max(0, width - PAD.left - PAD.right));
	const innerH = $derived(HEIGHT - PAD.top - PAD.bottom);
	const x = (d: number) => PAD.left + (extent.total ? (d / extent.total) * innerW : 0);
	const y = (ele: number) =>
		PAD.top + innerH - ((ele - extent.lo) / (extent.hi - extent.lo)) * innerH;

	const line = $derived(
		points.map((p, i) => `${i ? 'L' : 'M'}${x(p.d).toFixed(1)},${y(p.ele).toFixed(1)}`).join('')
	);
	const area = $derived(
		points.length
			? `${line}L${x(extent.total).toFixed(1)},${PAD.top + innerH}L${PAD.left},${PAD.top + innerH}Z`
			: ''
	);

	const yTicks = $derived.by(() => {
		const range = extent.hi - extent.lo;
		const step = [100, 200, 250, 500, 1000].find((s) => range / s <= 4) ?? 1000;
		const ticks = [];
		for (let v = Math.ceil(extent.lo / step) * step; v <= extent.hi; v += step) ticks.push(v);
		return ticks;
	});

	const xTicks = $derived.by(() => {
		const km = extent.total / 1000;
		const step = [1, 2, 5, 10, 20, 50].find((s) => km / s <= 6) ?? 50;
		const ticks = [];
		for (let v = 0; v <= km; v += step) ticks.push(v);
		return ticks;
	});

	function pointAt(clientX: number, rect: DOMRect) {
		const d = ((clientX - rect.left - PAD.left) / innerW) * extent.total;
		// Binary search for the nearest sample by distance.
		let lo = 0;
		let hi = points.length - 1;
		while (lo < hi) {
			const mid = (lo + hi) >> 1;
			if (points[mid].d < d) lo = mid + 1;
			else hi = mid;
		}
		const prev = points[Math.max(0, lo - 1)];
		return Math.abs(prev.d - d) < Math.abs(points[lo].d - d) ? prev : points[lo];
	}

	function move(e: PointerEvent) {
		if (!points.length || !innerW) return;
		hovered = pointAt(e.clientX, (e.currentTarget as SVGElement).getBoundingClientRect());
		onhover?.(hovered);
	}

	function leave() {
		hovered = null;
		onhover?.(null);
	}
</script>

<div bind:clientWidth={width} class="relative select-none">
	{#if points.length < 2}
		<p class="py-6 text-center text-sm text-muted">Keine Höhendaten vorhanden.</p>
	{:else if width}
		<svg
			{width}
			height={HEIGHT}
			role="img"
			aria-label="Höhenprofil"
			class="touch-none overflow-visible"
			onpointermove={move}
			onpointerdown={move}
			onpointerleave={leave}
		>
			{#each yTicks as tick (tick)}
				<line
					x1={PAD.left}
					x2={width - PAD.right}
					y1={y(tick)}
					y2={y(tick)}
					class="stroke-line-strong"
					stroke-dasharray="2 3"
				/>
				<text
					x={PAD.left - 8}
					y={y(tick)}
					dy="0.32em"
					text-anchor="end"
					class="fill-muted font-mono text-[11px]"
				>
					{tick} m
				</text>
			{/each}
			{#each xTicks as tick (tick)}
				<text
					x={x(tick * 1000)}
					y={HEIGHT - 6}
					text-anchor="middle"
					class="fill-muted font-mono text-[11px]"
				>
					{tick} km
				</text>
			{/each}
			<path d={area} fill={color} fill-opacity="0.18" />
			<path d={line} fill="none" stroke={color} stroke-width="2.5" stroke-linejoin="round" />
			<line
				x1={PAD.left}
				x2={width - PAD.right}
				y1={PAD.top + innerH}
				y2={PAD.top + innerH}
				class="stroke-ink"
				stroke-width="1.5"
			/>
			{#each dayStarts as d, i (i)}
				<line
					x1={x(d)}
					x2={x(d)}
					y1={PAD.top}
					y2={PAD.top + innerH}
					class="stroke-ink"
					stroke-dasharray="3 3"
				/>
			{/each}
			{#each dayStarts.length ? [0, ...dayStarts] : [] as d, i (i)}
				{@const end = dayStarts[i] ?? extent.total}
				{#if x(end) - x(d) > 34}
					<text
						x={(x(d) + x(end)) / 2}
						y={PAD.top - 8}
						text-anchor="middle"
						class="fill-muted font-mono text-[11px]"
					>
						Tag {i + 1}
					</text>
				{/if}
			{/each}
			{#if hovered}
				<line
					x1={x(hovered.d)}
					x2={x(hovered.d)}
					y1={PAD.top}
					y2={PAD.top + innerH}
					class="stroke-ink"
					stroke-width="1.5"
				/>
				<circle
					cx={x(hovered.d)}
					cy={y(hovered.ele)}
					r="5"
					fill="#17201b"
					stroke="white"
					stroke-width="2"
				/>
			{/if}
		</svg>
		{#if hovered}
			<div
				class="pointer-events-none absolute top-0 rounded-ui bg-ink px-2.5 py-1 font-mono text-xs whitespace-nowrap text-white"
				style:left="{Math.min(Math.max(x(hovered.d), 60), width - 60)}px"
				style:transform="translateX(-50%)"
			>
				{formatKm(hovered.d)} · {formatM(hovered.ele)} ü. M.
			</div>
		{/if}
	{/if}
</div>
