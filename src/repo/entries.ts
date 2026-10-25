import { config } from '../config'
import { changed, db, json } from '../db'
import { ContentError, slugify, validate } from '../fields'
import type { Data, Entry, Status } from '../types'

const COLS = `id, collection, slug, title, status, data, created_at AS createdAt, updated_at AS updatedAt`
type Row = Omit<Entry, 'data'> & { data: string }

export const entryUrl = (collection: string, slug: string) => {
	const route = config.collections[collection]?.route
	return route ? `${route}/${slug}` : undefined
}

const map = (r: Row): Entry => ({ ...r, data: json<Data>(r.data, {}), url: entryUrl(r.collection, r.slug) })

const COLUMNS: Record<string, string> = {
	title: 'title',
	slug: 'slug',
	createdAt: 'created_at',
	updatedAt: 'updated_at',
}
/** SQL expression for a sort/filter field — columns or JSON data fields (names are validated) */
const expr = (field: string) =>
	COLUMNS[field] ?? (/^[a-zA-Z_]\w*$/.test(field) ? `json_extract(data, '$.${field}')` : 'created_at')

export interface ListOptions {
	q?: string
	status?: Status
	filter?: 'all' | 'upcoming' | 'past'
	limit?: number
	offset?: number
}

export interface EntryInput {
	title: string
	slug?: string
	status?: Status
	data?: Data
}

const definition = (collection: string) => {
	const def = config.collections[collection]
	if (!def) throw new ContentError([{ path: '/collection', message: `Unbekannte Sammlung "${collection}"` }])
	return def
}

const uniqueSlug = (collection: string, base: string, exceptId = 0) => {
	const taken = db.query<{ id: number }, [string, string, number]>(
		'SELECT id FROM entries WHERE collection = ? AND slug = ? AND id != ?',
	)
	let slug = base
	for (let i = 2; taken.get(collection, slug, exceptId); i++) slug = `${base}-${i}`
	return slug
}

export const entries = {
	list(collection: string, o: ListOptions = {}): { items: Entry[]; total: number } {
		const def = definition(collection)
		const where = ['collection = $collection']
		const params: Record<string, string | number> = { collection }
		if (o.status) {
			where.push('status = $status')
			params.status = o.status
		}
		if (o.q) {
			where.push('(title LIKE $q OR slug LIKE $q)')
			params.q = `%${o.q}%`
		}
		if (def.dateField && o.filter && o.filter !== 'all') {
			where.push(`${expr(def.dateField)} ${o.filter === 'upcoming' ? '>=' : '<'} $today`)
			params.today = new Date().toISOString().slice(0, 10)
		}
		const sort = def.sort ?? { field: 'createdAt', order: 'desc' }
		// "past" lists read naturally newest first
		const order = o.filter === 'past' ? 'DESC' : sort.order === 'asc' ? 'ASC' : 'DESC'
		const sql = `FROM entries WHERE ${where.join(' AND ')}`
		const total = db.query<{ n: number }, any>(`SELECT COUNT(*) AS n ${sql}`).get(params)!.n
		const items = db
			.query<Row, any>(
				`SELECT ${COLS} ${sql} ORDER BY ${expr(sort.field)} ${order}, id DESC LIMIT $limit OFFSET $offset`,
			)
			.all({ ...params, limit: o.limit ?? 50, offset: o.offset ?? 0 })
			.map(map)
		return { items, total }
	},

	get(collection: string, id: number): Entry | null {
		const r = db
			.query<Row, [string, number]>(`SELECT ${COLS} FROM entries WHERE collection = ? AND id = ?`)
			.get(collection, id)
		return r ? map(r) : null
	},

	byId(id: number): Entry | null {
		const r = db.query<Row, [number]>(`SELECT ${COLS} FROM entries WHERE id = ?`).get(id)
		return r ? map(r) : null
	},

	bySlug(collection: string, slug: string): Entry | null {
		const r = db
			.query<Row, [string, string]>(`SELECT ${COLS} FROM entries WHERE collection = ? AND slug = ?`)
			.get(collection, slug)
		return r ? map(r) : null
	},

	/** Lightweight list for relation pickers */
	options(collection: string) {
		return db
			.query<{ id: number; title: string; status: Status }, [string]>(
				'SELECT id, title, status FROM entries WHERE collection = ? ORDER BY title',
			)
			.all(collection)
	},

	create(collection: string, input: EntryInput): Entry {
		const def = definition(collection)
		const data = validate(def.fields, input.data ?? {}, '/data')
		const slug = uniqueSlug(collection, slugify(input.slug || input.title) || 'eintrag')
		const { id } = db
			.query<{ id: number }, [string, string, string, string, string]>(
				'INSERT INTO entries (collection, slug, title, status, data) VALUES (?, ?, ?, ?, ?) RETURNING id',
			)
			.get(collection, slug, input.title, input.status ?? 'draft', JSON.stringify(data))!
		changed()
		return entries.get(collection, id)!
	},

	update(collection: string, id: number, input: EntryInput): Entry | null {
		const def = definition(collection)
		if (!entries.get(collection, id)) return null
		const data = validate(def.fields, input.data ?? {}, '/data')
		const slug = slugify(input.slug || input.title) || 'eintrag'
		if (slug !== uniqueSlug(collection, slug, id))
			throw new ContentError([{ path: '/slug', message: `Slug "${slug}" ist bereits vergeben` }])
		db.query(
			`UPDATE entries SET title = ?, slug = ?, status = ?, data = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ')
			 WHERE id = ?`,
		).run(input.title, slug, input.status ?? 'draft', JSON.stringify(data), id)
		changed()
		return entries.get(collection, id)
	},

	remove(collection: string, id: number): boolean {
		const ok = db.query('DELETE FROM entries WHERE collection = ? AND id = ?').run(collection, id).changes > 0
		if (ok) changed()
		return ok
	},

	counts(): Record<string, number> {
		const rows = db
			.query<{ collection: string; n: number }, []>(
				'SELECT collection, COUNT(*) AS n FROM entries GROUP BY collection',
			)
			.all()
		return Object.fromEntries(rows.map((r) => [r.collection, r.n]))
	},
}
