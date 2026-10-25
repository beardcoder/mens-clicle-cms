// Resolves references in content (media ids, relations, page links, nested blocks)
// into ready-to-render objects. Used by the site renderer and the public content API.
import { config } from './config'
import { entries } from './repo/entries'
import { media } from './repo/media'
import { pages } from './repo/pages'
import type { Block, Data, Entry, Field, Media } from './types'

export interface Link {
	href: string
	label: string
	target?: '_blank'
	external: boolean
}

export interface ExpandOptions {
	/** include draft relations/pages (preview mode) */
	drafts?: boolean
}

export interface ExpandedBlock extends Omit<Block, 'data'> {
	data: Data
}

const pagePath = (id: number | null | undefined, o: ExpandOptions) => {
	if (!id) return null
	const p = pages.get(id)
	return p && (o.drafts || p.status === 'published') ? p : null
}

const entrySummary = (id: number, o: ExpandOptions): (Omit<Entry, 'data'> & { data: Data }) | null => {
	const e = entries.byId(id)
	return e && (o.drafts || e.status === 'published') ? e : null
}

export function expandLink(value: Data | null | undefined, o: ExpandOptions = {}): Link | null {
	if (!value) return null
	const page = pagePath(value.page, o)
	const href = page?.path ?? value.href
	if (!href) return null
	return {
		href,
		label: value.label || page?.title || href,
		...(value.target === '_blank' ? { target: '_blank' as const } : {}),
		external: /^https?:\/\//.test(href),
	}
}

function expandValue(f: Field, value: any, o: ExpandOptions): any {
	if (value == null) return f.multiple || f.type === 'gallery' ? [] : null
	switch (f.type) {
		case 'image':
		case 'file':
			return media.get(value)
		case 'gallery':
			return (value as number[]).map((id) => media.get(id)).filter(Boolean) as Media[]
		case 'relation':
			return f.multiple
				? (value as number[]).map((id) => entrySummary(id, o)).filter(Boolean)
				: entrySummary(value, o)
		case 'page': {
			const p = pagePath(value, o)
			return p && { id: p.id, title: p.title, path: p.path }
		}
		case 'link':
			return expandLink(value, o)
		case 'group':
			return expand(f.fields ?? [], value, o)
		case 'repeater':
			return (value as Data[]).map((item) => ({ ...expand(f.fields ?? [], item, o), _id: item._id }))
		case 'blocks':
			return expandBlocks(value, o)
		default:
			return value
	}
}

export function expand(fields: Field[], data: Data, o: ExpandOptions = {}): Data {
	const out: Data = { ...data }
	for (const f of fields) out[f.name] = expandValue(f, data[f.name], o)
	return out
}

export function expandBlocks(blocks: Block[], o: ExpandOptions = {}): ExpandedBlock[] {
	return blocks
		.filter((b) => !b.hidden && config.blocks[b.type])
		.map((b) => ({ ...b, data: expand(config.blocks[b.type]!.fields, b.data, o) }))
}

export const expandEntry = (e: Entry, o: ExpandOptions = {}) => ({
	...e,
	data: expand(config.collections[e.collection]?.fields ?? [], e.data, o),
})
