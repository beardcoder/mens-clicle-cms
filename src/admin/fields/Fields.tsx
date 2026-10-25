import { useId } from 'preact/hooks'
import type { Data, Field, Option } from '../../types'
import { BlocksEditor } from './BlocksEditor'
import { LinkField, PageSelect, RelationField, TagsField } from './inputs'
import { GalleryField, MediaField } from './MediaField'
import { Repeater } from './Repeater'
import { RichText } from './RichText'

export interface FieldProps<T = any> {
	field: Field
	value: T
	onChange: (value: T) => void
	id?: string
}

export const label = (f: Field) => f.label ?? f.name
export const optionValue = (o: Option) => (typeof o === 'string' ? o : o.value)
export const optionLabel = (o: Option) => (typeof o === 'string' ? o : o.label)

const INPUT_TYPES: Partial<Record<Field['type'], string>> = {
	text: 'text',
	email: 'email',
	url: 'url',
	date: 'date',
	datetime: 'datetime-local',
	time: 'time',
}

export function FieldInput({ field: f, value, onChange, id }: FieldProps) {
	switch (f.type) {
		case 'textarea':
		case 'markdown':
		case 'code':
			return (
				<textarea
					id={id}
					class={f.type !== 'textarea' ? 'mono' : undefined}
					rows={f.rows ?? (f.type === 'textarea' ? 4 : 10)}
					maxLength={f.max}
					placeholder={f.placeholder ?? (f.type === 'markdown' ? '**Markdown** wird unterstützt' : undefined)}
					value={value ?? ''}
					onInput={(e) => onChange(e.currentTarget.value)}
				/>
			)
		case 'richtext':
			return <RichText value={value ?? ''} onChange={onChange} />
		case 'number':
			return (
				<input
					id={id}
					type="number"
					min={f.min}
					max={f.max}
					step={f.step ?? 'any'}
					value={value ?? ''}
					placeholder={f.placeholder}
					onInput={(e) => {
						const v = e.currentTarget.value
						onChange(v === '' ? null : Number(v))
					}}
				/>
			)
		case 'boolean':
			return (
				<label class="switch">
					<input type="checkbox" checked={!!value} onChange={(e) => onChange(e.currentTarget.checked)} />
					<span />
				</label>
			)
		case 'color':
			return (
				<div class="row">
					<input type="color" value={value || '#000000'} onInput={(e) => onChange(e.currentTarget.value)} />
					<input
						id={id}
						class="mono"
						value={value ?? ''}
						placeholder="#000000"
						onInput={(e) => onChange(e.currentTarget.value)}
					/>
				</div>
			)
		case 'select':
			return (
				<select id={id} value={value ?? ''} onChange={(e) => onChange(e.currentTarget.value)}>
					{(!f.required || !value) && <option value="">– bitte wählen –</option>}
					{f.options?.map((o) => (
						<option key={optionValue(o)} value={optionValue(o)}>
							{optionLabel(o)}
						</option>
					))}
				</select>
			)
		case 'multiselect': {
			const selected: string[] = value ?? []
			return (
				<div class="checks">
					{f.options?.map((o) => (
						<label key={optionValue(o)}>
							<input
								type="checkbox"
								checked={selected.includes(optionValue(o))}
								onChange={(e) =>
									onChange(
										e.currentTarget.checked
											? [...selected, optionValue(o)]
											: selected.filter((v) => v !== optionValue(o)),
									)
								}
							/>
							{optionLabel(o)}
						</label>
					))}
				</div>
			)
		}
		case 'tags':
			return <TagsField field={f} value={value ?? []} onChange={onChange} />
		case 'link':
			return <LinkField field={f} value={value} onChange={onChange} />
		case 'image':
		case 'file':
			return <MediaField field={f} value={value ?? null} onChange={onChange} />
		case 'gallery':
			return <GalleryField field={f} value={value ?? []} onChange={onChange} />
		case 'relation':
			return <RelationField field={f} value={value} onChange={onChange} />
		case 'page':
			return <PageSelect value={value ?? null} onChange={onChange} />
		case 'repeater':
			return <Repeater field={f} value={value ?? []} onChange={onChange} />
		case 'group':
			return (
				<div class="group">
					<Fields fields={f.fields ?? []} value={value ?? {}} onChange={onChange} />
				</div>
			)
		case 'blocks':
			return <BlocksEditor value={value ?? []} onChange={onChange} allow={f.allow} />
		default:
			return (
				<input
					id={id}
					type={(INPUT_TYPES[f.type] ?? 'text') as 'text'}
					maxLength={f.max}
					placeholder={f.placeholder}
					value={f.type === 'datetime' ? (value ?? '').slice(0, 16) : (value ?? '')}
					onInput={(e) => onChange(e.currentTarget.value)}
				/>
			)
	}
}

function FieldRow({ field: f, value, onChange }: FieldProps) {
	const id = useId()
	return (
		<div class={`field w-${f.width ?? 'full'} t-${f.type}`}>
			<label class="field-label" for={id}>
				{label(f)}
				{f.required && <span class="req">*</span>}
			</label>
			<FieldInput id={id} field={f} value={value} onChange={onChange} />
			{f.help && <small class="help">{f.help}</small>}
		</div>
	)
}

/** Renders a list of field definitions as a responsive form grid */
export function Fields({
	fields,
	value,
	onChange,
}: {
	fields: Field[]
	value: Data
	onChange: (v: Data) => void
}) {
	return (
		<div class="fields">
			{fields.map((f) => (
				<FieldRow
					key={f.name}
					field={f}
					value={value[f.name]}
					onChange={(v) => onChange({ ...value, [f.name]: v })}
				/>
			))}
		</div>
	)
}
