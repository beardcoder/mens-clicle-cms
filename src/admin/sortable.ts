// Drag & drop sorting with the native HTML5 DnD API. Only the handle is draggable (so text in
// inputs stays selectable); the whole item is the drop target. Lists can be nested: each list
// only reacts to drags that started inside itself.
import { useMemo, useState } from 'preact/hooks'

let active: { list: symbol; index: number } | null = null

export const moveItem = <T>(items: T[], from: number, to: number) => {
	const next = [...items]
	const [item] = next.splice(from, 1)
	next.splice(to > from ? to - 1 : to, 0, item!)
	return next
}

export function useSortable<T>(items: T[], onChange: (items: T[]) => void) {
	const list = useMemo(() => Symbol('sortable'), [])
	const [dragging, setDragging] = useState<number | null>(null)
	const [target, setTarget] = useState<number | null>(null)

	const reset = () => {
		active = null
		setDragging(null)
		setTarget(null)
	}

	return {
		dragging,
		/** index the dragged item would be inserted at (0…length) */
		target,
		/** spread on the drag handle */
		handle: (index: number) => ({
			draggable: true,
			class: 'drag-handle',
			title: 'Ziehen zum Verschieben',
			onDragStart: (e: DragEvent) => {
				e.stopPropagation()
				active = { list, index }
				const item = (e.currentTarget as HTMLElement).closest('[data-sortable]')
				e.dataTransfer!.effectAllowed = 'move'
				e.dataTransfer!.setData('text/plain', String(index))
				if (item) e.dataTransfer!.setDragImage(item, 20, 20)
				setDragging(index)
			},
			onDragEnd: reset,
		}),
		/** spread on the item element */
		item: (index: number) => ({
			'data-sortable': '',
			onDragOver: (e: DragEvent) => {
				if (active?.list !== list) return
				e.preventDefault()
				e.stopPropagation()
				const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
				const next = e.clientY < rect.top + rect.height / 2 ? index : index + 1
				if (next !== target) setTarget(next)
			},
			onDrop: (e: DragEvent) => {
				if (active?.list !== list) return
				e.preventDefault()
				e.stopPropagation()
				const from = active.index
				if (target !== null && target !== from && target !== from + 1) onChange(moveItem(items, from, target))
				reset()
			},
		}),
	}
}
