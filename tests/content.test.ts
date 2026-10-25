import { describe, expect, test } from 'bun:test'
import { ConfigError, config, parseConfig } from '../src/config'
import { ContentError, validate, validateBlocks } from '../src/fields'
import { markdown, sanitize } from '../src/html'
import { pages } from '../src/repo/pages'

describe('config', () => {
	test('default config is valid', () => {
		expect(Object.keys(config.blocks).length).toBeGreaterThan(5)
	})
	test('rejects unknown field types and broken references', () => {
		expect(() =>
			parseConfig({
				blocks: { a: { label: 'A', fields: [{ name: 'x', type: 'nope' }] } },
				collections: {},
				settings: {},
			}),
		).toThrow(ConfigError)
		expect(() =>
			parseConfig({
				blocks: { a: { label: 'A', fields: [{ name: 'r', type: 'relation', collection: 'missing' }] } },
				collections: {},
				settings: {},
			}),
		).toThrow(/unknown collection/)
	})
})

describe('fields', () => {
	const fields = config.blocks.accordion!.fields
	test('strips unknown keys, sanitizes rich text, assigns repeater ids', () => {
		const out = validate(fields, {
			title: 'FAQ',
			exclusive: true,
			junk: 1,
			items: [{ question: 'Q', answer: '<p onclick="x()">A</p><script>bad()</script>' }],
		})
		expect(out.junk).toBeUndefined()
		expect(out.items[0].answer).toBe('<p>A</p>')
		expect(out.items[0]._id).toBeString()
	})
	test('reports readable issues', () => {
		try {
			validate(fields, { exclusive: 'yes', items: [] })
			throw new Error('should fail')
		} catch (e) {
			expect(e).toBeInstanceOf(ContentError)
			expect((e as ContentError).issues.map((i) => i.path)).toEqual(['/exclusive', '/items'])
		}
	})
	test('validates nested blocks with allow-list', () => {
		const ok = validateBlocks([
			{
				id: '1',
				type: 'columns',
				data: { ratio: '1-1', left: [{ id: '2', type: 'text', data: { content: 'x' } }], right: [] },
			},
		])
		expect(ok[0]!.data.left[0].type).toBe('text')
		expect(() =>
			validateBlocks([
				{ id: '1', type: 'columns', data: { left: [{ id: '2', type: 'hero', data: { title: 'x' } }] } },
			]),
		).toThrow(ContentError)
	})
})

describe('html', () => {
	test('sanitize drops unsafe markup', () => {
		expect(sanitize('<a href="javascript:alert(1)" target="_blank">x</a><iframe src="x"></iframe>')).toBe(
			'<a target="_blank" rel="noopener noreferrer">x</a>',
		)
	})
	test('markdown', () => {
		expect(markdown('# Hi\n\n**b**')).toContain('<strong>b</strong>')
		expect(markdown('<script>x</script>')).not.toContain('<script>')
	})
})

describe('page tree', () => {
	test('computes paths, moves pages and keeps URLs unique', () => {
		const existing = pages.list()
		for (const p of existing) if (!p.parentId) pages.remove(p.id)
		const home = pages.create({ title: 'Home' })
		const about = pages.create({ title: 'Über uns' })
		const team = pages.create({ title: 'Team', parentId: about.id })
		expect(home.path).toBe('/')
		expect(about.path).toBe('/ueber-uns')
		expect(team.path).toBe('/ueber-uns/team')

		pages.move(team.id, null, 0)
		expect(pages.get(team.id)!.path).toBe('/team')
		expect(pages.list().filter((p) => !p.parentId)[0]!.id).toBe(team.id)
		expect(() => pages.move(about.id, about.id, 0)).toThrow(ContentError)

		const dup = pages.create({ title: 'Team' })
		expect(dup.slug).toBe('team-2')
		const update = { title: 'X', slug: 'team', status: 'draft' as const, nav: true, data: {}, blocks: [] }
		expect(() => pages.update(dup.id, update)).toThrow(/existiert bereits/)

		for (const p of [home, about, team, dup]) pages.remove(p.id)
		expect(pages.list()).toEqual([])
	})
})
