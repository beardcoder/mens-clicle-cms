import { AsyncLocalStorage } from 'node:async_hooks'
import type { ExpandOptions } from '../expand'
import type { Data, PageSummary } from '../types'

export interface NavItem extends PageSummary {
	children: NavItem[]
}

export interface Site {
	settings: Record<string, Data>
	nav: NavItem[]
	path: string
	lang: string
	preview: boolean
	expand: ExpandOptions
}

// Request-scoped render context for templates (Kita JSX has no context API)
const storage = new AsyncLocalStorage<Site>()
export const withSite = <T>(site: Site, render: () => T) => storage.run(site, render)
export const useSite = () => {
	const site = storage.getStore()
	if (!site) throw new Error('useSite() called outside of a render')
	return site
}

export const formatDate = (value: string | undefined, lang: string, withTime = value?.includes('T')) => {
	if (!value) return ''
	const date = new Date(value)
	if (Number.isNaN(date.valueOf())) return value
	return new Intl.DateTimeFormat(lang, {
		dateStyle: 'long',
		...(withTime ? { timeStyle: 'short' } : {}),
		timeZone: withTime ? undefined : 'UTC',
	}).format(date)
}
