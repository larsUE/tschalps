import { describe, expect, it } from 'vitest';
import { distance, routeStats, simplify, type TrackPoint } from '#lib/geo.ts';
import { GpxError, parseGpx, splitIntoStages, stageMetrics, toGpx } from './gpx.ts';

const pt = (lat: number, lon: number, ele?: number, time?: string) =>
	`<trkpt lat="${lat}" lon="${lon}">${ele !== undefined ? `<ele>${ele}</ele>` : ''}${time ? `<time>${time}</time>` : ''}</trkpt>`;

const gpx = (body: string) =>
	`<?xml version="1.0"?><gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">${body}</gpx>`;

const trk = (name: string, ...segments: string[][]) =>
	`<trk><name>${name}</name>${segments.map((s) => `<trkseg>${s.join('')}</trkseg>`).join('')}</trk>`;

describe('parseGpx', () => {
	it('reads tracks with elevation and time, ignoring waypoints', () => {
		const file = parseGpx(
			gpx(
				`<wpt lat="46" lon="8"><name>Hütte</name></wpt>` +
					trk('Tag 1', [
						pt(46.5, 8.0, 1500, '2024-07-08T06:00:00Z'),
						pt(46.51, 8.0, 1600, '2024-07-08T07:00:00Z')
					])
			)
		);
		expect(file.tracks).toHaveLength(1);
		expect(file.tracks[0].name).toBe('Tag 1');
		expect(file.tracks[0].segments[0][1]).toEqual({
			lat: 46.51,
			lng: 8.0,
			ele: 1600,
			time: Date.parse('2024-07-08T07:00:00Z')
		});
	});

	it('reads routes (rte) and prefixed tags', () => {
		const file = parseGpx(
			`<gpx:gpx xmlns:gpx="http://www.topografix.com/GPX/1/1"><gpx:rte><gpx:rtept lat="46" lon="8"/><gpx:rtept lat="46.1" lon="8.1"/></gpx:rte></gpx:gpx>`
		);
		expect(file.tracks[0].segments[0]).toHaveLength(2);
	});

	it('rejects files without a route', () => {
		expect(() => parseGpx(gpx('<wpt lat="46" lon="8"/>'))).toThrow(GpxError);
		expect(() => parseGpx('<html></html>')).toThrow(GpxError);
		expect(() => parseGpx('not xml at all <')).toThrow(GpxError);
	});
});

describe('splitIntoStages', () => {
	const day = (date: string, lat: number) => [
		pt(lat, 8, 1000, `${date}T06:00:00Z`),
		pt(lat + 0.01, 8, 1100, `${date}T08:00:00Z`)
	];

	it('keeps one file per day as-is', () => {
		const stages = splitIntoStages([
			{ fileName: 'tag2.gpx', gpx: parseGpx(gpx(trk('B', day('2024-07-09', 46.6)))) },
			{ fileName: 'tag1.gpx', gpx: parseGpx(gpx(trk('A', day('2024-07-08', 46.5)))) }
		]);
		expect(stages.map((s) => [s.date, s.title, s.wholeFileIndex])).toEqual([
			['2024-07-08', 'A', 1],
			['2024-07-09', 'B', 0]
		]);
	});

	it('splits a whole week in one track by local (Swiss) date', () => {
		// 23:30 UTC on 8 July is already 9 July in Zurich (UTC+2 in summer).
		const week = [
			pt(46.5, 8, 1000, '2024-07-08T10:00:00Z'),
			pt(46.51, 8, 1000, '2024-07-08T12:00:00Z'),
			pt(46.52, 8, 1000, '2024-07-08T23:30:00Z'),
			pt(46.53, 8, 1000, '2024-07-09T08:00:00Z')
		];
		const stages = splitIntoStages([
			{ fileName: 'woche.gpx', gpx: parseGpx(gpx(trk('Woche', week))) }
		]);
		expect(stages.map((s) => s.date)).toEqual(['2024-07-08', '2024-07-09']);
		expect(stages.every((s) => s.wholeFileIndex === undefined)).toBe(true);
	});

	it('merges several recordings of the same day into one stage', () => {
		const stages = splitIntoStages([
			{ fileName: 'morgen.gpx', gpx: parseGpx(gpx(trk('M', day('2024-07-08', 46.5)))) },
			{ fileName: 'nachmittag.gpx', gpx: parseGpx(gpx(trk('N', day('2024-07-08', 46.6)))) }
		]);
		expect(stages).toHaveLength(1);
		expect(stages[0].segments).toHaveLength(2);
		expect(stages[0].wholeFileIndex).toBeUndefined();
	});

	it('puts undated tracks after dated ones, in natural file-name order', () => {
		const undated = (name: string) => parseGpx(gpx(trk(name, [pt(46, 8), pt(46.1, 8)])));
		const stages = splitIntoStages([
			{ fileName: 'tag10.gpx', gpx: undated('Zehn') },
			{ fileName: 'tag2.gpx', gpx: undated('Zwei') },
			{ fileName: 'x.gpx', gpx: parseGpx(gpx(trk('Datiert', day('2024-07-08', 46.5)))) }
		]);
		expect(stages.map((s) => s.title)).toEqual(['Datiert', 'Zwei', 'Zehn']);
	});
});

