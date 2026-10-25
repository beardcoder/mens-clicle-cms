// Runtime helpers shared by server and admin UI (no server-only imports here)
import type { Data, Field } from './types'

/** Default value for a field (used for new blocks/entries) */
export function defaults(fields: Field[]): Data {
	const out: Data = {}
	for (const f of fields) {
		if (f.default !== undefined) out[f.name] = structuredClone(f.default)
		else if (f.type === 'group') out[f.name] = defaults(f.fields ?? [])
		else if (['repeater', 'gallery', 'blocks', 'tags', 'multiselect'].includes(f.type) || f.multiple)
			out[f.name] = []
		else if (f.type === 'boolean') out[f.name] = false
	}
	return out
}

export const slugify = (input: string) =>
	input
		.toLowerCase()
		.replace(/ä/g, 'ae')
		.replace(/ö/g, 'oe')
		.replace(/ü/g, 'ue')
		.replace(/ß/g, 'ss')
		.normalize('NFKD')
		.replace(/[̀-ͯ]/g, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 80)
