import { useEffect, useState } from 'preact/hooks'
import type { Media } from '../../types'
import { FileIcon, MediaLibrary, thumb } from '../MediaLibrary'
import { useSortable } from '../sortable'
import { loadMedia } from '../state'
import { Modal } from '../ui'
import type { FieldProps } from './Fields'

function useMediaList(ids: number[]) {
	const [list, setList] = useState<(Media | null)[]>([])
	const key = ids.join(',')
	useEffect(() => {
		Promise.all(ids.map(loadMedia)).then(setList)
	}, [key])
	return list
}

const Preview = ({ m }: { m: Media }) =>
	m.mime.startsWith('image/') ? <img src={thumb(m)} alt={m.alt} /> : <FileIcon m={m} />

export function MediaField({ field, value, onChange }: FieldProps<number | null>) {
	const [picking, setPicking] = useState(false)
	const [m] = useMediaList(value ? [value] : [])
	const accept = field.accept ?? (field.type === 'image' ? 'image/*' : undefined)
	return (
		<div class="media-field">
			{value && m ? (
				<div class="media-preview">
					<Preview m={m} />
					<div>
						<strong>{m.name}</strong>
						{m.width && (
							<small>
								{m.width}×{m.height}
							</small>
						)}
						{field.type === 'image' && !m.alt && <small class="warn">Kein Alternativtext</small>}
						<div class="row">
							<button type="button" onClick={() => setPicking(true)}>
								Ändern
							</button>
							<button type="button" class="danger" onClick={() => onChange(null)}>
								Entfernen
							</button>
						</div>
					</div>
				</div>
			) : (
				<button type="button" class="add" onClick={() => setPicking(true)}>
					{field.type === 'image' ? '🖼 Bild auswählen' : '📎 Datei auswählen'}
				</button>
			)}
			{picking && (
				<Modal
					title={field.type === 'image' ? 'Bild auswählen' : 'Datei auswählen'}
					onClose={() => setPicking(false)}
					wide
				>
					<MediaLibrary
						accept={accept}
						onPick={([picked]) => {
							onChange(picked!.id)
							setPicking(false)
						}}
					/>
				</Modal>
			)}
		</div>
	)
}

export function GalleryField({ field, value, onChange }: FieldProps<number[]>) {
	const [picking, setPicking] = useState(false)
	const list = useMediaList(value)
	const sortable = useSortable(value, onChange)
	return (
		<div class="gallery-field">
			<div class="gallery-grid">
				{value.map((id, i) => {
					const m = list[i]
					return (
						<div
							key={id}
							class={`gallery-item ${sortable.target === i ? 'drop-before' : ''}`}
							{...sortable.item(i)}
						>
							<span {...sortable.handle(i)}>{m ? <Preview m={m} /> : '…'}</span>
							<button
								type="button"
								class="remove"
								title="Entfernen"
								onClick={() => onChange(value.filter((_, j) => j !== i))}
							>
								✕
							</button>
						</div>
					)
				})}
				{(field.max === undefined || value.length < field.max) && (
					<button type="button" class="add" onClick={() => setPicking(true)}>
						+ Bilder
					</button>
				)}
			</div>
			{picking && (
				<Modal title="Bilder auswählen" onClose={() => setPicking(false)} wide>
					<MediaLibrary
						accept="image/*"
						multiple
						onPick={(picked) => {
							onChange([...value, ...picked.map((m) => m.id).filter((id) => !value.includes(id))])
							setPicking(false)
						}}
					/>
				</Modal>
			)}
		</div>
	)
}
