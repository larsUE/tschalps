import { describe, expect, it } from 'vitest';
import { formText } from './forms.ts';

describe('formText', () => {
	it('trims and normalises browser line breaks', () => {
		const form = new FormData();
		form.set('text', '  Zeile 1\r\nZeile 2\rZeile 3\n ');
		expect(formText(form, 'text')).toBe('Zeile 1\nZeile 2\nZeile 3');
		expect(formText(form, 'missing')).toBe('');
	});
});
