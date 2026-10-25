// HTML sanitizing (Bun's native HTMLRewriter) and Markdown (Bun.markdown)

const ALLOWED: Record<string, string[]> = {
	p: [],
	br: [],
	strong: [],
	b: [],
	em: [],
	i: [],
	u: [],
	s: [],
	sub: [],
	sup: [],
	code: [],
	pre: [],
	blockquote: [],
	hr: [],
	h1: ['id'],
	h2: ['id'],
	h3: ['id'],
	h4: ['id'],
	h5: ['id'],
	h6: ['id'],
	ul: [],
	ol: ['start'],
	li: [],
	a: ['href', 'target', 'rel', 'title'],
	table: [],
	thead: [],
	tbody: [],
	tr: [],
	th: ['align'],
	td: ['align'],
	del: [],
	input: ['type', 'checked', 'disabled'],
	img: ['src', 'alt', 'title'],
}
/** Removed together with their content */
const DROP = new Set([
	'script',
	'style',
	'iframe',
	'object',
	'embed',
	'template',
	'noscript',
	'svg',
	'math',
	'form',
])
const SAFE_URL = /^(https?:|mailto:|tel:|\/|#|\.)/i

const rewriter = new HTMLRewriter().on('*', {
	element(el) {
		const tag = el.tagName
		if (DROP.has(tag)) {
			el.remove()
			return
		}
		const allowed = ALLOWED[tag]
		if (!allowed) {
			el.removeAndKeepContent()
			return
		}
		for (const [name, value] of [...el.attributes]) {
			const ok =
				allowed.includes(name) && ((name !== 'href' && name !== 'src') || SAFE_URL.test(value.trim()))
			if (!ok) el.removeAttribute(name)
		}
		if (tag === 'input' && el.getAttribute('type') !== 'checkbox') el.remove()
		if (tag === 'a' && el.getAttribute('target') === '_blank') el.setAttribute('rel', 'noopener noreferrer')
	},
	comments(c) {
		c.remove()
	},
})

export const sanitize = (html: string): string => (html ? rewriter.transform(html) : '')

export const markdown = (src: string): string =>
	src ? sanitize(Bun.markdown.html(src, { tagFilter: true, autolinks: true, headings: { ids: true } })) : ''

export const stripTags = (html: string) =>
	html
		.replace(/<[^>]*>/g, ' ')
		.replace(/\s+/g, ' ')
		.trim()
