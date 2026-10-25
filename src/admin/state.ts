import { signal } from '@preact/signals'
import type { Config, Media, PageSummary, User } from '../types'
import { ApiError, get, setUnauthorizedHandler } from './api'

export const user = signal<User | null | undefined>(undefined)
export const needsSetup = signal(false)
export const config = signal<Config | null>(null)
export const pageList = signal<PageSummary[]>([])

setUnauthorizedHandler(() => {
	user.value = null
})

export async function boot() {
	const me = await get<{ user: User | null; setup: boolean }>('/auth/me')
	needsSetup.value = me.setup
	if (me.user) {
		config.value = await get<Config>('/config')
		await refreshPages()
	}
	user.value = me.user
}

export const refreshPages = async () => {
	pageList.value = await get<PageSummary[]>('/pages')
}

// --- media lookup cache (for field previews) ---
const mediaCache = new Map<number, Promise<Media | null>>()
export const cacheMedia = (m: Media) => mediaCache.set(m.id, Promise.resolve(m))
export const loadMedia = (id: number) => {
	let p = mediaCache.get(id)
	if (!p) {
		p = get<Media>(`/media/${id}`).catch(() => null)
		mediaCache.set(id, p)
	}
	return p
}
export const forgetMedia = (id: number) => mediaCache.delete(id)

// --- toasts ---
export interface Toast {
	id: number
	text: string
	kind: 'ok' | 'error'
}
export const toasts = signal<Toast[]>([])
let toastId = 0
export function toast(text: string, kind: Toast['kind'] = 'ok') {
	const id = ++toastId
	toasts.value = [...toasts.value, { id, text, kind }]
	setTimeout(() => (toasts.value = toasts.value.filter((t) => t.id !== id)), kind === 'error' ? 7000 : 2500)
}
export function toastError(e: unknown) {
	if (e instanceof ApiError && e.issues.length)
		toast(`${e.message}: ${e.issues.map((i) => `${i.path} ${i.message}`).join(' · ')}`, 'error')
	else toast(e instanceof Error ? e.message : String(e), 'error')
}

// --- router (History API, everything below /admin) ---
export const route = signal(location.pathname)
export const dirty = signal(false)

export function navigate(to: string, replace = false) {
	if (to === route.value) return
	if (dirty.value && !confirm('Ungespeicherte Änderungen verwerfen?')) return
	dirty.value = false
	history[replace ? 'replaceState' : 'pushState'](null, '', to)
	route.value = to
	window.scrollTo(0, 0)
}

addEventListener('popstate', () => {
	route.value = location.pathname
})
addEventListener('beforeunload', (e) => {
	if (dirty.value) e.preventDefault()
})
// Client-side navigation for plain <a href="/admin/..."> links
addEventListener('click', (e: MouseEvent) => {
	const a = (e.target as Element).closest?.('a')
	if (!a || a.target || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
	const href = a.getAttribute('href')
	if (href?.startsWith('/admin')) {
		e.preventDefault()
		navigate(href)
	}
})
