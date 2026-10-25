import { useEffect, useState } from 'preact/hooks'
import type { Page, PageSummary } from '../../types'
import { del, get, post, put } from '../api'
import { BlocksEditor } from '../fields/BlocksEditor'
import { Fields } from '../fields/Fields'
import { config, dirty, navigate, pageList, refreshPages, toast, toastError } from '../state'
import { StatusBadge, useBusy, useSaveShortcut } from '../ui'

type DropPos = 'before' | 'after' | 'inside'

function PageTree({ currentId }: { currentId?: number }) {
	const pages = pageList.value
	const [dragId, setDragId] = useState<number | null>(null)
	const [drop, setDrop] = useState<{ id: number; pos: DropPos } | null>(null)

	const children = (parentId: number | null) => pages.filter((p) => p.parentId === parentId)
	const isInside = (id: number, ancestor: number): boolean => {
		const p = pages.find((x) => x.id === id)
		return !!p?.parentId && (p.parentId === ancestor || isInside(p.parentId, ancestor))
	}

	const onDrop = async () => {
		if (dragId === null || !drop || drop.id === dragId || isInside(drop.id, dragId)) return
		const target = pages.find((p) => p.id === drop.id)!
		let parentId: number | null
		let index: number
		if (drop.pos === 'inside') {
			parentId = target.id
			index = children(target.id).filter((p) => p.id !== dragId).length
		} else {
			parentId = target.parentId
			const siblings = children(parentId).filter((p) => p.id !== dragId)
			index = siblings.findIndex((p) => p.id === target.id) + (drop.pos === 'after' ? 1 : 0)
		}
		try {
			pageList.value = await post<PageSummary[]>(`/pages/${dragId}/move`, { parentId, index })
		} catch (e) {
			toastError(e)
		}
	}

	// plain render function (not a component) so rows keep their DOM nodes while dragging
	const node = (page: PageSummary) => (
		<li key={page.id}>
			<div
				class={`tree-row ${page.id === currentId ? 'current' : ''} ${dragId === page.id ? 'dragging' : ''} ${drop?.id === page.id ? `drop-${drop.pos}` : ''}`}
				draggable
				onDragStart={(e) => {
					setDragId(page.id)
					e.dataTransfer!.effectAllowed = 'move'
					e.dataTransfer!.setData('text/plain', String(page.id))
				}}
				onDragOver={(e) => {
					if (dragId === null || dragId === page.id) return
					e.preventDefault()
					const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
					const y = (e.clientY - r.top) / r.height
					const pos: DropPos = y < 0.3 ? 'before' : y > 0.7 ? 'after' : 'inside'
					if (drop?.id !== page.id || drop.pos !== pos) setDrop({ id: page.id, pos })
				}}
				onDragLeave={() => setDrop(null)}
				onDrop={(e) => {
					e.preventDefault()
					onDrop()
					setDrop(null)
					setDragId(null)
				}}
				onDragEnd={() => {
					setDragId(null)
					setDrop(null)
				}}
			>
				<a href={`/admin/pages/${page.id}`} draggable={false}>
					<span
						class={`dot ${page.status}`}
						title={page.status === 'published' ? 'Veröffentlicht' : 'Entwurf'}
					/>
					{page.title}
					{!page.nav && (
						<span class="muted" title="Nicht in Navigation">
							{' '}
							⊘
						</span>
					)}
				</a>
				<small class="muted">{page.path}</small>
			</div>
			{children(page.id).length > 0 && <ul>{children(page.id).map(node)}</ul>}
		</li>
	)

	return <ul class="tree">{children(null).map(node)}</ul>
}

export async function createPage(parentId: number | null = null) {
	const title = prompt(parentId ? 'Titel der Unterseite' : 'Titel der neuen Seite')?.trim()
	if (!title) return
	try {
		const page = await post<Page>('/pages', { title, parentId })
		await refreshPages()
		navigate(`/admin/pages/${page.id}`)
	} catch (e) {
		toastError(e)
	}
}

