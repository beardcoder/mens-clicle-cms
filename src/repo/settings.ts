import { config } from '../config'
import { changed, db, json } from '../db'
import { ContentError, defaults, validate } from '../fields'
import type { Data } from '../types'

const read = db.query<{ data: string }, [string]>('SELECT data FROM settings WHERE key = ?')

export const settings = {
	get(group: string): Data {
		const def = config.settings[group]
		if (!def) return {}
		return { ...defaults(def.fields), ...json<Data>(read.get(group)?.data, {}) }
	},

	all(): Record<string, Data> {
		return Object.fromEntries(Object.keys(config.settings).map((k) => [k, settings.get(k)]))
	},

	set(group: string, input: Data): Data {
		const def = config.settings[group]
		if (!def)
			throw new ContentError([{ path: '/group', message: `Unbekannte Einstellungsgruppe "${group}"` }])
		const data = validate(def.fields, input)
		db.query(
			'INSERT INTO settings (key, data) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET data = excluded.data',
		).run(group, JSON.stringify(data))
		changed()
		return settings.get(group)
	},
}
