import { describe, expect, it } from 'vitest';
import { locateOnRoute, pointAlongRoute, type StageGeometry } from './geo.ts';

// Two segments going east along 46.5° N with a gap between them.
const route: StageGeometry = {
	type: 'MultiLineString',
	coordinates: [
		[
			[8.0, 46.5],
			[8.01, 46.5]
		],
		[
			[8.05, 46.5],
			[8.06, 46.5]
		]
	]
};
const segmentM = 765; // 0.01° of longitude at 46.5° N, rounded

describe('locateOnRoute', () => {
	it('measures distance along the route and off it', () => {
		const r = locateOnRoute(route, { lng: 8.005, lat: 46.501 });
		expect(r.alongM).toBeCloseTo(segmentM / 2, -1);
		expect(r.offM).toBeCloseTo(111, 0);
	});

	it('skips the gap between segments', () => {
		const r = locateOnRoute(route, { lng: 8.055, lat: 46.5 });
		expect(r.alongM).toBeCloseTo(segmentM * 1.5, -1);
		expect(r.offM).toBeLessThan(1);
	});

	it('clamps to the nearest end', () => {
		const r = locateOnRoute(route, { lng: 7.99, lat: 46.5 });
		expect(r.alongM).toBe(0);
		expect(r.offM).toBeCloseTo(segmentM, -1);
	});
});

describe('pointAlongRoute', () => {
	it('finds the middle across segments', () => {
		const p = pointAlongRoute(route, 0.5)!;
		expect(p.lng).toBeCloseTo(8.01, 4);
	});

	it('returns null for an empty route', () => {
		expect(pointAlongRoute({ type: 'MultiLineString', coordinates: [] }, 0.5)).toBeNull();
	});
});