function PageEditor({ id }: { id: number }) {
	const [page, setPage] = useState<Page | null>(null)
	const [busy, run] = useBusy()
	useEffect(() => {
		setPage(null)
		get<Page>(`/pages/${id}`).then(setPage, toastError)
	}, [id])

	const update = (patch: Partial<Page>) => {
		setPage((p) => p && { ...p, ...patch })
		dirty.value = true
	}
	const save = () =>
		page &&
		run(async () => {
			try {
				const saved = await put<Page>(`/pages/${id}`, {
					title: page.title,
					slug: page.slug,
					status: page.status,
					nav: page.nav,
					data: page.data,
					blocks: page.blocks,
				})
				setPage(saved)
				dirty.value = false
				await refreshPages()
				toast('Seite gespeichert')
			} catch (e) {
				toastError(e)
			}
		})
	useSaveShortcut(save)

	if (!page) return <div class="loading">Lade…</div>
	const parent = pageList.value.find((p) => p.id === page.parentId)
	const isHome = !page.parentId && page.slug === ''

	return (
		<div class="editor-main">
			<header class="view-head sticky">
				<div>
					<h1>{page.title || 'Ohne Titel'}</h1>
					<StatusBadge status={page.status} />
				</div>
				<div class="row">
					<a href={`${page.path}?preview`} target="_blank" rel="noopener" class="button">
						Vorschau ↗
					</a>
					<button type="button" onClick={() => createPage(page.id)}>
						+ Unterseite
					</button>
					<button
						type="button"
						class="danger"
						onClick={async () => {
							if (!confirm(`„${page.title}“ inklusive aller Unterseiten löschen?`)) return
							await del(`/pages/${id}`)
							dirty.value = false
							await refreshPages()
							navigate('/admin/pages')
						}}
					>
						Löschen
					</button>
					<button type="button" class="primary" onClick={save} disabled={busy || !dirty.value}>
						{busy ? 'Speichere…' : 'Speichern'}
					</button>
				</div>
			</header>
			<section class="panel">
				<div class="fields">
					<div class="field w-half">
						<label class="field-label">Titel</label>
						<input value={page.title} onInput={(e) => update({ title: e.currentTarget.value })} />
					</div>
					<div class="field w-half">
						<label class="field-label">URL</label>
						{isHome ? (
							<input value="/ (Startseite)" disabled />
						) : (
							<div class="prefixed">
								<span>{parent ? `${parent.path === '/' ? '' : parent.path}/` : '/'}</span>
								<input value={page.slug} onInput={(e) => update({ slug: e.currentTarget.value })} />
							</div>
						)}
					</div>
					<div class="field w-third">
						<label class="field-label">Status</label>
						<select
							value={page.status}
							onChange={(e) => update({ status: e.currentTarget.value as Page['status'] })}
						>
							<option value="draft">Entwurf</option>
							<option value="published">Veröffentlicht</option>
						</select>
					</div>
					<div class="field w-third">
						<label class="field-label">In Navigation</label>
						<label class="switch">
							<input
								type="checkbox"
								checked={page.nav}
								onChange={(e) => update({ nav: e.currentTarget.checked })}
							/>
							<span />
						</label>
					</div>
				</div>
				{config.value!.page?.fields.length ? (
					<details class="more-fields">
						<summary>Seiteneigenschaften</summary>
						<Fields
							fields={config.value!.page.fields}
							value={page.data}
							onChange={(data) => update({ data })}
						/>
					</details>
				) : null}
			</section>
			<section>
				<h2 class="section-title">Inhalt</h2>
				<BlocksEditor value={page.blocks} onChange={(blocks) => update({ blocks })} />
			</section>
		</div>
	)
}

export function Pages({ id }: { id?: number }) {
	return (
		<div class="split-view">
			<aside class="side-panel">
				<header class="row between">
					<h2>Seiten</h2>
					<button type="button" class="primary small" onClick={() => createPage()}>
						+ Neu
					</button>
				</header>
				<PageTree currentId={id} />
				<p class="hint">Seiten per Drag & Drop sortieren – mittig ablegen für Unterseite.</p>
			</aside>
			{id ? (
				<PageEditor key={id} id={id} />
			) : (
				<div class="editor-main empty-state">
					<p>Wähle links eine Seite aus oder lege eine neue an.</p>
				</div>
			)}
		</div>
	)
}
