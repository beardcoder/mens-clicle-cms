// Writes cms.schema.json (JSON Schema for cms.config.json → autocompletion in editors)
import { ConfigSchema } from '../src/config'

const schema = JSON.parse(JSON.stringify(ConfigSchema).replaceAll('"$ref":"', '"$ref":"#/$defs/'))
for (const def of Object.values<Record<string, unknown>>(schema.$defs)) delete def.$id
await Bun.write(
	'cms.schema.json',
	JSON.stringify(
		{ $schema: 'https://json-schema.org/draft/2020-12/schema', title: 'CMS config', ...schema },
		null,
		'\t',
	),
)
console.log('✓ cms.schema.json')
