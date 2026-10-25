import { Elysia, status } from 'elysia'
import admin from './admin/index.html'
import { authApi, usersApi } from './api/auth'
import { configApi, entriesApi, mediaApi, pagesApi, settingsApi } from './api/content'
import { publicApi } from './api/public'
import { ContentError } from './fields'
import { site } from './site'

export const app = new Elysia()
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
	// Admin SPA: Bun bundles the HTML import (HMR in development, embedded in the compiled binary)
	.get('/admin', admin)
	.get('/admin/*', admin)
	.use(site)

export type App = typeof app
