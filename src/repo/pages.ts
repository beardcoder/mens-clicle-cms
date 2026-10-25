import { config } from '../config'
import { changed, db, json } from '../db'
import { ContentError, slugify, validate, validateBlocks } from '../fields'
import type { Block, Data, Page, PageSummary, Status } from '../types'

const SUMMARY = `id, parent_id AS parentId, sort, title, slug, path, status, nav, updated_at AS updatedAt`
type SummaryRow = Omit<PageSummary, 'nav'> & { nav: number }
type Row = SummaryRow & { data: string; blocks: string; createdAt: string }

const summary = (r: SummaryRow): PageSummary => ({ ...r, nav: !!r.nav })
const full = (r: Row): Page => ({
	...summary(r),
	createdAt: r.createdAt,
	data: json<Data>(r.data, {}),
	blocks: json<Block[]>(r.blocks, []),
})

const q = {
	list: db.query<SummaryRow, []>(`SELECT ${SUMMARY} FROM pages ORDER BY parent_id NULLS FIRST, sort, id`),
	get: db.query<Row, [number]>(
		`SELECT ${SUMMARY}, data, blocks, created_at AS createdAt FROM pages WHERE id = ?`,
	),
	byPath: db.query<Row, [string]>(
		`SELECT ${SUMMARY}, data, blocks, created_at AS createdAt FROM pages WHERE path = ?`,
	),
	siblings: db.query<{ id: number; slug: string }, [number | null]>(
		'SELECT id, slug FROM pages WHERE parent_id IS ? ORDER BY sort, id',
	),
	setPath: db.query('UPDATE pages SET path = ? WHERE id = ?'),
	setOrder: db.query('UPDATE pages SET parent_id = ?, sort = ? WHERE id = ?'),
	duplicates: db.query<{ path: string }, []>('SELECT path FROM pages GROUP BY path HAVING COUNT(*) > 1'),
}

/** Recompute every page path from the tree and reject duplicates (runs inside write transactions) */
function rebuildPaths() {
	const rows = q.list.all()
	const byId = new Map(rows.map((r) => [r.id, r]))
	const paths = new Map<number, string>()
	const resolve = (id: number): string => {
		const known = paths.get(id)
		if (known !== undefined) return known
		const row = byId.get(id)!
		const parent = row.parentId ? resolve(row.parentId) : ''
		const path = `${parent === '/' ? '' : parent}/${row.slug}`.replace(/\/$/, '') || '/'
		paths.set(id, path)
		return path
	}
	for (const r of rows) {
		const path = resolve(r.id)
		if (path !== r.path) q.setPath.run(path, r.id)
	}
	const dup = q.duplicates.get()
	if (dup) throw new ContentError([{ path: '/slug', message: `URL "${dup.path}" ist bereits vergeben` }])
}

const uniqueSlug = (base: string, parentId: number | null, exceptId?: number) => {
	const taken = new Set(
		q.siblings
			.all(parentId)
			.filter((s) => s.id !== exceptId)
			.map((s) => s.slug),
	)
	let slug = base
	for (let i = 2; taken.has(slug); i++) slug = `${base}-${i}`
	return slug
}

const isDescendant = (id: number, of: number): boolean => {
	const all = q.list.all()
	let cur = all.find((p) => p.id === id)
	while (cur?.parentId) {
		if (cur.parentId === of) return true
		cur = all.find((p) => p.id === cur!.parentId)
	}
	return false
}

export interface PageInput {
	title: string
	slug: string
	status: Status
	nav: boolean
	data: Data
	blocks: Block[]
}

export const pages = {
	list: (): PageSummary[] => q.list.all().map(summary),

	get: (id: number): Page | null => {
		const r = q.get.get(id)
		return r ? full(r) : null
	},

	byPath: (path: string): Page | null => {
		const r = q.byPath.get(path)
		return r ? full(r) : null
	},

	create: db.transaction((input: { title: string; parentId?: number | null; blocks?: Block[] }): Page => {
		const parentId = input.parentId ?? null
		const isFirstRoot = !parentId && q.siblings.all(null).length === 0
		const slug = isFirstRoot ? '' : uniqueSlug(slugify(input.title) || 'seite', parentId)
		const sort = q.siblings.all(parentId).length
		const blocks = validateBlocks(input.blocks ?? [])
		const { id } = db
			.query<{ id: number }, [number | null, number, string, string, string]>(
				'INSERT INTO pages (parent_id, sort, title, slug, blocks) VALUES (?, ?, ?, ?, ?) RETURNING id',
			)
			.get(parentId, sort, input.title, slug, JSON.stringify(blocks))!
		rebuildPaths()
		changed()
		return pages.get(id)!
	}),

	update: db.transaction((id: number, input: PageInput): Page | null => {
		const current = q.get.get(id)
		if (!current) return null
		const slug = slugify(input.slug)
		if (!slug && current.parentId)
			throw new ContentError([{ path: '/slug', message: 'Slug darf nicht leer sein' }])
		if (q.siblings.all(current.parentId).some((s) => s.slug === slug && s.id !== id))
			throw new ContentError([
				{ path: '/slug', message: `Slug "${slug}" existiert bereits auf dieser Ebene` },
			])
		const data = validate(config.page?.fields ?? [], input.data, '/data')
		const blocks = validateBlocks(input.blocks, undefined, '/blocks')
		db.query(
			`UPDATE pages SET title = ?, slug = ?, status = ?, nav = ?, data = ?, blocks = ?,
			 updated_at = strftime('%Y-%m-%dT%H:%M:%fZ') WHERE id = ?`,
		).run(
			input.title,
			slug,
			input.status,
			input.nav ? 1 : 0,
			JSON.stringify(data),
			JSON.stringify(blocks),
			id,
		)
		rebuildPaths()
		changed()
		return pages.get(id)
	}),

	/** Move page below `parentId` at position `index` (drag & drop in the page tree) */
	move: db.transaction((id: number, parentId: number | null, index: number): boolean => {
		const page = q.get.get(id)
		if (!page) return false
		if (parentId === id || (parentId && isDescendant(parentId, id)))
			throw new ContentError([
				{ path: '/parentId', message: 'Seite kann nicht in sich selbst verschoben werden' },
			])
		const slug = uniqueSlug(page.slug || slugify(page.title) || 'seite', parentId, id)
		if (slug !== page.slug) db.query('UPDATE pages SET slug = ? WHERE id = ?').run(slug, id)
		const siblings = q.siblings.all(parentId).filter((s) => s.id !== id)
		siblings.splice(Math.max(0, Math.min(index, siblings.length)), 0, { id, slug })
		for (const [i, s] of siblings.entries()) q.setOrder.run(parentId, i, s.id)
		rebuildPaths()
		changed()
		return true
	}),

	remove: (id: number): boolean => {
		const ok = db.query('DELETE FROM pages WHERE id = ?').run(id).changes > 0
		if (ok) changed()
		return ok
	},
}
