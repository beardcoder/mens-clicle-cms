import { Database } from 'bun:sqlite'
import { mkdirSync } from 'node:fs'
import { CACHE_DIR, DB_FILE, UPLOAD_DIR } from './paths'

export { CACHE_DIR, DATA_DIR, UPLOAD_DIR } from './paths'

for (const dir of [UPLOAD_DIR, CACHE_DIR]) mkdirSync(dir, { recursive: true })

export const db = new Database(DB_FILE, {
	create: true,
	strict: true,
})

db.run('PRAGMA journal_mode = WAL')
db.run('PRAGMA synchronous = NORMAL')
db.run('PRAGMA foreign_keys = ON')
db.run('PRAGMA busy_timeout = 5000')

const now = "(strftime('%Y-%m-%dT%H:%M:%fZ'))"

/** Append-only list — `PRAGMA user_version` tracks how many have run */
const migrations = [
	`
	CREATE TABLE users (
		id INTEGER PRIMARY KEY,
		email TEXT NOT NULL UNIQUE COLLATE NOCASE,
		name TEXT NOT NULL DEFAULT '',
		password TEXT NOT NULL,
		created_at TEXT NOT NULL DEFAULT ${now}
	);
	CREATE TABLE sessions (
		id TEXT PRIMARY KEY,
		user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		expires_at INTEGER NOT NULL
	);
	CREATE TABLE pages (
		id INTEGER PRIMARY KEY,
		parent_id INTEGER REFERENCES pages(id) ON DELETE CASCADE,
		sort INTEGER NOT NULL DEFAULT 0,
		title TEXT NOT NULL,
		slug TEXT NOT NULL DEFAULT '',
		path TEXT NOT NULL DEFAULT '',
		status TEXT NOT NULL DEFAULT 'draft',
		nav INTEGER NOT NULL DEFAULT 1,
		data TEXT NOT NULL DEFAULT '{}',
		blocks TEXT NOT NULL DEFAULT '[]',
		created_at TEXT NOT NULL DEFAULT ${now},
		updated_at TEXT NOT NULL DEFAULT ${now}
	);
	CREATE INDEX pages_parent ON pages(parent_id, sort);
	CREATE INDEX pages_path ON pages(path);
	CREATE TABLE entries (
		id INTEGER PRIMARY KEY,
		collection TEXT NOT NULL,
		slug TEXT NOT NULL,
		title TEXT NOT NULL,
		status TEXT NOT NULL DEFAULT 'draft',
		data TEXT NOT NULL DEFAULT '{}',
		created_at TEXT NOT NULL DEFAULT ${now},
		updated_at TEXT NOT NULL DEFAULT ${now},
		UNIQUE (collection, slug)
	);
	CREATE TABLE media (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		name TEXT NOT NULL,
		file TEXT NOT NULL,
		mime TEXT NOT NULL,
		size INTEGER NOT NULL,
		width INTEGER,
		height INTEGER,
		placeholder TEXT,
		alt TEXT NOT NULL DEFAULT '',
		folder TEXT NOT NULL DEFAULT '',
		version INTEGER NOT NULL DEFAULT 1,
		created_at TEXT NOT NULL DEFAULT ${now}
	);
	CREATE TABLE settings (
		key TEXT PRIMARY KEY,
		data TEXT NOT NULL DEFAULT '{}'
	);
	`,
]

const { user_version } = db.query<{ user_version: number }, []>('PRAGMA user_version').get()!
db.transaction(() => {
	for (let i = user_version; i < migrations.length; i++) {
		db.exec(migrations[i]!)
		db.run(`PRAGMA user_version = ${i + 1}`)
	}
})()

export const json = <T>(value: string | null | undefined, fallback: T): T => {
	if (!value) return fallback
	try {
		return JSON.parse(value) as T
	} catch {
		return fallback
	}
}

// --- change tracking: every write bumps the revision, read caches key on it ---
let revision = 0
const listeners = new Set<() => void>()
export const changed = () => {
	revision++
	for (const fn of listeners) fn()
}
export const onChange = (fn: () => void) => listeners.add(fn)
export const currentRevision = () => revision
