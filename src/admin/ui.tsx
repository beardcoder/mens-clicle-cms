import type { ComponentChildren } from 'preact'
import { useEffect, useRef, useState } from 'preact/hooks'
import { toasts } from './state'

/** Native <dialog> modal */
export function Modal({
	title,
	onClose,
	children,
	wide,
}: {
	title: string
	onClose: () => void
	children: ComponentChildren
	wide?: boolean
}) {
	const ref = useRef<HTMLDialogElement>(null)
	useEffect(() => {
		ref.current?.showModal()
	}, [])
	return (
		<dialog
			ref={ref}
			class={wide ? 'modal wide' : 'modal'}
			onClose={onClose}
			onClick={(e) => e.target === ref.current && ref.current?.close()}
		>
			<header>
				<h2>{title}</h2>
				<button type="button" class="icon" onClick={() => ref.current?.close()} aria-label="Schließen">
					✕
				</button>
			</header>
			<div class="modal-body">{children}</div>
		</dialog>
	)
}

export function Toasts() {
	return (
		<div class="toasts" aria-live="polite">
			{toasts.value.map((t) => (
				<div key={t.id} class={`toast ${t.kind}`}>
					{t.text}
				</div>
			))}
		</div>
	)
}

export const StatusBadge = ({ status }: { status: string }) => (
	<span class={`badge ${status}`}>{status === 'published' ? 'Veröffentlicht' : 'Entwurf'}</span>
)

/** Run an async action while showing a busy state */
export function useBusy() {
	const [busy, setBusy] = useState(false)
	const run = async <T,>(fn: () => Promise<T>) => {
		setBusy(true)
		try {
			return await fn()
		} finally {
			setBusy(false)
		}
	}
	return [busy, run] as const
}

/** Ctrl/Cmd+S */
export function useSaveShortcut(save: () => void) {
	const ref = useRef(save)
	ref.current = save
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if ((e.metaKey || e.ctrlKey) && e.key === 's') {
				e.preventDefault()
				ref.current()
			}
		}
		addEventListener('keydown', onKey)
		return () => removeEventListener('keydown', onKey)
	}, [])
}

export const formatBytes = (n: number) =>
	n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1048576).toFixed(1)} MB`

export const formatDate = (iso: string) =>
	new Intl.DateTimeFormat('de', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso))

export const uid = () => crypto.randomUUID()
