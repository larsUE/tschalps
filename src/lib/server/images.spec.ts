import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { PhotoError, parseExifTime, processPhoto } from './images.ts';

describe('parseExifTime', () => {
	it('reads camera time as Swiss local time (summer: UTC+2)', () => {
		expect(parseExifTime('2024:07:08 10:15:00')).toEqual({
			takenAt: Date.parse('2024-07-08T08:15:00Z'),
			takenOn: '2024-07-08'
		});
	});

	it('uses winter time in winter (UTC+1)', () => {
		expect(parseExifTime('2024:01:15 10:00:00')?.takenAt).toBe(Date.parse('2024-01-15T09:00:00Z'));
	});

	it('prefers a recorded offset', () => {
		expect(parseExifTime('2024:07:08 10:15:00', '+05:30')?.takenAt).toBe(
			Date.parse('2024-07-08T04:45:00Z')
		);
	});

	it('rejects garbage', () => {
		expect(parseExifTime('0000:00:00 00:00:00')).toBeNull();
		expect(parseExifTime(undefined)).toBeNull();
	});
});

describe('processPhoto', () => {
	const image = (width: number, height: number) =>
		sharp({ create: { width, height, channels: 3, background: '#7a9a5a' } });

	it('reads EXIF time and GPS, resizes, and strips metadata', async () => {
		const jpeg = await image(4000, 3000)
			.jpeg()
			.withExif({
				IFD0: { Make: 'TestCam' },
				IFD2: { DateTimeOriginal: '2024:07:09 14:30:00' },
				IFD3: {
					GPSLatitudeRef: 'N',
					GPSLatitude: '46/1 40/1 3000/100',
					GPSLongitudeRef: 'E',
					GPSLongitude: '8/1 46/1 1200/100'
				}
			})
			.toBuffer();

		const p = await processPhoto(jpeg);
		expect([p.width, p.height]).toEqual([2000, 1500]);
		expect(p.takenOn).toBe('2024-07-09');
		expect(p.takenAt).toBe(Date.parse('2024-07-09T12:30:00Z'));
		expect(p.lat).toBeCloseTo(46.675, 3);
		expect(p.lng).toBeCloseTo(8.77, 3);

		const out = await sharp(p.large).metadata();
		expect(out.format).toBe('webp');
		expect(out.exif).toBeUndefined();
		expect((await sharp(p.thumb).metadata()).width).toBe(480);
	});

	it('keeps small images small and accepts photos without EXIF', async () => {
		const p = await processPhoto(await image(300, 200).png().toBuffer());
		expect([p.width, p.height, p.lat, p.takenAt]).toEqual([300, 200, null, null]);
	});

	it('rejects non-images and unsupported formats', async () => {
		await expect(processPhoto(new TextEncoder().encode('kein Bild'))).rejects.toThrow(PhotoError);
		const gif = await image(10, 10).gif().toBuffer();
		await expect(processPhoto(gif)).rejects.toThrow(/JPEG/);
	});
});
