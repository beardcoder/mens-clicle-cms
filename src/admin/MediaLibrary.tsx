import { useEffect, useState } from 'preact/hooks'
import type { Media } from '../types'
import { del, get, patch, post } from './api'
import { cacheMedia, forgetMedia, toast, toastError } from './state'
import { formatBytes, useBusy } from './ui'

const isImage = (m: Media) => m.mime.startsWith('image/')
export const thumb = (m: Media, w = 320) =>
	m.width && m.mime !== 'image/svg+xml' && m.mime !== 'image/gif' ? `${m.url}&w=${w}&f=webp` : m.url

export const FileIcon = ({ m }: { m: Media }) => (
	<span class="file-icon">
		{m.mime === 'application/pdf'
			? '📄'
			: m.mime.startsWith('video/')
				? '🎞️'
				: m.mime.startsWith('audio/')
					? '🎵'
					: '📎'}
		<small>{m.name.split('.').pop()}</small>
	</span>
)

const matches = (m: Media, accept?: string) =>
	!accept ||
	accept.split(',').some((a) => (a.endsWith('/*') ? m.mime.startsWith(a.slice(0, -1)) : m.mime === a.trim()))

function Details({
	media,
	onChange,
	onDelete,
}: {
	media: Media
	onChange: (m: Media) => void
	onDelete: () => void
}) {
	const [form, setForm] = useState({ name: media.name, alt: media.alt, folder: media.folder })
	const [busy, run] = useBusy()
	useEffect(() => setForm({ name: media.name, alt: media.alt, folder: media.folder }), [media.id])
	const save = () =>
		run(async () => {
			try {
				const m = await patch<Media>(`/media/${media.id}`, form)
				cacheMedia(m)
				onChange(m)
				toast('Gespeichert')
			} catch (e) {
				toastError(e)
			}
		})
	const rotate = (degrees: number) =>
		run(async () => {
			try {
				const m = await post<Media>(`/media/${media.id}/rotate`, { degrees })
				cacheMedia(m)
				onChange(m)
			} catch (e) {
				toastError(e)
			}
		})
	return (
		<aside class="media-details">
			{isImage(media) ? <img src={thumb(media, 640)} alt="" /> : <FileIcon m={media} />}
			<dl>
				<dt>Typ</dt>
				<dd>{media.mime}</dd>
				<dt>Größe</dt>
				<dd>
					{formatBytes(media.size)}
					{media.width && ` · ${media.width}×${media.height}px`}
				</dd>
			</dl>
			<label>
				Dateiname
				<input value={form.name} onInput={(e) => setForm({ ...form, name: e.currentTarget.value })} />
			</label>
			{isImage(media) && (
				<label>
					Alternativtext
					<input
						value={form.alt}
						placeholder="Bildbeschreibung für Screenreader"
						onInput={(e) => setForm({ ...form, alt: e.currentTarget.value })}
					/>
				</label>
			)}
			<label>
				Ordner
				<input value={form.folder} onInput={(e) => setForm({ ...form, folder: e.currentTarget.value })} />
			</label>
			<div class="row">
				<button type="button" class="primary" onClick={save} disabled={busy}>
					Speichern
				</button>
				{media.width && media.mime !== 'image/gif' && (
					<>
						<button type="button" title="90° nach links drehen" onClick={() => rotate(270)} disabled={busy}>
							⟲
						</button>
						<button type="button" title="90° nach rechts drehen" onClick={() => rotate(90)} disabled={busy}>
							⟳
						</button>
					</>
				)}
			</div>
			<div class="row">
				<a href={media.url} target="_blank" rel="noopener" class="button">
					Öffnen
				</a>
				<button
					type="button"
					onClick={() =>
						navigator.clipboard.writeText(location.origin + media.url).then(() => toast('URL kopiert'))
					}
				>
					URL kopieren
				</button>
				<button type="button" class="danger" onClick={onDelete}>
					Löschen
				</button>
			</div>
		</aside>
	)
}

