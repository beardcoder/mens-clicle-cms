import { beforeAll, describe, expect, test } from 'bun:test'
import { app } from '../src/app'
import { seed } from '../src/seed'

let cookie = ''
const req = async (path: string, init: RequestInit & { json?: unknown } = {}) => {
	const headers = new Headers(init.headers)
	if (cookie) headers.set('cookie', cookie)
	if (init.json !== undefined) headers.set('content-type', 'application/json')
	const res = await app.handle(
		new Request(`http://localhost${path}`, {
			...init,
			headers,
			body: init.json !== undefined ? JSON.stringify(init.json) : init.body,
		}),
	)
	const set = res.headers.get('set-cookie')
	if (set) cookie = set.split(';')[0]!
	return res
}

// 1×1 PNG
const PNG = Uint8Array.fromBase64(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
)

beforeAll(() => seed())

describe('auth', () => {
	test('admin API requires a session', async () => {
		expect((await req('/api/pages')).status).toBe(401)
	})
	test('first-run setup creates admin and session', async () => {
		expect(await (await req('/api/auth/me')).json()).toMatchObject({ user: null, setup: true })
		const res = await req('/api/auth/setup', {
			method: 'POST',
			json: { email: 'a@b.de', name: 'A', password: 'password123' },
		})
		expect(res.status).toBe(200)
		expect(cookie).toStartWith('session=')
		expect((await req('/api/pages')).status).toBe(200)
		const again = await req('/api/auth/setup', {
			method: 'POST',
			json: { email: 'c@d.de', name: 'C', password: 'password123' },
		})
		expect(again.status).toBe(403)
	})
	test('login rejects wrong password', async () => {
		const saved = cookie
		cookie = ''
		expect(
			(await req('/api/auth/login', { method: 'POST', json: { email: 'a@b.de', password: 'nope' } })).status,
		).toBe(401)
		cookie = saved
	})
})

describe('content API', () => {
	test('creates, validates and lists entries', async () => {
		const bad = await req('/api/collections/events', {
			method: 'POST',
			json: { title: 'X', data: { start: 'gestern' } },
		})
		expect(bad.status).toBe(422)
		expect((await bad.json()).issues[0].path).toBe('/data/start')

		const res = await req('/api/collections/events', {
			method: 'POST',
			json: { title: 'Sommerfest', status: 'published', data: { start: '2099-07-01T18:00', price: 5 } },
		})
		const entry = await res.json()
		expect(entry.slug).toBe('sommerfest')
		expect(entry.url).toBe('/veranstaltungen/sommerfest')

		const list = await (await req('/api/content/events?filter=upcoming')).json()
		expect(list.items.some((e: { id: number }) => e.id === entry.id)).toBeTrue()
		expect((await req('/api/collections/unknown')).status).toBe(404)
	})

	test('uploads media and resolves it in page content', async () => {
		const form = new FormData()
		form.append('files', new File([PNG], 'pixel.png', { type: 'image/png' }))
		const [m] = await (await req('/api/media', { method: 'POST', body: form })).json()
		expect(m).toMatchObject({ width: 1, height: 1, mime: 'image/png' })
		expect(m.placeholder).toStartWith('data:image/png')

		const file = await req(`${m.url}&w=320&f=webp`)
		expect(file.headers.get('content-type')).toBe('image/webp')

		const page = await (await req('/api/pages', { method: 'POST', json: { title: 'Galerie' } })).json()
		const saved = await req(`/api/pages/${page.id}`, {
			method: 'PUT',
			json: {
				title: 'Galerie',
				slug: 'galerie',
				status: 'published',
				nav: true,
				data: {},
				blocks: [{ id: 'b1', type: 'image', data: { image: m.id, caption: 'Pixel' } }],
			},
		})
		expect(saved.status).toBe(200)
		const pub = await (await req('/api/content/page?path=/galerie')).json()
		expect(pub.blocks[0].data.image.url).toBe(m.url)
	})
})

describe('site', () => {
	test('renders pages, entries, 404 and sitemap', async () => {
		const home = await req('/')
		expect(home.status).toBe(200)
		expect(await home.text()).toContain('<h1>Willkommen im Mens Circle</h1>')

		const html = await (await req('/galerie')).text()
		expect(html).toContain('srcset=')
		expect(html).toContain('<figcaption>Pixel</figcaption>')

		expect(await (await req('/veranstaltungen/sommerfest')).text()).toContain('Sommerfest')
		expect((await req('/gibt-es-nicht')).status).toBe(404)
		expect(await (await req('/sitemap.xml')).text()).toContain('/galerie</loc>')
		expect((await req('/galerie/')).status).toBe(301)
	})

	test('escapes user content in templates', async () => {
		// breaks out of text nodes and quoted attributes if not escaped
		const evil = '"><img src=x onerror=alert(1)>'
		await req('/api/collections/news', {
			method: 'POST',
			json: {
				title: evil,
				slug: 'xss',
				status: 'published',
				data: { date: '2026-01-01', teaser: evil, tags: [evil] },
			},
		})
		const html = await (await req('/news/xss')).text()
		expect(html).not.toContain(evil)
		expect(html).toContain('<h1>&quot;&gt;&lt;img src=x onerror=alert(1)&gt;</h1>')
	})

	test('drafts are only visible in preview for editors', async () => {
		const page = await (await req('/api/pages', { method: 'POST', json: { title: 'Geheim' } })).json()
		const saved = cookie
		cookie = ''
		expect((await req(page.path)).status).toBe(404)
		cookie = saved
		const preview = await req(`${page.path}?preview`)
		expect(preview.status).toBe(200)
		expect(preview.headers.get('content-type')).toStartWith('text/html')
		expect(await preview.text()).toStartWith('<!doctype html>')
	})
})
