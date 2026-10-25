import { useState } from 'preact/hooks'
import { post } from '../api'
import { boot, needsSetup, toastError } from '../state'
import { useBusy } from '../ui'

export function Login() {
	const setup = needsSetup.value
	const [form, setForm] = useState({ email: '', name: '', password: '' })
	const [busy, run] = useBusy()
	const submit = (e: Event) => {
		e.preventDefault()
		run(async () => {
			try {
				await post(
					setup ? '/auth/setup' : '/auth/login',
					setup ? form : { email: form.email, password: form.password },
				)
				await boot()
			} catch (err) {
				toastError(err)
			}
		})
	}
	const set = (k: keyof typeof form) => (e: Event) =>
		setForm({ ...form, [k]: (e.target as HTMLInputElement).value })
	return (
		<main class="login">
			<form onSubmit={submit} class="card">
				<h1>🌿 {setup ? 'Willkommen!' : 'Anmelden'}</h1>
				{setup && <p class="muted">Lege das erste Administrator-Konto an.</p>}
				{setup && (
					<label>
						Name
						<input required value={form.name} onInput={set('name')} autoComplete="name" />
					</label>
				)}
				<label>
					E-Mail
					<input
						type="email"
						required
						value={form.email}
						onInput={set('email')}
						autoComplete="username"
						autoFocus
					/>
				</label>
				<label>
					Passwort
					<input
						type="password"
						required
						minLength={setup ? 8 : 1}
						value={form.password}
						onInput={set('password')}
						autoComplete={setup ? 'new-password' : 'current-password'}
					/>
				</label>
				<button class="primary" disabled={busy}>
					{setup ? 'Konto anlegen' : 'Anmelden'}
				</button>
			</form>
		</main>
	)
}
