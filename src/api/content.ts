import { Elysia, status, t } from 'elysia'
import { backupStream } from '../backup'
import { config } from '../config'
import { db } from '../db'
import { entries } from '../repo/entries'
import { media } from '../repo/media'
import { pages } from '../repo/pages'
import { settings } from '../repo/settings'
import { users } from '../repo/users'
import { auth } from './auth'

const Id = t.Object({ id: t.Number() })
const Status = t.Union([t.Literal('draft'), t.Literal('published')])
const BlockList = t.Array(
	t.Object({
		id: t.String(),
		type: t.String(),
		hidden: t.Optional(t.Boolean()),
		data: t.Record(t.String(), t.Any()),
	}),
)
const notFound = () => status(404, 'Nicht gefunden')

export const configApi = new Elysia({ prefix: '/api' }).use(auth).guard({ auth: true }, (app) =>
	app
		.get('/config', () => config)
		.get('/stats', () => ({
			pages: pages.list().length,
			entries: entries.counts(),
			media: media.count(),
			users: users.count(),
		}))
		.get('/backup', () => {
			const name = `cms-backup-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.tar.gz`
			return new Response(backupStream(db), {
				headers: {
					'content-type': 'application/gzip',
					'content-disposition': `attachment; filename="${name}"`,
				},
			})
		}),
)

export const pagesApi = new Elysia({ prefix: '/api/pages' }).use(auth).guard({ auth: true }, (app) =>
	app
		.get('', () => pages.list())
		.post(
			'',
			{ body: t.Object({ title: t.String({ minLength: 1 }), parentId: t.Optional(t.Nullable(t.Number())) }) },
			({ body }) => pages.create(body),
		)
		.get('/:id', { params: Id }, ({ params }) => pages.get(params.id) ?? notFound())
		.put(
			'/:id',
			{
				params: Id,
				body: t.Object({
					title: t.String({ minLength: 1 }),
					slug: t.String(),
					status: Status,
					nav: t.Boolean(),
					data: t.Record(t.String(), t.Any()),
					blocks: BlockList,
				}),
			},
			({ params, body }) => pages.update(params.id, body) ?? notFound(),
		)
		.post(
			'/:id/move',
			{ params: Id, body: t.Object({ parentId: t.Nullable(t.Number()), index: t.Number({ minimum: 0 }) }) },
			({ params, body }) => (pages.move(params.id, body.parentId, body.index) ? pages.list() : notFound()),
		)
		.delete('/:id', { params: Id }, ({ params }) => (pages.remove(params.id) ? { ok: true } : notFound())),
)

const Collection = t.Object({ collection: t.String() })
const EntryBody = t.Object({
	title: t.String({ minLength: 1 }),
	slug: t.Optional(t.String()),
	status: t.Optional(Status),
	data: t.Optional(t.Record(t.String(), t.Any())),
})

export const entriesApi = new Elysia({ prefix: '/api/collections/:collection' })
	.use(auth)
	.guard({ auth: true }, (app) =>
		app
			.onBeforeHandle(({ params }) => {
				if (!config.collections[(params as { collection: string }).collection]) return notFound()
			})
			.get(
				'',
				{
					params: Collection,
					query: t.Object({
						q: t.Optional(t.String()),
						status: t.Optional(Status),
						limit: t.Optional(t.Number({ minimum: 1, maximum: 500 })),
						offset: t.Optional(t.Number({ minimum: 0 })),
					}),
				},
				({ params, query }) => entries.list(params.collection, query),
			)
			.get('/options', { params: Collection }, ({ params }) => entries.options(params.collection))
			.post('', { params: Collection, body: EntryBody }, ({ params, body }) =>
				entries.create(params.collection, body),
			)
			.get('/:id', { params: t.Object({ collection: t.String(), id: t.Number() }) }, ({ params }) => {
				return entries.get(params.collection, params.id) ?? notFound()
			})
			.put(
				'/:id',
				{ params: t.Object({ collection: t.String(), id: t.Number() }), body: EntryBody },
				({ params, body }) => entries.update(params.collection, params.id, body) ?? notFound(),
			)
			.delete('/:id', { params: t.Object({ collection: t.String(), id: t.Number() }) }, ({ params }) =>
				entries.remove(params.collection, params.id) ? { ok: true } : notFound(),
			),
	)

export const settingsApi = new Elysia({ prefix: '/api/settings' })
	.use(auth)
	.guard({ auth: true }, (app) =>
		app
			.get('', () => settings.all())
			.put(
				'/:group',
				{ params: t.Object({ group: t.String() }), body: t.Record(t.String(), t.Any()) },
				({ params, body }) => (config.settings[params.group] ? settings.set(params.group, body) : notFound()),
			),
	)

export const mediaApi = new Elysia({ prefix: '/api/media' }).use(auth).guard({ auth: true }, (app) =>
	app
		.get(
			'',
			{
				query: t.Object({
					folder: t.Optional(t.String()),
					q: t.Optional(t.String()),
					type: t.Optional(t.Union([t.Literal('image'), t.Literal('file')])),
					limit: t.Optional(t.Number({ minimum: 1, maximum: 500 })),
					offset: t.Optional(t.Number({ minimum: 0 })),
				}),
			},
			({ query }) => ({ ...media.list(query), folders: media.folders() }),
		)
		.post('', { body: t.Object({ files: t.Files(), folder: t.Optional(t.String()) }) }, async ({ body }) =>
			Promise.all(body.files.map((f) => media.create(f, body.folder?.trim() ?? ''))),
		)
		.get('/:id', { params: Id }, ({ params }) => media.get(params.id) ?? notFound())
		.patch(
			'/:id',
			{
				params: Id,
				body: t.Object({
					name: t.Optional(t.String()),
					alt: t.Optional(t.String()),
					folder: t.Optional(t.String()),
				}),
			},
			({ params, body }) => media.update(params.id, body) ?? notFound(),
		)
		.post(
			'/:id/rotate',
			{ params: Id, body: t.Object({ degrees: t.Union([t.Literal(90), t.Literal(180), t.Literal(270)]) }) },
			async ({ params, body }) =>
				(await media.rotate(params.id, body.degrees)) ?? status(400, 'Nicht drehbar'),
		)
		.delete('/:id', { params: Id }, ({ params }) => (media.remove(params.id) ? { ok: true } : notFound())),
)
