import { useEffect, useState } from 'preact/hooks'
import { defaults } from '../../shared'
import type { CollectionDef, Entry } from '../../types'
import { del, get, post, put } from '../api'
import { Fields, label } from '../fields/Fields'
import { config, dirty, navigate, toast, toastError } from '../state'
import { formatDate, StatusBadge, useBusy, useSaveShortcut } from '../ui'

const display = (v: unknown) => {
	if (v == null || v === '') return '–'
	if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) return formatDate(v)
	if (Array.isArray(v)) return v.join(', ')
	return String(v)
}

export function EntryList({ name, def }: { name: string; def: CollectionDef }) {
	const [data, setData] = useState<{ items: Entry[]; total: number } | null>(null)
	const [q, setQ] = useState('')
	const [status, setStatus] = useState('')
	const PAGE = 100
	/** `more` appends the next page, otherwise the list is reloaded from the start */
	const load = (more = false) => {
		const params = new URLSearchParams({
			limit: String(PAGE),
			offset: String(more ? (data?.items.length ?? 0) : 0),
		})
		if (q) params.set('q', q)
		if (status) params.set('status', status)
		return get<{ items: Entry[]; total: number }>(`/collections/${name}?${params}`).then(
			(res) => setData(more && data ? { ...res, items: [...data.items, ...res.items] } : res),
			toastError,
		)
	}
	useEffect(() => {
		const t = setTimeout(load, q ? 200 : 0)
		return () => clearTimeout(t)
	}, [name, q, status])
	const columns = (def.columns ?? []).map((c) => def.fields.find((f) => f.name === c)).filter((f) => !!f)
	return (
		<div class="view">
			<header class="view-head">
				<h1>
					{def.icon} {def.label}
				</h1>
				<a href={`/admin/collections/${name}/new`} class="button primary">
					+ {def.singular ?? 'Neuer Eintrag'}
				</a>
			</header>
			<div class="row filters">
				<input type="search" placeholder="Suchen…" value={q} onInput={(e) => setQ(e.currentTarget.value)} />
				<select value={status} onChange={(e) => setStatus(e.currentTarget.value)}>
					<option value="">Alle Status</option>
					<option value="published">Veröffentlicht</option>
					<option value="draft">Entwurf</option>
				</select>
				<span class="muted">{data?.total ?? 0} Einträge</span>
			</div>
			<table class="table">
				<thead>
					<tr>
						<th>Titel</th>
						{columns.map((c) => (
							<th key={c.name}>{label(c)}</th>
						))}
						<th>Status</th>
						<th>Geändert</th>
					</tr>
				</thead>
				<tbody>
					{data?.items.map((e) => (
						<tr key={e.id} onClick={() => navigate(`/admin/collections/${name}/${e.id}`)}>
							<td>
								<a href={`/admin/collections/${name}/${e.id}`}>{e.title}</a>
							</td>
							{columns.map((c) => (
								<td key={c.name}>{display(e.data[c.name])}</td>
							))}
							<td>
								<StatusBadge status={e.status} />
							</td>
							<td class="muted">{formatDate(e.updatedAt)}</td>
						</tr>
					))}
				</tbody>
			</table>
			{data?.items.length === 0 && <p class="empty">Keine Einträge gefunden.</p>}
			{data && data.items.length < data.total && (
				<button type="button" class="add" onClick={() => load(true)}>
					Mehr laden ({data.total - data.items.length})
				</button>
			)}
		</div>
	)
}

export function EntryEditor({ name, def, id }: { name: string; def: CollectionDef; id: number | 'new' }) {
	const [entry, setEntry] = useState<Partial<Entry> | null>(null)
	const [busy, run] = useBusy()
	useEffect(() => {
		if (id === 'new') setEntry({ title: '', slug: '', status: 'draft', data: defaults(def.fields) })
		else get<Entry>(`/collections/${name}/${id}`).then(setEntry, toastError)
	}, [name, id])

	const update = (patch: Partial<Entry>) => {
		setEntry((e) => e && { ...e, ...patch })
		dirty.value = true
	}
	const save = () =>
		entry &&
		run(async () => {
			try {
				const body = { title: entry.title, slug: entry.slug, status: entry.status, data: entry.data }
				const saved =
					id === 'new'
						? await post<Entry>(`/collections/${name}`, body)
						: await put<Entry>(`/collections/${name}/${id}`, body)
				dirty.value = false
				setEntry(saved)
				toast('Gespeichert')
				if (id === 'new') navigate(`/admin/collections/${name}/${saved.id}`, true)
			} catch (e) {
				toastError(e)
			}
		})
	useSaveShortcut(save)

	if (!entry) return <div class="loading">Lade…</div>
	const base = config.value!.collections[name]?.route
	return (
		<div class="view narrow">
			<header class="view-head sticky">
				<div>
					<a href={`/admin/collections/${name}`} class="back">
						← {def.label}
					</a>
					<h1>{entry.title || def.singular || 'Neuer Eintrag'}</h1>
				</div>
				<div class="row">
					{entry.url && (
						<a href={`${entry.url}?preview`} target="_blank" rel="noopener" class="button">
							Vorschau ↗
						</a>
					)}
					{id !== 'new' && (
						<button
							type="button"
							class="danger"
							onClick={async () => {
								if (!confirm('Eintrag löschen?')) return
								await del(`/collections/${name}/${id}`)
								dirty.value = false
								navigate(`/admin/collections/${name}`)
							}}
						>
							Löschen
						</button>
					)}
					<button type="button" class="primary" onClick={save} disabled={busy}>
						{busy ? 'Speichere…' : 'Speichern'}
					</button>
				</div>
			</header>
			<section class="panel">
				<div class="fields">
					<div class="field w-full">
						<label class="field-label">
							Titel<span class="req">*</span>
						</label>
						<input value={entry.title} onInput={(e) => update({ title: e.currentTarget.value })} />
					</div>
					<div class="field w-half">
						<label class="field-label">Slug</label>
						<div class="prefixed">
							{base && <span>{base}/</span>}
							<input
								value={entry.slug}
								placeholder="wird aus dem Titel erzeugt"
								onInput={(e) => update({ slug: e.currentTarget.value })}
							/>
						</div>
					</div>
					<div class="field w-half">
						<label class="field-label">Status</label>
						<select
							value={entry.status}
							onChange={(e) => update({ status: e.currentTarget.value as Entry['status'] })}
						>
							<option value="draft">Entwurf</option>
							<option value="published">Veröffentlicht</option>
						</select>
					</div>
				</div>
			</section>
			<section class="panel">
				<Fields fields={def.fields} value={entry.data ?? {}} onChange={(data) => update({ data })} />
			</section>
		</div>
	)
}
