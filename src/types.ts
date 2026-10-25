// Shared types — imported by the server and (type-only) by the admin UI.

export const FIELD_TYPES = [
	'text',
	'textarea',
	'richtext',
	'markdown',
	'code',
	'number',
	'boolean',
	'select',
	'multiselect',
	'date',
	'datetime',
	'time',
	'color',
	'email',
	'url',
	'link',
	'image',
	'file',
	'gallery',
	'relation',
	'page',
	'tags',
	'repeater',
	'group',
	'blocks',
] as const

export type FieldType = (typeof FIELD_TYPES)[number]

export type Option = string | { value: string; label: string }

export interface Field {
	name: string
	type: FieldType
	label?: string
	help?: string
	placeholder?: string
	required?: boolean
	default?: unknown
	/** Layout hint for the admin form grid */
	width?: 'full' | 'half' | 'third'
	/** number: value range · text: max length · repeater/gallery/tags/multiselect: item count */
	min?: number
	max?: number
	step?: number
	/** textarea / code / markdown rows */
	rows?: number
	/** select / multiselect */
	options?: Option[]
	/** repeater / group */
	fields?: Field[]
	/** repeater: field used as title of a collapsed item */
	itemLabel?: string
	/** relation: target collection */
	collection?: string
	/** relation / page: allow multiple references */
	multiple?: boolean
	/** file: accepted mime pattern, e.g. "application/pdf" or "image/*" */
	accept?: string
	/** blocks: allowed block types (default: all) */
	allow?: string[]
}

export interface BlockDef {
	label: string
	icon?: string
	category?: string
	description?: string
	fields: Field[]
}

export interface CollectionDef {
	label: string
	singular?: string
	icon?: string
	/** URL prefix for entry detail pages, e.g. "/news" → /news/:slug */
	route?: string
	/** Data field holding the date used for sorting and upcoming/past filters */
	dateField?: string
	sort?: { field: string; order?: 'asc' | 'desc' }
	/** Columns shown in the admin list (besides title) */
	columns?: string[]
	fields: Field[]
}

export interface SettingsGroupDef {
	label: string
	icon?: string
	fields: Field[]
}

export interface Config {
	$schema?: string
	page?: { fields: Field[] }
	blocks: Record<string, BlockDef>
	collections: Record<string, CollectionDef>
	settings: Record<string, SettingsGroupDef>
}

export type Data = Record<string, any>
export type Status = 'draft' | 'published'

export interface Block {
	id: string
	type: string
	hidden?: boolean
	data: Data
}

export interface PageSummary {
	id: number
	parentId: number | null
	sort: number
	title: string
	slug: string
	path: string
	status: Status
	nav: boolean
	updatedAt: string
}

export interface Page extends PageSummary {
	data: Data
	blocks: Block[]
	createdAt: string
}

export interface Entry {
	id: number
	collection: string
	slug: string
	title: string
	status: Status
	data: Data
	createdAt: string
	updatedAt: string
	url?: string
}

export interface Media {
	id: number
	name: string
	mime: string
	size: number
	width: number | null
	height: number | null
	placeholder: string | null
	alt: string
	folder: string
	version: number
	createdAt: string
	url: string
}

export interface User {
	id: number
	email: string
	name: string
	createdAt: string
}
