/** @jsxImportSource @kitajs/html */
import type { Children } from '@kitajs/html'
import type { Link } from '../expand'
import type { Data, Media } from '../types'
import { CSS_URL } from './assets'
import { A, Html, Img } from './components'
import { type NavItem, useSite } from './context'

interface LayoutProps {
	title: string
	description?: string
	image?: Media | null
	children: Children
}

function Nav({ items }: { items: NavItem[] }): JSX.Element {
	const { path } = useSite()
	return (
		<ul>
			{items.map((item) => {
				const active = item.path === path || (item.path !== '/' && path.startsWith(`${item.path}/`))
				return (
					<li class={item.children.length ? 'has-children' : undefined}>
						<a
							href={item.path}
							aria-current={item.path === path ? 'page' : undefined}
							class={active ? 'active' : undefined}
							safe
						>
							{item.title}
						</a>
						{item.children.length > 0 && <Nav items={item.children} />}
					</li>
				)
			})}
		</ul>
	)
}

export function Layout({ title, description, image, children }: LayoutProps) {
	const { settings, nav, lang, preview } = useSite()
	const general = settings.general ?? {}
	const contact = settings.contact ?? {}
	const footer = settings.footer ?? {}
	const siteName: string = general.siteName ?? ''
	const fullTitle: string =
		title && title !== siteName ? (general.titleTemplate || '%s').replace('%s', title) : siteName
	// validated as #rrggbb by the color field
	const safeAccent = /^#[0-9a-f]{6}$/i.test(general.accent ?? '') ? `:root{--accent:${general.accent}}` : ''
	return (
		<html lang={lang}>
			<head>
				<meta charset="utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				<title safe>{fullTitle}</title>
				{!!description && <meta name="description" content={description} />}
				<meta property="og:title" content={title || siteName} />
				<meta property="og:site_name" content={siteName} />
				{!!description && <meta property="og:description" content={description} />}
				{!!image && <meta property="og:image" content={image.url} />}
				<meta name="color-scheme" content="light dark" />
				{!!general.logo && <link rel="icon" href={(general.logo as Media).url} />}
				<link rel="stylesheet" href={CSS_URL} />
				{!!safeAccent && <style>{safeAccent}</style>}
			</head>
			<body>
				{!!preview && <div class="preview-bar">Vorschau – Entwürfe sind sichtbar</div>}
				<header class="site-header">
					<a href="/" class="brand">
						{general.logo ? <Img media={general.logo} alt={siteName} eager /> : ''}
						<span safe>{siteName}</span>
					</a>
					<nav aria-label="Hauptnavigation">
						<Nav items={nav} />
					</nav>
				</header>
				<main>{children}</main>
				<footer class="site-footer">
					<div>
						<strong safe>{siteName}</strong>
						{!!general.tagline && <p safe>{general.tagline}</p>}
						<Html html={footer.text} />
					</div>
					<address>
						{!!contact.address && (
							<p class="pre" safe>
								{contact.address}
							</p>
						)}
						{!!contact.email && (
							<a href={`mailto:${contact.email}`} safe>
								{contact.email}
							</a>
						)}
						{!!contact.phone && (
							<a href={`tel:${String(contact.phone).replace(/\s/g, '')}`} safe>
								{contact.phone}
							</a>
						)}
					</address>
					<ul class="footer-links">
						{(contact.social as Data[] | undefined)?.map((s) => (
							<li>
								<a href={s.url} rel="me noopener" target="_blank" safe>
									{s.network || s.url}
								</a>
							</li>
						))}
						{(footer.links as { link: Link }[] | undefined)?.map((l) => (
							<li>
								<A link={l.link} />
							</li>
						))}
					</ul>
				</footer>
			</body>
		</html>
	)
}
