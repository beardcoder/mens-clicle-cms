import { Elysia, status } from 'elysia'
import admin from './admin/index.html'
import { authApi, usersApi } from './api/auth'
import { configApi, entriesApi, mediaApi, pagesApi, settingsApi } from './api/content'
import { publicApi } from './api/public'
import { ContentError } from './fields'
import { site } from './site'

const MAX_UPLOAD_MB = Number(process.env.MAX_UPLOAD_MB ?? 64)

export const app = new Elysia({ serve: { maxRequestBodySize: MAX_UPLOAD_MB * 1024 * 1024 } })
	.headers({
		'x-content-type-options': 'nosniff',
		'x-frame-options': 'SAMEORIGIN',
		'referrer-policy': 'strict-origin-when-cross-origin',
	})
	.onError(ContentError, ({ error }) => status(422, { message: 'Ungültige Eingabe', issues: error.issues }))
	.get('/api/health', () => ({ ok: true }))
	.use(authApi)
	.use(usersApi)
	.use(configApi)
	.use(pagesApi)
	.use(entriesApi)
	.use(settingsApi)
	.use(mediaApi)
	.use(publicApi)
	.all('/api/*', () => status(404, 'Nicht gefunden'))
	// Admin SPA: Bun bundles the HTML import (HMR in development, embedded in the compiled binary)
	.get('/admin', admin)
	.get('/admin/*', admin)
	.use(site)

export type App = typeof app
