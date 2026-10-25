import { post } from './api'
import { MediaLibrary } from './MediaLibrary'
import { config, navigate, route, user } from './state'
import { Toasts } from './ui'
import { EntryEditor, EntryList } from './views/Collection'
import { Dashboard } from './views/Dashboard'
import { Login } from './views/Login'
import { Pages } from './views/Pages'
import { Settings, Users } from './views/Settings'

function View() {
	const cfg = config.value!
	const parts = route.value
		.replace(/^\/admin\/?/, '')
		.split('/')
		.filter(Boolean)
	const [section, a, b] = parts
	switch (section) {
		case undefined:
			return <Dashboard />
		case 'pages':
			return <Pages id={a ? Number(a) : undefined} />
		case 'collections': {
			const def = a ? cfg.collections[a] : undefined
			if (!def || !a) break
			return b ? (
				<EntryEditor key={`${a}/${b}`} name={a} def={def} id={b === 'new' ? 'new' : Number(b)} />
			) : (
				<EntryList key={a} name={a} def={def} />
			)
		}
		case 'media':
			return (
				<div class="view">
					<header class="view-head">
						<h1>🖼 Medien</h1>
					</header>
					<MediaLibrary />
				</div>
			)
		case 'settings':
			if (a) return <Settings key={a} group={a} />
			break
		case 'users':
			return <Users />
	}
	return (
		<div class="view empty-state">
			<p>Seite nicht gefunden.</p>
		</div>
	)
}

const NavLink = ({ href, children }: { href: string; children: preact.ComponentChildren }) => {
	const active = href === '/admin' ? route.value === '/admin' : route.value.startsWith(href)
	return (
		<a href={href} class={active ? 'active' : undefined}>
			{children}
		</a>
	)
}

export function App() {
	if (user.value === undefined) return <div class="loading">Lade…</div>
	if (!user.value || !config.value)
		return (
			<>
				<Login />
				<Toasts />
			</>
		)
	const cfg = config.value
	return (
		<div class="shell">
			<nav class="sidebar">
				<a href="/admin" class="logo">
					🌿 <span>CMS</span>
				</a>
				<NavLink href="/admin">🏠 Übersicht</NavLink>
				<NavLink href="/admin/pages">📄 Seiten</NavLink>
				<small class="nav-label">Inhalte</small>
				{Object.entries(cfg.collections).map(([name, def]) => (
					<NavLink key={name} href={`/admin/collections/${name}`}>
						{def.icon ?? '🗃'} {def.label}
					</NavLink>
				))}
				<NavLink href="/admin/media">🖼 Medien</NavLink>
				<small class="nav-label">Einstellungen</small>
				{Object.entries(cfg.settings).map(([name, def]) => (
					<NavLink key={name} href={`/admin/settings/${name}`}>
						{def.icon ?? '⚙️'} {def.label}
					</NavLink>
				))}
				<NavLink href="/admin/users">👥 Benutzer</NavLink>
				<div class="sidebar-foot">
					<a href="/" target="_blank" rel="noopener">
						Website ↗
					</a>
					<button
						type="button"
						class="link"
						onClick={async () => {
							await post('/auth/logout')
							user.value = null
							navigate('/admin')
						}}
					>
						Abmelden
					</button>
				</div>
			</nav>
			<main class="content">
				<View />
			</main>
			<Toasts />
		</div>
	)
}
