// Read-only headless API: published content with all references resolved
import { Elysia, status, t } from 'elysia'
import { config } from '../config'
import { expand, expandBlocks, expandEntry } from '../expand'
import { entries } from '../repo/entries'
import { pages } from '../repo/pages'
import { settings } from '../repo/settings'
import { navTree } from '../site/render'

const notFound = () => status(404, 'Nicht gefunden')

export const publicApi = new Elysia({ prefix: '/api/content' })
	.get('/settings', () =>
		Object.fromEntries(
			Object.entries(settings.all()).map(([k, v]) => [k, expand(config.settings[k]!.fields, v)]),
		),
	)
	.get('/navigation', () => navTree(pages.list()))
	.get('/page', { query: t.Object({ path: t.String() }) }, ({ query }) => {
		const page = pages.byPath(query.path)
		if (page?.status !== 'published') return notFound()
		return { ...page, data: expand(config.page?.fields ?? [], page.data), blocks: expandBlocks(page.blocks) }
	})
	.get(
		'/:collection',
		{
			params: t.Object({ collection: t.String() }),
			query: t.Object({
				filter: t.Optional(t.Union([t.Literal('all'), t.Literal('upcoming'), t.Literal('past')])),
				limit: t.Optional(t.Number({ minimum: 1, maximum: 100 })),
				offset: t.Optional(t.Number({ minimum: 0 })),
			}),
		},
		({ params, query }) => {
			if (!config.collections[params.collection]) return notFound()
			const list = entries.list(params.collection, { ...query, status: 'published' })
			return { ...list, items: list.items.map((e) => expandEntry(e)) }
		},
	)
	.get(
		'/:collection/:slug',
		{ params: t.Object({ collection: t.String(), slug: t.String() }) },
		({ params }) => {
			const entry = config.collections[params.collection] && entries.bySlug(params.collection, params.slug)
			return entry && entry.status === 'published' ? expandEntry(entry) : notFound()
		},
	)
