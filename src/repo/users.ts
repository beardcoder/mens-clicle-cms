import { db } from '../db'
import type { User } from '../types'

const COLS = 'id, email, name, created_at AS createdAt'
const SESSION_DAYS = 14

export const users = {
	count: () => db.query<{ n: number }, []>('SELECT COUNT(*) AS n FROM users').get()!.n,

	list: () => db.query<User, []>(`SELECT ${COLS} FROM users ORDER BY name, email`).all(),

	get: (id: number) => db.query<User, [number]>(`SELECT ${COLS} FROM users WHERE id = ?`).get(id),

	async create(input: { email: string; name: string; password: string }): Promise<User> {
		const hash = await Bun.password.hash(input.password)
		return db
			.query<User, [string, string, string]>(
				`INSERT INTO users (email, name, password) VALUES (?, ?, ?) RETURNING ${COLS}`,
			)
			.get(input.email.trim(), input.name.trim(), hash)!
	},

	async update(id: number, input: { name?: string; password?: string }) {
		if (input.name !== undefined)
			db.query('UPDATE users SET name = ? WHERE id = ?').run(input.name.trim(), id)
		if (input.password)
			db.query('UPDATE users SET password = ? WHERE id = ?').run(await Bun.password.hash(input.password), id)
		return users.get(id)
	},

	remove: (id: number) => db.query('DELETE FROM users WHERE id = ?').run(id).changes > 0,

	/** Constant-ish time: always runs a hash verification */
	async verify(email: string, password: string): Promise<User | null> {
		const row = db
			.query<User & { password: string }, [string]>(`SELECT ${COLS}, password FROM users WHERE email = ?`)
			.get(email.trim())
		const ok = await Bun.password
			.verify(
				password,
				row?.password ??
					'$argon2id$v=19$m=65536,t=2,p=1$0Jhjc+c+CE93Sp/JTDAMS0D88Z6wmxGvxM/vWQf1UTM$dwN15uRvs76F7/oj25B9NmCnJaZDWtCqrUf7Bbeqnk4',
			)
			.catch(() => false)
		if (!row || !ok) return null
		const { password: _, ...user } = row
		return user
	},
}

export const sessions = {
	create(userId: number) {
		const id = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url')
		const expires = Date.now() + SESSION_DAYS * 864e5
		db.query('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)').run(id, userId, expires)
		return { id, expires: new Date(expires) }
	},

	user(id: string | undefined): User | null {
		if (!id) return null
		return (
			db
				.query<User, [string, number]>(
					`SELECT u.id, u.email, u.name, u.created_at AS createdAt FROM sessions s
					 JOIN users u ON u.id = s.user_id WHERE s.id = ? AND s.expires_at > ?`,
				)
				.get(id, Date.now()) ?? null
		)
	},

	remove: (id: string) => db.query('DELETE FROM sessions WHERE id = ?').run(id),
	prune: () => db.query('DELETE FROM sessions WHERE expires_at < ?').run(Date.now()),
}
