import { readdirSync, rmSync } from 'node:fs'
import { extname, join } from 'node:path'
import { CACHE_DIR, changed, db, UPLOAD_DIR } from '../db'
import type { Media } from '../types'

type Row = Omit<Media, 'url'> & { file: string }
const COLS = `id, name, file, mime, size, width, height, placeholder, alt, folder, version, created_at AS createdAt`

/** Formats Bun.Image can decode → re-encode (resizing, rotating, placeholders) */
export const isProcessable = (mime: string) => /^image\/(jpeg|png|webp|gif|bmp)$/.test(mime)
export const WIDTHS = [160, 320, 640, 960, 1280, 1920, 2560] as const
export type Format = 'webp' | 'jpeg' | 'png'

export const mediaUrl = (m: Pick<Media, 'id' | 'name' | 'version'>, width?: number, format?: Format) => {
	const params = new URLSearchParams({ v: String(m.version) })
	if (width) params.set('w', String(width))
	if (format) params.set('f', format)
	return `/media/${m.id}/${encodeURIComponent(m.name)}?${params}`
}

const map = ({ file: _file, ...r }: Row): Media => ({ ...r, url: mediaUrl(r) })
const filePath = (r: Pick<Row, 'file'>) => join(UPLOAD_DIR, r.file)
const getRow = (id: number) => db.query<Row, [number]>(`SELECT ${COLS} FROM media WHERE id = ?`).get(id)

const clearVariants = (id: number) => {
	for (const f of readdirSync(CACHE_DIR))
		if (f.startsWith(`${id}-`)) rmSync(join(CACHE_DIR, f), { force: true })
}

async function analyze(path: string, mime: string) {
	if (!isProcessable(mime)) return { width: null, height: null, placeholder: null }
	try {
		const { width, height } = await new Bun.Image(path).metadata()
		const placeholder = await new Bun.Image(path).placeholder()
		return { width, height, placeholder }
	} catch {
		return { width: null, height: null, placeholder: null }
	}
}

export interface MediaQuery {
	folder?: string
	q?: string
	type?: 'image' | 'file'
	limit?: number
	offset?: number
}

export const media = {
	list(o: MediaQuery = {}): { items: Media[]; total: number } {
		const where: string[] = []
		const params: Record<string, string | number> = {}
		if (o.folder !== undefined) {
			where.push('folder = $folder')
			params.folder = o.folder
		}
		if (o.q) {
			where.push('(name LIKE $q OR alt LIKE $q)')
			params.q = `%${o.q}%`
		}
		if (o.type) where.push(o.type === 'image' ? "mime LIKE 'image/%'" : "mime NOT LIKE 'image/%'")
		const sql = `FROM media ${where.length ? `WHERE ${where.join(' AND ')}` : ''}`
		const total = db.query<{ n: number }, any>(`SELECT COUNT(*) AS n ${sql}`).get(params)!.n
		const items = db
			.query<Row, any>(`SELECT ${COLS} ${sql} ORDER BY id DESC LIMIT $limit OFFSET $offset`)
			.all({ ...params, limit: o.limit ?? 100, offset: o.offset ?? 0 })
			.map(map)
		return { items, total }
	},

	folders: () =>
		db
			.query<{ folder: string; n: number }, []>(
				'SELECT folder, COUNT(*) AS n FROM media GROUP BY folder ORDER BY folder',
			)
			.all(),

	get(id: number): Media | null {
		const r = getRow(id)
		return r ? map(r) : null
	},

	/** Absolute file info for serving */
	file(id: number) {
		const r = getRow(id)
		return r ? { ...map(r), path: filePath(r) } : null
	},

	async create(file: File, folder = ''): Promise<Media> {
		const mime = file.type || 'application/octet-stream'
		const ext = extname(file.name)
			.toLowerCase()
			.replace(/[^.a-z0-9]/g, '')
		const name = file.name.replace(/[/\\?%*:|"<>]/g, '-') || `upload${ext}`
		const stored = `${Bun.randomUUIDv7()}${ext}`
		const path = join(UPLOAD_DIR, stored)
		await Bun.write(path, file)
		const { width, height, placeholder } = await analyze(path, mime)
		const { id } = db
			.query<{ id: number }, any>(
				`INSERT INTO media (name, file, mime, size, width, height, placeholder, folder)
				 VALUES ($name, $stored, $mime, $size, $width, $height, $placeholder, $folder) RETURNING id`,
			)
			.get({ name, stored, mime, size: file.size, width, height, placeholder, folder })!
		changed()
		return media.get(id)!
	},

	update(id: number, input: { name?: string; alt?: string; folder?: string }): Media | null {
		const r = getRow(id)
		if (!r) return null
		db.query('UPDATE media SET name = ?, alt = ?, folder = ? WHERE id = ?').run(
			input.name?.trim() || r.name,
			input.alt ?? r.alt,
			input.folder ?? r.folder,
			id,
		)
		changed()
		return media.get(id)
	},

	/** Rotate the original in place (bumps version → new URLs, old variants dropped) */
	async rotate(id: number, degrees: 90 | 180 | 270): Promise<Media | null> {
		const r = getRow(id)
		if (!r || !isProcessable(r.mime) || r.mime === 'image/gif' || r.mime === 'image/bmp') return null
		const path = filePath(r)
		const bytes = await new Bun.Image(path).rotate(degrees).bytes()
		await Bun.write(path, bytes)
		const { width, height, placeholder } = await analyze(path, r.mime)
		db.query(
			'UPDATE media SET width = ?, height = ?, placeholder = ?, size = ?, version = version + 1 WHERE id = ?',
		).run(width, height, placeholder, bytes.byteLength, id)
		clearVariants(id)
		changed()
		return media.get(id)
	},

	remove(id: number): boolean {
		const r = getRow(id)
		if (!r) return false
		db.query('DELETE FROM media WHERE id = ?').run(id)
		rmSync(filePath(r), { force: true })
		clearVariants(id)
		changed()
		return true
	},

	count: () => db.query<{ n: number }, []>('SELECT COUNT(*) AS n FROM media').get()!.n,
}

const pending = new Map<string, Promise<string>>()
/** Resized/re-encoded variant, generated once with Bun.Image and cached on disk */
export function variant(m: Media & { path: string }, width: number, format?: Format): Promise<string> {
	const fmt = format ?? (m.mime === 'image/png' ? 'png' : m.mime === 'image/webp' ? 'webp' : 'jpeg')
	const target = join(CACHE_DIR, `${m.id}-${m.version}-${width}.${fmt}`)
	const running = pending.get(target)
	if (running) return running
	const job = (async () => {
		if (!(await Bun.file(target).exists())) {
			const img = new Bun.Image(m.path).resize(width, undefined, { fit: 'inside', withoutEnlargement: true })
			const bytes = await (fmt === 'webp'
				? img.webp({ quality: 80 })
				: fmt === 'png'
					? img.png()
					: img.jpeg({ quality: 82 })
			).bytes()
			await Bun.write(target, bytes)
		}
		return target
	})().finally(() => pending.delete(target))
	pending.set(target, job)
	return job
}
