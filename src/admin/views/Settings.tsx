import { useEffect, useState } from 'preact/hooks'
import type { Data, User } from '../../types'
import { del, get, post, put } from '../api'
import { Fields } from '../fields/Fields'
import { config, dirty, toast, toastError, user } from '../state'
import { formatDate, useBusy, useSaveShortcut } from '../ui'

export function Settings({ group }: { group: string }) {
	const def = config.value!.settings[group]
	const [data, setData] = useState<Data | null>(null)
	const [busy, run] = useBusy()
	useEffect(() => {
		setData(null)
		get<Record<string, Data>>('/settings').then((all) => setData(all[group] ?? {}), toastError)
	}, [group])
	const save = () =>
		data &&
		run(async () => {
			try {
				setData(await put<Data>(`/settings/${group}`, data))
				dirty.value = false
				toast('Einstellungen gespeichert')
			} catch (e) {
				toastError(e)
			}
		})
	useSaveShortcut(save)
	if (!def) return <div class="view">Unbekannte Einstellungsgruppe.</div>
	return (
		<div class="view narrow">
			<header class="view-head sticky">
				<h1>
					{def.icon} {def.label}
				</h1>
				<button type="button" class="primary" onClick={save} disabled={busy || !data}>
					Speichern
				</button>
			</header>
			{data ? (
				<section class="panel">
					<Fields
						fields={def.fields}
						value={data}
						onChange={(v) => {
							setData(v)
							dirty.value = true
						}}
					/>
				</section>
			) : (
				<div class="loading">Lade…</div>
			)}
		</div>
	)
}

export function Users() {
	const [list, setList] = useState<User[]>([])
	const [form, setForm] = useState({ email: '', name: '', password: '' })
	const [profile, setProfile] = useState({ name: user.value?.name ?? '', password: '' })
	const [busy, run] = useBusy()
	const load = () => get<User[]>('/users').then(setList, toastError)
	useEffect(() => {
		load()
	}, [])
	const attempt = (fn: () => Promise<unknown>, ok: string) =>
		run(async () => {
			try {
				await fn()
				toast(ok)
				await load()
			} catch (e) {
				toastError(e)
			}
		})
	return (
		<div class="view narrow">
			<header class="view-head">
				<h1>👥 Benutzer</h1>
			</header>
			<table class="table">
				<thead>
					<tr>
						<th>Name</th>
						<th>E-Mail</th>
						<th>Seit</th>
						<th />
					</tr>
				</thead>
				<tbody>
					{list.map((u) => (
						<tr key={u.id}>
							<td>{u.name}</td>
							<td>{u.email}</td>
							<td class="muted">{formatDate(u.createdAt)}</td>
							<td>
								{u.id !== user.value?.id && (
									<button
										type="button"
										class="icon danger"
										title="Löschen"
										onClick={() =>
											confirm(`${u.email} löschen?`) &&
											attempt(() => del(`/users/${u.id}`), 'Benutzer gelöscht')
										}
									>
										🗑
									</button>
								)}
							</td>
						</tr>
					))}
				</tbody>
			</table>
			<div class="two-col">
				<form
					class="panel"
					onSubmit={(e) => {
						e.preventDefault()
						attempt(() => post('/users', form), 'Benutzer angelegt').then(() =>
							setForm({ email: '', name: '', password: '' }),
						)
					}}
				>
					<h2>Neuer Benutzer</h2>
					<label>
						Name
						<input
							required
							value={form.name}
							onInput={(e) => setForm({ ...form, name: e.currentTarget.value })}
						/>
					</label>
					<label>
						E-Mail
						<input
							type="email"
							required
							value={form.email}
							onInput={(e) => setForm({ ...form, email: e.currentTarget.value })}
						/>
					</label>
					<label>
						Passwort
						<input
							type="password"
							required
							minLength={8}
							value={form.password}
							onInput={(e) => setForm({ ...form, password: e.currentTarget.value })}
							autoComplete="new-password"
						/>
					</label>
					<button class="primary" disabled={busy}>
						Anlegen
					</button>
				</form>
				<form
					class="panel"
					onSubmit={(e) => {
						e.preventDefault()
						attempt(async () => {
							user.value = await put<User>('/users/me', {
								name: profile.name,
								password: profile.password || undefined,
							})
							setProfile({ ...profile, password: '' })
						}, 'Profil gespeichert')
					}}
				>
					<h2>Mein Profil</h2>
					<label>
						Name
						<input
							value={profile.name}
							onInput={(e) => setProfile({ ...profile, name: e.currentTarget.value })}
						/>
					</label>
					<label>
						Neues Passwort
						<input
							type="password"
							minLength={8}
							value={profile.password}
							placeholder="leer lassen = unverändert"
							onInput={(e) => setProfile({ ...profile, password: e.currentTarget.value })}
							autoComplete="new-password"
						/>
					</label>
					<button class="primary" disabled={busy}>
						Speichern
					</button>
				</form>
			</div>
		</div>
	)
}
