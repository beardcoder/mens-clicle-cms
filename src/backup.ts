// Backups: a .tar.gz with a consistent database snapshot (VACUUM INTO) and all uploads.
// Written as a stream (ustar + CompressionStream), so large media libraries never sit in memory.
// Restore runs offline via the CLI (`cms restore <file>`).
import type { Database } from 'bun:sqlite'
import { existsSync, readdirSync, renameSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { CACHE_DIR, DATA_DIR, DB_FILE, UPLOAD_DIR } from './paths'

const encoder = new TextEncoder()

/** 512-byte ustar header for a regular file */
function tarHeader(name: string, size: number, mtime: number) {
	const block = new Uint8Array(512)
	const put = (value: string, offset: number) => block.set(encoder.encode(value), offset)
	const octal = (n: number, width: number) => `${n.toString(8).padStart(width - 1, '0')}\0`
	put(name.slice(0, 100), 0)
	put(octal(0o644, 8), 100)
	put(octal(0, 8), 108)
	put(octal(0, 8), 116)
	put(octal(size, 12), 124)
	put(octal(Math.floor(mtime / 1000), 12), 136)
	put('        ', 148) // checksum placeholder
	put('0', 156)
	put('ustar\0' + '00', 257)
	const sum = block.reduce((a, b) => a + b, 0)
	put(`${sum.toString(8).padStart(6, '0')}\0 `, 148)
	return block
}

async function* tarEntries(files: [name: string, path: string][]) {
	for (const [name, path] of files) {
		const file = Bun.file(path)
		yield tarHeader(name, file.size, file.lastModified)
		yield* file.stream()
		const pad = (512 - (file.size % 512)) % 512
		if (pad) yield new Uint8Array(pad)
	}
	yield new Uint8Array(1024) // end-of-archive marker
}

/** Gzipped tarball of `files` (archive name → path); pulled lazily, so it respects backpressure */
function tarGz(files: [name: string, path: string][], onDone: () => void) {
	async function* run() {
		try {
			yield* tarEntries(files)
		} finally {
			onDone()
		}
	}
	const chunks = run()
	const tar = new ReadableStream<Uint8Array>({
		async pull(controller) {
			const { value, done } = await chunks.next()
			if (done) controller.close()
			else controller.enqueue(value)
		},
		async cancel() {
			await chunks.return(undefined)
		},
	})
	return tar.pipeThrough<Uint8Array>(
		new CompressionStream('gzip') as ReadableWritablePair<Uint8Array, Uint8Array>,
	)
}

export function backupStream(db: Database) {
	const snapshot = join(CACHE_DIR, `backup-${Bun.randomUUIDv7()}.db`)
	db.run('VACUUM INTO ?', [snapshot])
	const files: [string, string][] = [['cms.db', snapshot]]
	for (const name of readdirSync(UPLOAD_DIR)) files.push([`uploads/${name}`, join(UPLOAD_DIR, name)])
	return tarGz(files, () => rmSync(snapshot, { force: true }))
}

/** Replace database and uploads with the contents of a backup (server must not be running) */
export async function restoreBackup(file: string) {
	if (!existsSync(file)) throw new Error(`Backup nicht gefunden: ${file}`)
	const archive = new Bun.Archive(await Bun.file(file).bytes())
	for (const suffix of ['', '-wal', '-shm']) rmSync(DB_FILE + suffix, { force: true })
	rmSync(CACHE_DIR, { recursive: true, force: true })
	const count = await archive.extract(DATA_DIR)
	const extracted = join(DATA_DIR, 'cms.db')
	if (extracted !== DB_FILE && existsSync(extracted)) renameSync(extracted, DB_FILE)
	return count
}
