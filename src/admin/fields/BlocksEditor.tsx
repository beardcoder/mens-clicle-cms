import { useState } from 'preact/hooks'
import { defaults } from '../../shared'
import type { Block, BlockDef } from '../../types'
import { moveItem, useSortable } from '../sortable'
import { config } from '../state'
import { Modal, uid } from '../ui'
import { Fields } from './Fields'
import { summarize } from './Repeater'

function BlockPicker({
	allow,
	onPick,
	onClose,
}: {
	allow?: string[]
	onPick: (type: string) => void
	onClose: () => void
}) {
	const [q, setQ] = useState('')
	const blocks = Object.entries(config.value!.blocks).filter(
		([type, def]) =>
			(!allow || allow.includes(type)) &&
			`${type} ${def.label} ${def.description ?? ''}`.toLowerCase().includes(q.toLowerCase()),
	)
	const groups = Map.groupBy(blocks, ([, def]) => def.category ?? 'Allgemein')
	return (
		<Modal title="Block hinzufügen" onClose={onClose} wide>
			<input
				type="search"
				placeholder="Suchen…"
				value={q}
				onInput={(e) => setQ(e.currentTarget.value)}
				autoFocus
				class="picker-search"
			/>
			{[...groups].map(([category, items]) => (
				<section key={category} class="picker-group">
					<h3>{category}</h3>
					<div class="picker-grid">
						{items.map(([type, def]) => (
							<button key={type} type="button" class="picker-item" onClick={() => onPick(type)}>
								<span class="picker-icon">{def.icon ?? '▦'}</span>
								<strong>{def.label}</strong>
								{def.description && <small>{def.description}</small>}
							</button>
						))}
					</div>
				</section>
			))}
		</Modal>
	)
}

function BlockCard({
	block,
	def,
	index,
	count,
	open,
	sortable,
	onToggle,
	onChange,
	onMove,
	onDuplicate,
	onRemove,
	onInsert,
}: {
	block: Block
	def: BlockDef | undefined
	index: number
	count: number
	open: boolean
	sortable: ReturnType<typeof useSortable<Block>>
	onToggle: () => void
	onChange: (b: Block) => void
	onMove: (to: number) => void
	onDuplicate: () => void
	onRemove: () => void
	onInsert: () => void
}) {
	const cls = [
		'block-card',
		block.hidden && 'is-hidden',
		sortable.dragging === index && 'dragging',
		sortable.target === index && 'drop-before',
		sortable.target === index + 1 && index === count - 1 && 'drop-after',
	]
	return (
		<div class={cls.filter(Boolean).join(' ')} {...sortable.item(index)}>
			<div class="block-head">
				<span {...sortable.handle(index)}>⠿</span>
				<button type="button" class="block-title" onClick={onToggle}>
					<span class="block-icon">{def?.icon ?? '▦'}</span>
					<strong>{def?.label ?? `Unbekannt: ${block.type}`}</strong>
					<span class="summary">{def && summarize(def.fields, block.data)}</span>
				</button>
				<div class="block-actions">
					<button
						type="button"
						class="icon"
						title="Nach oben"
						disabled={index === 0}
						onClick={() => onMove(index - 1)}
					>
						↑
					</button>
					<button
						type="button"
						class="icon"
						title="Nach unten"
						disabled={index === count - 1}
						onClick={() => onMove(index + 2)}
					>
						↓
					</button>
					<button
						type="button"
						class="icon"
						title={block.hidden ? 'Einblenden' : 'Ausblenden'}
						onClick={() => onChange({ ...block, hidden: !block.hidden })}
					>
						{block.hidden ? '🙈' : '👁'}
					</button>
					<button type="button" class="icon" title="Block darunter einfügen" onClick={onInsert}>
						＋
					</button>
					<button type="button" class="icon" title="Duplizieren" onClick={onDuplicate}>
						⧉
					</button>
					<button type="button" class="icon danger" title="Löschen" onClick={onRemove}>
						🗑
					</button>
				</div>
			</div>
			{open && def && (
				<div class="block-body">
					<Fields fields={def.fields} value={block.data} onChange={(data) => onChange({ ...block, data })} />
				</div>
			)}
		</div>
	)
}

export function BlocksEditor({
	value,
	onChange,
	allow,
}: {
	value: Block[]
	onChange: (blocks: Block[]) => void
	allow?: string[]
}) {
	const [open, setOpen] = useState<Set<string>>(new Set())
	const [picker, setPicker] = useState<number | null>(null)
	const sortable = useSortable(value, onChange)
	const blocks = config.value!.blocks

	const insert = (type: string, at: number) => {
		const block: Block = { id: uid(), type, data: defaults(blocks[type]!.fields) }
		onChange([...value.slice(0, at), block, ...value.slice(at)])
		setOpen(new Set([...open, block.id]))
		setPicker(null)
	}
	const toggle = (id: string) => {
		const next = new Set(open)
		next.has(id) ? next.delete(id) : next.add(id)
		setOpen(next)
	}

	return (
		<div class="blocks-editor">
			{value.length > 1 && (
				<div class="blocks-toolbar">
					<button type="button" class="link" onClick={() => setOpen(new Set(value.map((b) => b.id)))}>
						Alle aufklappen
					</button>
					<button type="button" class="link" onClick={() => setOpen(new Set())}>
						Alle zuklappen
					</button>
				</div>
			)}
			{value.length === 0 && <p class="empty">Noch keine Blöcke.</p>}
			{value.map((block, i) => (
				<BlockCard
					key={block.id}
					block={block}
					def={blocks[block.type]}
					index={i}
					count={value.length}
					open={open.has(block.id)}
					sortable={sortable}
					onToggle={() => toggle(block.id)}
					onChange={(b) => onChange(value.map((x, j) => (j === i ? b : x)))}
					onMove={(to) => onChange(moveItem(value, i, to))}
					onDuplicate={() => {
						const copy = { ...structuredClone(block), id: uid() }
						onChange([...value.slice(0, i + 1), copy, ...value.slice(i + 1)])
					}}
					onRemove={() => confirm('Block löschen?') && onChange(value.filter((_, j) => j !== i))}
					onInsert={() => setPicker(i + 1)}
				/>
			))}
			<button type="button" class="add" onClick={() => setPicker(value.length)}>
				+ Block hinzufügen
			</button>
			{picker !== null && (
				<BlockPicker allow={allow} onPick={(type) => insert(type, picker)} onClose={() => setPicker(null)} />
			)}
		</div>
	)
}
