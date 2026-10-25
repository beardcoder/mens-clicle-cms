import { existsSync, readFileSync } from 'node:fs'
import Type from 'typebox'
import { Compile } from 'typebox/compile'
import embedded from '../cms.config.json'
import { type Config, FIELD_TYPES, type Field } from './types'

const Name = Type.String({ pattern: '^[a-zA-Z_][a-zA-Z0-9_]*$' })
const Fields = Type.Array(Type.Ref('Field'))

const Schemas = {
	Field: Type.Object(
		{
			name: Name,
			type: Type.Union(FIELD_TYPES.map((t) => Type.Literal(t))),
			label: Type.Optional(Type.String()),
			help: Type.Optional(Type.String()),
			placeholder: Type.Optional(Type.String()),
			required: Type.Optional(Type.Boolean()),
			default: Type.Optional(Type.Unknown()),
			width: Type.Optional(Type.Union([Type.Literal('full'), Type.Literal('half'), Type.Literal('third')])),
			min: Type.Optional(Type.Number()),
			max: Type.Optional(Type.Number()),
			step: Type.Optional(Type.Number()),
			rows: Type.Optional(Type.Integer({ minimum: 1 })),
			options: Type.Optional(
				Type.Array(Type.Union([Type.String(), Type.Object({ value: Type.String(), label: Type.String() })])),
			),
			fields: Type.Optional(Fields),
			itemLabel: Type.Optional(Type.String()),
			collection: Type.Optional(Type.String()),
			multiple: Type.Optional(Type.Boolean()),
			accept: Type.Optional(Type.String()),
			allow: Type.Optional(Type.Array(Type.String())),
		},
		{ additionalProperties: false },
	),
	Config: Type.Object(
		{
			$schema: Type.Optional(Type.String()),
			page: Type.Optional(Type.Object({ fields: Fields })),
			blocks: Type.Record(
				Type.String(),
				Type.Object({
					label: Type.String(),
					icon: Type.Optional(Type.String()),
					category: Type.Optional(Type.String()),
					description: Type.Optional(Type.String()),
					fields: Fields,
				}),
			),
			collections: Type.Record(
				Type.String(),
				Type.Object({
					label: Type.String(),
					singular: Type.Optional(Type.String()),
					icon: Type.Optional(Type.String()),
					route: Type.Optional(Type.String({ pattern: '^/[a-z0-9/_-]*[a-z0-9_-]$' })),
					dateField: Type.Optional(Type.String()),
					sort: Type.Optional(
						Type.Object({
							field: Type.String(),
							order: Type.Optional(Type.Union([Type.Literal('asc'), Type.Literal('desc')])),
						}),
					),
					columns: Type.Optional(Type.Array(Type.String())),
					fields: Fields,
				}),
			),
			settings: Type.Record(
				Type.String(),
				Type.Object({ label: Type.String(), icon: Type.Optional(Type.String()), fields: Fields }),
			),
		},
		{ additionalProperties: false },
	),
}

/** JSON schema of `cms.config.json` (also exported for editor autocompletion, see scripts/schema.ts) */
export const ConfigSchema = Type.Cyclic(Schemas, 'Config')
const check = Compile(ConfigSchema)

export class ConfigError extends Error {}

/** Validate structure (TypeBox) and references between definitions. */
export function parseConfig(input: unknown): Config {
	if (!check.Check(input)) {
		const issues = check.Errors(input).map((e) => `  ${e.instancePath || '/'}: ${e.message}`)
		throw new ConfigError(`Invalid CMS config:\n${issues.join('\n')}`)
	}
	const config = input as Config
	const problems: string[] = []
	const walk = (fields: Field[], at: string) => {
		const seen = new Set<string>()
		for (const f of fields) {
			const path = `${at}.${f.name}`
			if (seen.has(f.name)) problems.push(`${path}: duplicate field name`)
			seen.add(f.name)
			if ((f.type === 'repeater' || f.type === 'group') && !f.fields?.length)
				problems.push(`${path}: "${f.type}" needs "fields"`)
			if ((f.type === 'select' || f.type === 'multiselect') && !f.options?.length)
				problems.push(`${path}: "${f.type}" needs "options"`)
			if (f.type === 'relation' && !(f.collection && config.collections[f.collection]))
				problems.push(`${path}: unknown collection "${f.collection}"`)
			for (const b of f.allow ?? []) if (!config.blocks[b]) problems.push(`${path}: unknown block "${b}"`)
			if (f.fields) walk(f.fields, path)
		}
	}
	walk(config.page?.fields ?? [], 'page')
	for (const [k, b] of Object.entries(config.blocks)) walk(b.fields, `blocks.${k}`)
	for (const [k, c] of Object.entries(config.collections)) walk(c.fields, `collections.${k}`)
	for (const [k, s] of Object.entries(config.settings)) walk(s.fields, `settings.${k}`)
	if (problems.length) throw new ConfigError(`Invalid CMS config:\n  ${problems.join('\n  ')}`)
	return config
}

/**
 * `CMS_CONFIG` env or `./cms.config.json` in the working directory wins;
 * otherwise the config embedded at build time is used (single binary).
 */
export function loadConfig(path = process.env.CMS_CONFIG ?? 'cms.config.json'): Config {
	return parseConfig(existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : embedded)
}

export const config = loadConfig()
