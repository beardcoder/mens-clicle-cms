import { useEffect, useState } from 'preact/hooks'
import type { Data, PageSummary } from '../../types'
import { get } from '../api'
import { pageList } from '../state'
import type { FieldProps } from './Fields'

export function TagsField({ value, onChange }: FieldProps<string[]>) {
	const [input, setInput] = useState('')
	const add = () => {
		const tag = input.trim()
		if (tag && !value.includes(tag)) onChange([...value, tag])
		setInput('')
	}
	return (
		<div class="tags-input">
			{value.map((t) => (
				<span key={t} class="chip">
					{t}
					<button type="button" onClick={() => onChange(value.filter((v) => v !== t))} aria-label="Entfernen">
						✕
					</button>
				</span>
			))}
			<input
				value={input}
				placeholder="Hinzufügen + Enter"
				onInput={(e) => setInput(e.currentTarget.value)}
				onKeyDown={(e) => {
					if (e.key === 'Enter' || e.key === ',') {
						e.preventDefault()
						add()
					} else if (e.key === 'Backspace' && !input && value.length) onChange(value.slice(0, -1))
				}}
				onBlur={add}
			/>
		</div>
	)
}

/** Pages as an indented flat list in tree order */
export function pageOptions(pages: PageSummary[]) {
	const out: { page: PageSummary; depth: number }[] = []
	const walk = (parentId: number | null, depth: number) => {
		for (const p of pages.filter((x) => x.parentId === parentId)) {
			out.push({ page: p, depth })
			walk(p.id, depth + 1)
		}
	}
	walk(null, 0)
	return out
}

export function PageSelect({
	value,
	onChange,
}: {
	value: number | null
	onChange: (id: number | null) => void
}) {
	return (
		<select
			value={value ?? ''}
			onChange={(e) => onChange(e.currentTarget.value ? Number(e.currentTarget.value) : null)}
		>
			<option value="">– keine Seite –</option>
			{pageOptions(pageList.value).map(({ page, depth }) => (
				<option key={page.id} value={page.id}>
					{'  '.repeat(depth)}
					{page.title} ({page.path})
				</option>
			))}
		</select>
	)
}

export function LinkField({ value, onChange }: FieldProps<Data | null>) {
	const link = value ?? { href: '', label: '', page: null }
	const [mode, setMode] = useState<'page' | 'url'>(link.page ? 'page' : 'url')
	const set = (patch: Data) => onChange({ href: '', label: '', ...link, ...patch })
	return (
		<div class="link-field">
			<div class="segmented">
				<button type="button" class={mode === 'page' ? 'on' : ''} onClick={() => setMode('page')}>
					Seite
				</button>
				<button type="button" class={mode === 'url' ? 'on' : ''} onClick={() => setMode('url')}>
					URL
				</button>
			</div>
			{mode === 'page' ? (
				<PageSelect value={link.page ?? null} onChange={(page) => set({ page, href: '' })} />
			) : (
				<input
					type="text"
					placeholder="https://… oder /pfad"
					value={link.href}
					onInput={(e) => set({ href: e.currentTarget.value, page: null })}
				/>
			)}
			<input
				type="text"
				placeholder="Linktext"
				value={link.label ?? ''}
				onInput={(e) => set({ label: e.currentTarget.value })}
			/>
			<label class="inline">
				<input
					type="checkbox"
					checked={link.target === '_blank'}
					onChange={(e) => set({ target: e.currentTarget.checked ? '_blank' : '' })}
				/>
				Neuer Tab
			</label>
			{(link.href || link.page) && (
				<button type="button" class="icon" title="Link entfernen" onClick={() => onChange(null)}>
					✕
				</button>
			)}
		</div>
	)
}

type Option = { id: number; title: string; status: string }
const optionCache = new Map<string, Promise<Option[]>>()

export function RelationField({ field, value, onChange }: FieldProps<number | number[] | null>) {
	const [options, setOptions] = useState<Option[]>([])
	useEffect(() => {
		const key = field.collection!
		if (!optionCache.has(key)) optionCache.set(key, get<Option[]>(`/collections/${key}/options`))
		optionCache.get(key)!.then(setOptions)
		return () => optionCache.delete(key)
	}, [field.collection])

	if (!field.multiple)
		return (
			<select
				value={(value as number | null) ?? ''}
				onChange={(e) => onChange(e.currentTarget.value ? Number(e.currentTarget.value) : null)}
			>
				<option value="">– keine Auswahl –</option>
				{options.map((o) => (
					<option key={o.id} value={o.id}>
						{o.title}
					</option>
				))}
			</select>
		)

	const selected = (value as number[] | null) ?? []
	return (
		<div class="relation">
			{selected.map((id) => (
				<span key={id} class="chip">
					{options.find((o) => o.id === id)?.title ?? `#${id}`}
					<button
						type="button"
						onClick={() => onChange(selected.filter((v) => v !== id))}
						aria-label="Entfernen"
					>
						✕
					</button>
				</span>
			))}
			<select
				value=""
				onChange={(e) => {
					const id = Number(e.currentTarget.value)
					if (id && !selected.includes(id)) onChange([...selected, id])
				}}
			>
				<option value="">+ hinzufügen…</option>
				{options
					.filter((o) => !selected.includes(o.id))
					.map((o) => (
						<option key={o.id} value={o.id}>
							{o.title}
						</option>
					))}
			</select>
		</div>
	)
}
