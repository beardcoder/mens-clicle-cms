import { html } from '@elysia/html'
import { Elysia, status, t } from 'elysia'
import { auth } from '../api/auth'
import { config } from '../config'
import { entries } from '../repo/entries'
import { isProcessable, media, variant, WIDTHS } from '../repo/media'
import { pages } from '../repo/pages'
import { settings } from '../repo/settings'
import { CSS, CSS_HASH } from './assets'
import { renderCached, renderPath } from './render'

const IMMUTABLE = 'public, max-age=31536000, immutable'
const cssGzip = Bun.gzipSync(CSS)
const acceptsGzip = (request: Request) => request.headers.get('accept-encoding')?.includes('gzip') ?? false

// @elysia/html 2.0.0-rc.0 types import a non-exported elysia path and degrade to `any`, which would
// erase route typing for the whole chain — the plugin only maps HTML strings to responses here.
const htmlPlugin = html() as unknown as Elysia

const xml = (s: string) => s.replace(/[<>&'"]/g, (c) => `&#${c.charCodeAt(0)};`)

export const site = new Elysia({ name: 'site' })
	.use(htmlPlugin)
	.use(auth)
	.get('/assets/:file', ({ params, request }) => {
		if (params.file !== `site.${CSS_HASH}.css`) return status(404, 'Not found')
		const gzip = acceptsGzip(request)
		return new Response(gzip ? cssGzip : CSS, {
			headers: {
				'content-type': 'text/css; charset=utf-8',
				'cache-control': IMMUTABLE,
				...(gzip ? { 'content-encoding': 'gzip' } : {}),
			},
		})
	})
	.get(
		'/media/:id/:name',
		{
			params: t.Object({ id: t.Number(), name: t.String() }),
			query: t.Object({
				v: t.Optional(t.Number()),
				w: t.Optional(t.Number({ minimum: 1 })),
				f: t.Optional(t.Union([t.Literal('webp'), t.Literal('jpeg'), t.Literal('png')])),
			}),
		},
		async ({ params, query }) => {
			const m = media.file(params.id)
			if (!m) return status(404, 'Not found')
			let path = m.path
			let type = m.mime
			if ((query.w || query.f) && isProcessable(m.mime)) {
				const width = WIDTHS.find((w) => w >= (query.w ?? m.width ?? 1280)) ?? WIDTHS.at(-1)!
				path = await variant(m, Math.min(width, m.width ?? width), query.f)
				type = `image/${path.split('.').pop()}`
			}
			const headers: Record<string, string> = {
				'content-type': type,
				'cache-control': query.v === m.version ? IMMUTABLE : 'public, max-age=300',
				'x-content-type-options': 'nosniff',
			}
			if (m.mime === 'image/svg+xml')
				headers['content-security-policy'] = "default-src 'none'; style-src 'unsafe-inline'"
			if (!m.mime.startsWith('image/') && m.mime !== 'application/pdf')
				headers['content-disposition'] = `attachment; filename*=UTF-8''${encodeURIComponent(m.name)}`
			return new Response(Bun.file(path), { headers })
		},
	)
	.get('/favicon.ico', ({ redirect }) => {
		const logo = settings.get('general').logo
		const m = typeof logo === 'number' ? media.get(logo) : null
		return m ? redirect(m.url, 302) : new Response(null, { status: 204 })
	})
	.get(
		'/robots.txt',
		({ request }) => `User-agent: *\nAllow: /\nSitemap: ${new URL(request.url).origin}/sitemap.xml\n`,
	)
	.get('/sitemap.xml', ({ request }) => {
		const origin = new URL(request.url).origin
		const urls = pages
			.list()
			.filter((p) => p.status === 'published')
			.map((p) => ({ loc: p.path, lastmod: p.updatedAt }))
		for (const name of Object.keys(config.collections))
			for (const e of entries.list(name, { status: 'published', limit: 10_000 }).items)
				if (e.url) urls.push({ loc: e.url, lastmod: e.updatedAt })
		const body = urls
			.map((u) => `<url><loc>${xml(origin + u.loc)}</loc><lastmod>${u.lastmod.slice(0, 10)}</lastmod></url>`)
			.join('')
		return new Response(
			`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</urlset>`,
			{ headers: { 'content-type': 'application/xml; charset=utf-8' } },
		)
	})
	.get('/*', ({ request, user, redirect, set }) => {
		const url = new URL(request.url)
		let path: string
		try {
			path = decodeURIComponent(url.pathname)
		} catch {
			return status(400, 'Bad request')
		}
		if (path.length > 1 && path.endsWith('/')) return redirect(path.replace(/\/+$/, '') + url.search, 301)
		// Logged-in editors can preview drafts with ?preview (uncached, @elysia/html sets the content-type)
		if (user && url.searchParams.has('preview')) {
			const page = renderPath(path, true)
			set.status = page.status
			set.headers['cache-control'] = 'no-store'
			return page.html
		}
		const headers: Record<string, string> = { 'content-type': 'text/html; charset=utf-8' }
		const page = renderCached(path)
		const gzip = acceptsGzip(request)
		if (gzip) headers['content-encoding'] = 'gzip'
		headers.vary = 'accept-encoding'
		return new Response(gzip ? page.gzip : page.html, { status: page.status, headers })
	})
