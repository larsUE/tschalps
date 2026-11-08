import { describe, expect, it } from 'vitest';
import { renderMarkdown } from './markdown.ts';

describe('renderMarkdown', () => {
	it('renders basic formatting and keeps single line breaks', () => {
		expect(renderMarkdown('**Heu** und *Wasser*\nzweite Zeile')).toBe(
			'<p><strong>Heu</strong> und <em>Wasser</em><br />zweite Zeile</p>'
		);
	});

	it('renders lists and turns h1 into h2', () => {
		const html = renderMarkdown('# Tag 1\n\n- Furka\n- Realp');
		expect(html).toContain('<h2>Tag 1</h2>');
		expect(html).toContain('<ul>\n<li>Furka</li>\n<li>Realp</li>\n</ul>');
	});

	it('removes scripts, raw HTML, images and unsafe links', () => {
		const html = renderMarkdown(
			'<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>\n\n[x](javascript:alert(1))\n\n![b](http://e/b.png)'
		)!;
		expect(html).not.toMatch(/<script|<img|onerror|href="javascript/i);
		expect(html).toContain('<a rel="noopener noreferrer" target="_blank">x</a>');
	});

	it('opens links in a new tab without leaking the opener', () => {
		expect(renderMarkdown('[SAC](https://www.sac-cas.ch)')).toBe(
			'<p><a href="https://www.sac-cas.ch" rel="noopener noreferrer" target="_blank">SAC</a></p>'
		);
	});

	it('returns null for empty text', () => {
		expect(renderMarkdown('  \n ')).toBeNull();
		expect(renderMarkdown(null)).toBeNull();
	});
});
