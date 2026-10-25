import { useEffect, useState } from 'preact/hooks'
import { get } from '../api'
import { config, user } from '../state'

interface Stats {
	pages: number
	entries: Record<string, number>
	media: number
	users: number
}

export function Dashboard() {
	const [stats, setStats] = useState<Stats | null>(null)
	useEffect(() => {
		get<Stats>('/stats').then(setStats)
	}, [])
	const collections = Object.entries(config.value!.collections)
	return (
		<div class="view">
			<header class="view-head">
				<h1>Hallo {user.value?.name || user.value?.email} 👋</h1>
			</header>
			<div class="stats">
				<a href="/admin/pages" class="stat">
					<span>📄</span>
					<strong>{stats?.pages ?? '–'}</strong>
					Seiten
				</a>
				{collections.map(([name, def]) => (
					<a key={name} href={`/admin/collections/${name}`} class="stat">
						<span>{def.icon ?? '🗃'}</span>
						<strong>{stats?.entries[name] ?? 0}</strong>
						{def.label}
					</a>
				))}
				<a href="/admin/media" class="stat">
					<span>🖼</span>
					<strong>{stats?.media ?? '–'}</strong>
					Medien
				</a>
				<a href="/admin/users" class="stat">
					<span>👥</span>
					<strong>{stats?.users ?? '–'}</strong>
					Benutzer
				</a>
			</div>
			<section class="panel">
				<h2>Schnellzugriff</h2>
				<div class="row wrap">
					{collections.map(([name, def]) => (
						<a key={name} href={`/admin/collections/${name}/new`} class="button">
							+ {def.singular ?? def.label}
						</a>
					))}
					<a href="/" target="_blank" class="button" rel="noopener">
						Website ansehen ↗
					</a>
				</div>
			</section>
		</div>
	)
}
