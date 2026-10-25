// Turns JSON field definitions into compiled TypeBox validators and normalizes content.
import Type, { type TSchema } from 'typebox'
import { Compile } from 'typebox/compile'
import Value from 'typebox/value'
import { config } from './config'
import { sanitize } from './html'
import type { Block, Data, Field } from './types'

const PATTERN: Partial<Record<Field['type'], string>> = {
	date: '^\\d{4}-\\d{2}-\\d{2}$',
	datetime: '^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}(:\\d{2}(\\.\\d+)?)?Z?$',
	time: '^\\d{2}:\\d{2}$',
	color: '^#[0-9a-fA-F]{6}$',
	email: '^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$',
	url: '^(https?://|/|#|mailto:|tel:)\\S*$',
}

/** Drop undefined keys so TypeBox doesn't see `{ minimum: undefined }` */
const opts = (o: Record<string, unknown>) =>
	Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined))

const nullable = (s: TSchema, f: Field) => (f.required ? s : Type.Union([s, Type.Null()]))
const optionValue = (o: NonNullable<Field['options']>[number]) => (typeof o === 'string' ? o : o.value)
const items = (f: Field) => opts({ minItems: f.min ?? (f.required ? 1 : undefined), maxItems: f.max })

export const BlockSchema = Type.Object({
	id: Type.String({ minLength: 1 }),
	type: Type.String(),
	hidden: Type.Optional(Type.Boolean()),
	data: Type.Record(Type.String(), Type.Unknown()),
})

export const LinkSchema = Type.Object(
	{
		href: Type.String(),
		label: Type.Optional(Type.String()),
		target: Type.Optional(Type.Union([Type.Literal('_blank'), Type.Literal('')])),
		page: Type.Optional(Type.Union([Type.Integer(), Type.Null()])),
	},
	{ additionalProperties: false },
)

export function fieldSchema(f: Field): TSchema {
	switch (f.type) {
		case 'number':
			return nullable(Type.Number(opts({ minimum: f.min, maximum: f.max })), f)
		case 'boolean':
			return Type.Boolean()
		case 'select': {
			const values = (f.options ?? []).map((o) => Type.Literal(optionValue(o)))
			return Type.Union<TSchema[]>(f.required ? values : [...values, Type.Literal(''), Type.Null()])
		}
		case 'multiselect':
			return Type.Array(Type.Union((f.options ?? []).map((o) => Type.Literal(optionValue(o)))), items(f))
		case 'tags':
			return Type.Array(Type.String({ minLength: 1 }), items(f))
		case 'link':
			return nullable(LinkSchema, f)
		case 'image':
		case 'file':
		case 'page':
			return f.multiple ? Type.Array(Type.Integer(), items(f)) : nullable(Type.Integer(), f)
		case 'relation':
			return f.multiple ? Type.Array(Type.Integer(), items(f)) : nullable(Type.Integer(), f)
		case 'gallery':
			return Type.Array(Type.Integer(), items(f))
		case 'repeater':
			return Type.Array(objectSchema(f.fields ?? [], { _id: Type.Optional(Type.String()) }), items(f))
		case 'group':
			return objectSchema(f.fields ?? [])
		case 'blocks':
			return Type.Array(BlockSchema, items(f))
		default: {
			const pattern = PATTERN[f.type]
			if (pattern)
				return f.required
					? Type.String({ pattern })
					: Type.Union([Type.String({ pattern }), Type.Literal('')])
			return Type.String(opts({ minLength: f.required ? 1 : undefined, maxLength: f.max }))
		}
	}
}

export function objectSchema(fields: Field[], extra: Record<string, TSchema> = {}) {
	const props: Record<string, TSchema> = { ...extra }
	for (const f of fields) props[f.name] = f.required ? fieldSchema(f) : Type.Optional(fieldSchema(f))
	return Type.Object(props, { additionalProperties: false })
}

export interface Issue {
	path: string
	message: string
}

export class ContentError extends Error {
	constructor(public issues: Issue[]) {
		super(issues.map((i) => `${i.path}: ${i.message}`).join('; '))
	}
}

const compiled = new WeakMap<Field[], { schema: TSchema; check: ReturnType<typeof Compile> }>()
const validator = (fields: Field[]) => {
	let v = compiled.get(fields)
	if (!v) {
		const schema = objectSchema(fields)
		v = { schema, check: Compile(schema) }
		compiled.set(fields, v)
	}
	return v
}

/**
 * Validate `data` against `fields`, strip unknown keys and normalize values
 * (sanitize rich text, validate nested blocks). Throws `ContentError`.
 */
export function validate(fields: Field[], data: unknown, path = ''): Data {
	const { schema, check } = validator(fields)
	const clean = Value.Clean(schema, structuredClone(data ?? {})) as Data
	if (!check.Check(clean)) throw new ContentError(issues(check.Errors(clean), path))
	return normalize(fields, clean, path)
}

/** One message per path — unions (nullable, optional '') otherwise report every branch */
const GENERIC = /^must (be null|be equal to constant|match a schema in anyOf)/
function issues(errors: { instancePath: string; message: string }[], prefix: string): Issue[] {
	const byPath = new Map<string, string>()
	for (const e of errors) {
		const current = byPath.get(e.instancePath)
		if (!current || (GENERIC.test(current) && !GENERIC.test(e.message))) byPath.set(e.instancePath, e.message)
	}
	return [...byPath].map(([path, message]) => ({ path: prefix + path, message }))
}

function normalize(fields: Field[], data: Data, path: string): Data {
	for (const f of fields) {
		const value = data[f.name]
		if (value == null) continue
		const at = `${path}/${f.name}`
		switch (f.type) {
			case 'richtext':
				data[f.name] = sanitize(value)
				break
			case 'group':
				data[f.name] = normalize(f.fields ?? [], value, at)
				break
			case 'repeater':
				data[f.name] = value.map((item: Data, i: number) => ({
					...normalize(f.fields ?? [], item, `${at}/${i}`),
					_id: item._id || Bun.randomUUIDv7(),
				}))
				break
			case 'blocks':
				data[f.name] = validateBlocks(value, f.allow, at)
				break
		}
	}
	return data
}

export function validateBlocks(blocks: Block[], allow?: string[], path = ''): Block[] {
	return blocks.map((block, i) => {
		const def = config.blocks[block.type]
		const at = `${path}/${i}`
		if (!def || (allow && !allow.includes(block.type)))
			throw new ContentError([{ path: `${at}/type`, message: `unknown or disallowed block "${block.type}"` }])
		return {
			id: block.id,
			type: block.type,
			...(block.hidden ? { hidden: true } : {}),
			data: validate(def.fields, block.data, `${at}/data`),
		}
	})
}

export { defaults, slugify } from './shared'
