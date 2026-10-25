// Minimal WYSIWYG editor on contenteditable. Output is sanitized again on the server.
import { useEffect, useRef } from 'preact/hooks'

const TOOLS: [label: string, title: string, run: () => void][] = [
	['B', 'Fett', () => document.execCommand('bold')],
	['I', 'Kursiv', () => document.execCommand('italic')],
	['H2', 'Überschrift 2', () => document.execCommand('formatBlock', false, 'h2')],
	['H3', 'Überschrift 3', () => document.execCommand('formatBlock', false, 'h3')],
	['¶', 'Absatz', () => document.execCommand('formatBlock', false, 'p')],
	['•', 'Liste', () => document.execCommand('insertUnorderedList')],
	['1.', 'Nummerierte Liste', () => document.execCommand('insertOrderedList')],
	['❝', 'Zitat', () => document.execCommand('formatBlock', false, 'blockquote')],
	[
		'🔗',
		'Link',
		() => {
			const url = prompt('URL (https://…, /seite, mailto:…)')
			if (url) document.execCommand('createLink', false, url)
		},
	],
	['⌫', 'Formatierung entfernen', () => document.execCommand('removeFormat')],
]

export function RichText({ value, onChange }: { value: string; onChange: (html: string) => void }) {
	const ref = useRef<HTMLDivElement>(null)
	// Only push external changes into the DOM — never while typing (keeps the caret)
	useEffect(() => {
		if (ref.current && ref.current.innerHTML !== value && document.activeElement !== ref.current)
			ref.current.innerHTML = value
	}, [value])
	const emit = () => {
		const html = ref.current!.innerHTML
		onChange(html === '<br>' ? '' : html)
	}
	return (
		<div class="richtext">
			<div class="toolbar">
				{TOOLS.map(([label, title, run]) => (
					<button
						key={title}
						type="button"
						title={title}
						onMouseDown={(e) => {
							e.preventDefault()
							run()
							emit()
						}}
					>
						{label}
					</button>
				))}
			</div>
			<div
				ref={ref}
				class="editor prose"
				contentEditable
				onInput={emit}
				onBlur={emit}
				onPaste={(e) => {
					// paste as plain text paragraphs to avoid foreign markup
					e.preventDefault()
					const text = e.clipboardData?.getData('text/plain') ?? ''
					document.execCommand('insertText', false, text)
				}}
			/>
		</div>
	)
}
