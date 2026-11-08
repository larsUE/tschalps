import { Marked } from 'marked';
import sanitizeHtml from 'sanitize-html';

// `breaks`: a single line break stays a line break, so reports written as plain text
// look the same as before Markdown was supported.
const marked = new Marked({ gfm: true, breaks: true, async: false });

const SANITIZE: sanitizeHtml.IOptions = {
	allowedTags: [
		'p',
		'br',
		'strong',
		'em',
		'del',
		'ul',
		'ol',
		'li',
		'blockquote',
		'h2',
		'h3',
		'h4',
		'a',
		'code',
		'pre',
		'hr'
	],
	allowedAttributes: { a: ['href', 'title', 'rel', 'target'] },
	allowedSchemes: ['http', 'https', 'mailto'],
	transformTags: {
		// The page title is the only h1; report headings start one level lower.
		h1: 'h2',
		h5: 'h4',
		h6: 'h4',
		a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer', target: '_blank' })
	}
};

/** Renders member-written Markdown to safe HTML (no raw HTML, scripts or images). */
export function renderMarkdown(markdown: string | null | undefined): string | null {
	if (!markdown?.trim()) return null;
	return sanitizeHtml(marked.parse(markdown) as string, SANITIZE).trim();
}
