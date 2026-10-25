import { renderToString } from 'preact-render-to-string'
import { config } from '../config'
import { onChange } from '../db'
import { expand, expandBlocks, expandEntry } from '../expand'
import { entries } from '../repo/entries'
import { pages } from '../repo/pages'
import { settings } from '../repo/settings'
import type { Entry, Page, PageSummary } from '../types'
import { Blocks } from './blocks'
import { type NavItem, type Site, SiteContext } from './context'
import { EntryView } from './entry'
import { Layout } from './layout'

export type Match = { kind: 'page'; page: Page } | { kind: 'entry'; entry: Entry }

/** Resolve a URL path to a page or a collection entry */
export function resolve(path: string, preview = false): Match | null {
	const visible = (s: { status: string }) => preview || s.status === 'published'
	const page = pages.byPath(path)
	if (page && visible(page)) return { kind: 'page', page }
	for (const [name, def] of Object.entries(config.collections)) {
		if (!def.route || !path.startsWith(`${def.route}/`)) continue
		const slug = path.slice(def.route.length + 1)
		if (slug.includes('/')) continue
		const entry = entries.bySlug(name, slug)
		if (entry && visible(entry)) return { kind: 'entry', entry }
	}
	return null
}

export function navTree(list: PageSummary[], preview = false): NavItem[] {
	const items = list
		.filter((p) => p.nav && (preview || p.status === 'published'))
		.map((p) => ({ ...p, children: [] as NavItem[] }))
	const byId = new Map(items.map((i) => [i.id, i]))
	const roots: NavItem[] = []
	for (const item of items) ((item.parentId && byId.get(item.parentId)?.children) || roots).push(item)
	return roots
}

function siteContext(path: string, preview: boolean): Site {
	const expandOptions = { drafts: preview }
	const all = settings.all()
	const expanded = Object.fromEntries(
		Object.entries(all).map(([k, v]) => [k, expand(config.settings[k]!.fields, v, expandOptions)]),
	)
	return {
		settings: expanded,
		nav: navTree(pages.list(), preview),
		path,
		lang: all.general?.lang || 'de',
		preview,
		expand: expandOptions,
	}
}

const html = (site: Site, node: preact.VNode) =>
	`<!doctype html>${renderToString(<SiteContext.Provider value={site}>{node}</SiteContext.Provider>)}`

export function renderPath(path: string, preview = false): { status: number; html: string } {
	const site = siteContext(path, preview)
	const match = resolve(path, preview)
	if (!match)
		return {
			status: 404,
			html: html(
				site,
				<Layout title="Seite nicht gefunden">
					<section class="block not-found">
						<h1>404</h1>
						<p>Diese Seite gibt es leider nicht.</p>
						<a href="/" class="button">
							Zur Startseite
						</a>
					</section>
				</Layout>,
			),
		}
	if (match.kind === 'entry') {
		const entry = expandEntry(match.entry, site.expand)
		const d = entry.data
		return {
			status: 200,
			html: html(
				site,
				<Layout title={entry.title} description={d.teaser ?? undefined} image={d.image}>
					<EntryView entry={entry} />
				</Layout>,
			),
		}
	}
	const { page } = match
	const data = expand(config.page?.fields ?? [], page.data, site.expand)
	return {
		status: 200,
		html: html(
			site,
			<Layout title={page.title} description={data.description} image={data.ogImage}>
				{!data.hideTitle && (
					<header class="page-header">
						<h1>{page.title}</h1>
					</header>
				)}
				<Blocks blocks={expandBlocks(page.blocks, site.expand)} />
			</Layout>,
		),
	}
}

// Rendered pages (plus a gzipped copy) are cached in memory until the next content change
type Cached = { status: number; html: string; gzip: Uint8Array<ArrayBuffer> }
const cache = new Map<string, Cached>()
onChange(() => cache.clear())

export function renderCached(path: string): Cached {
	const hit = cache.get(path)
	if (hit) return hit
	const page = renderPath(path)
	const entry = { ...page, gzip: Bun.gzipSync(page.html) }
	if (page.status === 200) {
		if (cache.size >= 1000) cache.clear()
		cache.set(path, entry)
	}
	return entry
}
