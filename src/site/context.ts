import { createContext } from 'preact'
import { useContext } from 'preact/hooks'
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

export const SiteContext = createContext<Site>(null as unknown as Site)
export const useSite = () => useContext(SiteContext)

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
