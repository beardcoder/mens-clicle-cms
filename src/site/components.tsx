import type { ComponentChildren } from 'preact'
import type { Link } from '../expand'
import { mediaUrl, WIDTHS } from '../repo/media'
import type { Media } from '../types'

interface ImgProps {
	media: Media | null | undefined
	sizes?: string
	class?: string
	eager?: boolean
	alt?: string
}

/** Responsive <img> with WebP srcset generated on demand and a ThumbHash placeholder */
export function Img({ media, sizes = '(max-width: 70rem) 100vw, 70rem', class: cls, eager, alt }: ImgProps) {
	if (!media) return null
	if (!media.width || !media.height || !media.mime.startsWith('image/') || media.mime === 'image/svg+xml')
		return <img src={media.url} alt={alt ?? media.alt} class={cls} loading={eager ? 'eager' : 'lazy'} />
	const widths = WIDTHS.filter((w) => w < media.width!)
	const srcset = [...widths, media.width]
		.filter((w) => w <= 2560)
		.map((w) => `${mediaUrl(media, w, 'webp')} ${w}w`)
		.join(', ')
	const opaque = media.mime === 'image/jpeg' && media.placeholder
	return (
		<img
			src={mediaUrl(media, Math.min(media.width, 1280))}
			srcset={srcset}
			sizes={sizes}
			width={media.width}
			height={media.height}
			alt={alt ?? media.alt}
			class={cls}
			loading={eager ? 'eager' : 'lazy'}
			fetchpriority={eager ? 'high' : undefined}
			decoding="async"
			style={opaque ? `background:url(${media.placeholder}) center/cover` : undefined}
		/>
	)
}

export function A({
	link,
	class: cls,
	children,
}: {
	link: Link | null | undefined
	class?: string
	children?: ComponentChildren
}) {
	if (!link) return null
	return (
		<a
			href={link.href}
			class={cls}
			target={link.target}
			rel={link.target === '_blank' ? 'noopener noreferrer' : undefined}
		>
			{children ?? link.label}
		</a>
	)
}

export const Html = ({ html, class: cls }: { html: string | undefined; class?: string }) =>
	html ? <div class={cls ?? 'prose'} dangerouslySetInnerHTML={{ __html: html }} /> : null