/** Media library — standalone (management) or as picker (`onPick`) */
export function MediaLibrary({
	onPick,
	multiple,
	accept,
}: {
	onPick?: (media: Media[]) => void
	multiple?: boolean
	accept?: string
}) {
	const [items, setItems] = useState<Media[]>([])
	const [folders, setFolders] = useState<{ folder: string; n: number }[]>([])
	const [folder, setFolder] = useState<string | undefined>(undefined)
	const [q, setQ] = useState('')
	const [selected, setSelected] = useState<Media[]>([])
	const [active, setActive] = useState<Media | null>(null)
	const [dragOver, setDragOver] = useState(false)
	const [busy, run] = useBusy()

	const load = async () => {
		const params = new URLSearchParams()
		if (folder !== undefined) params.set('folder', folder)
		if (q) params.set('q', q)
		if (accept === 'image/*') params.set('type', 'image')
		const res = await get<{ items: Media[]; folders: { folder: string; n: number }[] }>(`/media?${params}`)
		res.items.forEach(cacheMedia)
		setItems(res.items)
		setFolders(res.folders)
	}
	useEffect(() => {
		const t = setTimeout(load, q ? 200 : 0)
		return () => clearTimeout(t)
	}, [folder, q])

	const upload = (files: FileList | File[] | null) =>
		files?.length &&
		run(async () => {
			const form = new FormData()
			for (const f of files) form.append('files', f)
			if (folder) form.append('folder', folder)
			try {
				const uploaded = await post<Media[]>('/media', form)
				toast(`${uploaded.length} Datei(en) hochgeladen`)
				await load()
				if (onPick && !multiple && uploaded.length === 1 && matches(uploaded[0]!, accept)) onPick(uploaded)
			} catch (e) {
				toastError(e)
			}
		})

	const remove = async (m: Media) => {
		if (!confirm(`„${m.name}“ endgültig löschen?`)) return
		try {
			await del(`/media/${m.id}`)
			forgetMedia(m.id)
			setActive(null)
			await load()
		} catch (e) {
			toastError(e)
		}
	}

	const click = (m: Media) => {
		if (!onPick) return setActive(m)
		if (!matches(m, accept)) return toast('Dieser Dateityp ist hier nicht erlaubt', 'error')
		if (!multiple) return onPick([m])
		setSelected((s) => (s.some((x) => x.id === m.id) ? s.filter((x) => x.id !== m.id) : [...s, m]))
	}

	return (
		<div
			class={`media-library ${dragOver ? 'drag-over' : ''}`}
			onDragOver={(e) => {
				if (e.dataTransfer?.types.includes('Files')) {
					e.preventDefault()
					setDragOver(true)
				}
			}}
			onDragLeave={() => setDragOver(false)}
			onDrop={(e) => {
				e.preventDefault()
				setDragOver(false)
				upload(e.dataTransfer?.files ?? null)
			}}
		>
			<div class="media-toolbar">
				<input type="search" placeholder="Suchen…" value={q} onInput={(e) => setQ(e.currentTarget.value)} />
				<select
					value={folder ?? '*'}
					onChange={(e) => setFolder(e.currentTarget.value === '*' ? undefined : e.currentTarget.value)}
				>
					<option value="*">Alle Ordner</option>
					{folders.map((f) => (
						<option key={f.folder} value={f.folder}>
							{f.folder || '(ohne Ordner)'} · {f.n}
						</option>
					))}
				</select>
				<button
					type="button"
					onClick={() => {
						const name = prompt('Neuer Ordner')?.trim()
						if (name) {
							setFolders((f) => [...f, { folder: name, n: 0 }])
							setFolder(name)
						}
					}}
				>
					+ Ordner
				</button>
				<label class={`button primary ${busy ? 'busy' : ''}`}>
					{busy ? 'Lade hoch…' : '↑ Hochladen'}
					<input
						type="file"
						multiple
						accept={accept}
						hidden
						onChange={(e) => {
							upload(e.currentTarget.files)
							e.currentTarget.value = ''
						}}
					/>
				</label>
			</div>
			<div class="media-main">
				<div class="media-grid">
					{items.length === 0 && <p class="empty">Keine Dateien – zum Hochladen hierher ziehen.</p>}
					{items.map((m) => (
						<button
							key={m.id}
							type="button"
							class={`media-tile ${selected.some((s) => s.id === m.id) || active?.id === m.id ? 'selected' : ''} ${matches(m, accept) ? '' : 'disabled'}`}
							onClick={() => click(m)}
							title={m.name}
						>
							{isImage(m) ? <img src={thumb(m)} alt={m.alt} loading="lazy" /> : <FileIcon m={m} />}
							<span class="media-name">{m.name}</span>
						</button>
					))}
				</div>
				{!onPick && active && (
					<Details
						media={active}
						onChange={(m) => {
							setActive(m)
							setItems((list) => list.map((x) => (x.id === m.id ? m : x)))
						}}
						onDelete={() => remove(active)}
					/>
				)}
			</div>
			{onPick && multiple && (
				<footer class="media-footer">
					<span>{selected.length} ausgewählt</span>
					<button type="button" class="primary" disabled={!selected.length} onClick={() => onPick(selected)}>
						Übernehmen
					</button>
				</footer>
			)}
		</div>
	)
}