describe('stats', () => {
	it('measures distance', () => {
		// One degree of latitude is ~111.2 km.
		expect(distance({ lat: 46, lng: 8 }, { lat: 47, lng: 8 })).toBeCloseTo(111_195, -2);
	});

	it('ignores elevation noise below the threshold', () => {
		const noisy: TrackPoint[] = [1000, 1002, 999, 1003, 1000, 1001, 1020, 1018, 1040].map(
			(ele, i) => ({ lat: 46 + i * 0.001, lng: 8, ele })
		);
		const stats = routeStats([noisy]);
		expect(stats.ascentM).toBe(40);
		expect(stats.descentM).toBe(0);
		expect([stats.minEle, stats.maxEle]).toEqual([999, 1040]);
	});

	it('does not count the gap between segments as distance', () => {
		const a = [
			{ lat: 46, lng: 8 },
			{ lat: 46.01, lng: 8 }
		];
		const b = [
			{ lat: 47, lng: 8 },
			{ lat: 47.01, lng: 8 }
		];
		expect(routeStats([a, b]).distanceM).toBeCloseTo(2 * 1112, -1);
	});

	it('simplifies straight lines but keeps corners', () => {
		const line: TrackPoint[] = Array.from({ length: 50 }, (_, i) => ({
			lat: 46 + i * 0.0001,
			lng: 8
		}));
		line.push({ lat: 46.0049, lng: 8.01 });
		expect(simplify(line, 5)).toHaveLength(3);
	});

	it('produces display geometry and bbox', () => {
		const m = stageMetrics([
			[
				{ lat: 46.123456789, lng: 8.1, ele: 1500.4 },
				{ lat: 46.2, lng: 8.2, ele: 1600.6 }
			]
		]);
		expect(m.geojson.coordinates[0][0]).toEqual([8.1, 46.12346, 1500]);
		expect([m.minLng, m.minLat, m.maxLng, m.maxLat]).toEqual([8.1, 46.123456789, 8.2, 46.2]);
	});
});

describe('toGpx', () => {
	it('round-trips through the parser and escapes names', () => {
		const xml = toGpx('Tour <1> & "2"', [
			{
				name: 'Tag 1',
				segments: [
					[
						{ lat: 46, lng: 8, ele: 1000, time: Date.parse('2024-07-08T06:00:00Z') },
						{ lat: 46.1, lng: 8.1, ele: 1100 }
					]
				]
			}
		]);
		const parsed = parseGpx(xml);
		expect(parsed.name).toBe('Tour <1> & "2"');
		expect(parsed.tracks[0].segments[0][0].time).toBe(Date.parse('2024-07-08T06:00:00Z'));
	});
});
