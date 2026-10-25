import { useState } from 'preact/hooks'
import { defaults } from '../../shared'
import type { Data, Field } from '../../types'
import { useSortable } from '../sortable'
import { uid } from '../ui'
import { type FieldProps, Fields } from './Fields'

/** Short text describing an item while collapsed */
export function summarize(fields: Field[], data: Data, prefer?: string): string {
	const pick = (v: any): string => {
		if (!v) return ''
		if (typeof v === 'string') return v.replace(/<[^>]*>/g, ' ').trim()
		if (typeof v === 'object' && 'label' in v) return v.label || v.href || ''
		return ''
	}
	if (prefer) return pick(data[prefer])
	for (const f of fields) {
		const text = pick(data[f.name])
		if (text && ['text', 'textarea', 'richtext', 'markdown', 'link', 'select'].includes(f.type)) return text
	}
	return ''
}

export function Repeater({ field, value, onChange }: FieldProps<Data[]>) {
	const fields = field.fields ?? []
	const [open, setOpen] = useState<Set<string>>(() => new Set(value.length === 1 ? [value[0]!._id] : []))
	const sortable = useSortable(value, onChange)
	const toggle = (id: string) => {
		const next = new Set(open)
		next.has(id) ? next.delete(id) : next.add(id)
		setOpen(next)
	}
	const add = () => {
		const item = { _id: uid(), ...defaults(fields) }
		onChange([...value, item])
		setOpen(new Set([...open, item._id]))
	}
	const full = field.max !== undefined && value.length >= field.max

	return (
		<div class="repeater">
			{value.map((item, i) => {
				const isOpen = open.has(item._id)
				return (
					<div
						key={item._id}
						class={`repeater-item ${sortable.dragging === i ? 'dragging' : ''} ${sortable.target === i ? 'drop-before' : ''} ${sortable.target === i + 1 && i === value.length - 1 ? 'drop-after' : ''}`}
						{...sortable.item(i)}
					>
						<div class="item-head">
							<span {...sortable.handle(i)}>⠿</span>
							<button type="button" class="item-title" onClick={() => toggle(item._id)}>
								<span class="caret">{isOpen ? '▾' : '▸'}</span>
								<span class="num">{i + 1}.</span>{' '}
								{summarize(fields, item, field.itemLabel) || <em>Eintrag</em>}
							</button>
							<button
								type="button"
								class="icon"
								title="Duplizieren"
								disabled={full}
								onClick={() => {
									const copy = { ...structuredClone(item), _id: uid() }
									onChange([...value.slice(0, i + 1), copy, ...value.slice(i + 1)])
								}}
							>
								⧉
							</button>
							<button
								type="button"
								class="icon danger"
								title="Entfernen"
								onClick={() => onChange(value.filter((_, j) => j !== i))}
							>
								🗑
							</button>
						</div>
						{isOpen && (
							<div class="item-body">
								<Fields
									fields={fields}
									value={item}
									onChange={(v) => onChange(value.map((x, j) => (j === i ? v : x)))}
								/>
							</div>
						)}
					</div>
				)
			})}
			<button type="button" class="add" onClick={add} disabled={full}>
				+ {field.label ? `${field.label}: ` : ''}Eintrag hinzufügen
			</button>
		</div>
	)
}
