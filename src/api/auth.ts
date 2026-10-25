import { type Cookie, Elysia, status, t } from 'elysia'
import { sessions, users } from '../repo/users'

/** Resolves the current user from the session cookie; `{ auth: true }` guards a route */
export const auth = new Elysia({ name: 'auth' })
	.derive('plugin', ({ cookie }) => ({ user: sessions.user(cookie.session?.value as string | undefined) }))
	.macro({
		auth: { derive: ({ user }) => (user ? { user } : status(401, 'Nicht angemeldet')) },
	})

/** HTTPS directly or behind a TLS-terminating proxy (Coolify/Traefik, Caddy, …) */
const isHttps = (request: Request) =>
	new URL(request.url).protocol === 'https:' || request.headers.get('x-forwarded-proto') === 'https'

// the last X-Forwarded-For entry is the one added by our own reverse proxy (not client-controlled)
const clientIp = (request: Request, server: { requestIP(r: Request): { address: string } | null } | null) =>
	request.headers.get('x-forwarded-for')?.split(',').at(-1)?.trim() ||
	server?.requestIP(request)?.address ||
	'unknown'

// Brute-force protection: failed logins per client IP within a sliding window
const WINDOW = 15 * 60_000
const MAX_FAILURES = 10
const failures = new Map<string, number[]>()
const recentFailures = (ip: string) => {
	const now = Date.now()
	const list = (failures.get(ip) ?? []).filter((t) => now - t < WINDOW)
	if (list.length) failures.set(ip, list)
	else failures.delete(ip)
	return list
}

const startSession = (cookie: Record<string, Cookie<unknown>>, userId: number, request: Request) => {
	const session = sessions.create(userId)
	cookie.session!.set({
		value: session.id,
		expires: session.expires,
		httpOnly: true,
		sameSite: 'strict',
		secure: isHttps(request),
		path: '/',
	})
}

const Credentials = t.Object({ email: t.String({ format: 'email' }), password: t.String({ minLength: 1 }) })

export const authApi = new Elysia({ prefix: '/api/auth' })
	.use(auth)
	.get('/me', ({ user }) => ({ user, setup: !user && users.count() === 0 }))
	.post(
		'/setup',
		{
			body: t.Object({
				email: t.String({ format: 'email' }),
				name: t.String({ minLength: 1 }),
				password: t.String({ minLength: 8 }),
			}),
		},
		async ({ body, cookie, request }) => {
			if (users.count() > 0) return status(403, 'Setup bereits abgeschlossen')
			const user = await users.create(body)
			startSession(cookie, user.id, request)
			return user
		},
	)
	.post('/login', { body: Credentials }, async ({ body, cookie, request, server }) => {
		const ip = clientIp(request, server)
		if (recentFailures(ip).length >= MAX_FAILURES)
			return status(429, 'Zu viele Fehlversuche – bitte in 15 Minuten erneut versuchen')
		const user = await users.verify(body.email, body.password)
		if (!user) {
			failures.set(ip, [...recentFailures(ip), Date.now()])
			return status(401, 'E-Mail oder Passwort falsch')
		}
		failures.delete(ip)
		sessions.prune()
		startSession(cookie, user.id, request)
		return user
	})
	.post('/logout', ({ cookie }) => {
		if (cookie.session?.value) sessions.remove(cookie.session.value as string)
		cookie.session?.remove()
		return { ok: true }
	})

export const usersApi = new Elysia({ prefix: '/api/users' }).use(auth).guard({ auth: true }, (app) =>
	app
		.get('', () => users.list())
		.post(
			'',
			{
				body: t.Object({
					email: t.String({ format: 'email' }),
					name: t.String(),
					password: t.String({ minLength: 8 }),
				}),
			},
			async ({ body }) => {
				try {
					return await users.create(body)
				} catch {
					return status(409, 'E-Mail wird bereits verwendet')
				}
			},
		)
		.put(
			'/me',
			{ body: t.Object({ name: t.Optional(t.String()), password: t.Optional(t.String({ minLength: 8 })) }) },
			({ user, body }) => users.update(user.id, body),
		)
		.delete('/:id', { params: t.Object({ id: t.Number() }) }, ({ params, user }) => {
			if (params.id === user.id) return status(400, 'Eigenes Konto kann nicht gelöscht werden')
			return users.remove(params.id) ? { ok: true } : status(404, 'Nicht gefunden')
		}),
)
