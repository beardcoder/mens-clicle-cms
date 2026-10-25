// Demo content for an empty database (disable with SEED=false)
import { config } from './config'
import { defaults } from './fields'
import { entries } from './repo/entries'
import { pages } from './repo/pages'
import { settings } from './repo/settings'
import type { Block, Data, Status } from './types'

const block = (type: string, data: Data): Block => ({
	id: Bun.randomUUIDv7(),
	type,
	data: { ...defaults(config.blocks[type]?.fields ?? []), ...data },
})
const item = (data: Data) => ({ _id: Bun.randomUUIDv7(), ...data })
const day = (offset: number, time?: string) => {
	const d = new Date(Date.now() + offset * 864e5).toISOString().slice(0, 10)
	return time ? `${d}T${time}` : d
}

export function seed() {
	if (pages.list().length > 0) return
	const publish = (id: number, extra: Partial<{ blocks: Block[]; nav: boolean; data: Data }> = {}) => {
		const p = pages.get(id)!
		pages.update(id, {
			title: p.title,
			slug: p.slug,
			status: 'published' as Status,
			nav: extra.nav ?? true,
			data: extra.data ?? {},
			blocks: extra.blocks ?? p.blocks,
		})
	}

	const home = pages.create({ title: 'Start' })
	const about = pages.create({ title: 'Über uns' })
	const news = pages.create({ title: 'News' })
	const events = pages.create({ title: 'Veranstaltungen' })
	const faq = pages.create({ title: 'FAQ', parentId: about.id })
	const contact = pages.create({ title: 'Kontakt' })

	if (Object.keys(config.blocks).length < 5 || !config.collections.news || !config.collections.events) {
		// Custom config: only create the page tree
		for (const p of [home, about, news, events, faq, contact]) publish(p.id)
		return
	}

	publish(home.id, {
		data: { hideTitle: true, description: 'Ein Ort für Begegnung, Austausch und Gemeinschaft.' },
		blocks: [
			block('hero', {
				title: 'Willkommen im Mens Circle',
				subtitle: 'Ein Ort für Begegnung, Austausch und Gemeinschaft – jeden Monat neu.',
				buttons: [
					item({ link: { href: '', page: events.id, label: 'Termine ansehen' }, style: 'primary' }),
					item({ link: { href: '', page: about.id, label: 'Über uns' }, style: 'secondary' }),
				],
			}),
			block('cards', {
				title: 'Was dich erwartet',
				columns: '3',
				items: [
					item({
						icon: '🔥',
						title: 'Ehrlicher Austausch',
						text: 'Ein geschützter Raum, um offen über das zu sprechen, was dich bewegt.',
					}),
					item({
						icon: '🌲',
						title: 'Draußen sein',
						text: 'Wanderungen, Lagerfeuer und gemeinsame Zeit in der Natur.',
					}),
					item({ icon: '🤝', title: 'Gemeinschaft', text: 'Menschen, die zuhören und füreinander da sind.' }),
				],
			}),
			block('collectionList', {
				title: 'Nächste Termine',
				collection: 'events',
				filter: 'upcoming',
				limit: 3,
				layout: 'list',
				more: { href: '', page: events.id, label: 'Alle Veranstaltungen →' },
			}),
			block('collectionList', {
				title: 'Aktuelles',
				collection: 'news',
				limit: 3,
				more: { href: '', page: news.id, label: 'Alle News →' },
			}),
			block('cta', {
				title: 'Lust vorbeizuschauen?',
				text: 'Komm einfach zum nächsten Treffen – eine Anmeldung ist nicht nötig.',
				link: { href: '', page: contact.id, label: 'Kontakt aufnehmen' },
			}),
		],
	})
	publish(about.id, {
		data: { description: 'Wer wir sind und was uns verbindet.' },
		blocks: [
			block('text', {
				content:
					'<p>Wir sind eine offene Gruppe, die sich seit 2019 regelmäßig trifft. <strong>Jede:r ist willkommen.</strong></p>',
			}),
			block('columns', {
				ratio: '1-1',
				left: [
					block('markdown', { content: '### Unsere Werte\n\n- Offenheit\n- Vertrauen\n- Verantwortung' }),
				],
				right: [block('quote', { text: 'Gemeinsam ist man weniger allein.', author: 'Ein Teilnehmer' })],
			}),
		],
	})
	publish(faq.id, {
		blocks: [
			block('accordion', {
				title: 'Häufige Fragen',
				exclusive: true,
				items: [
					item({ question: 'Muss ich mich anmelden?', answer: '<p>Nein, komm einfach vorbei.</p>' }),
					item({
						question: 'Was kostet die Teilnahme?',
						answer: '<p>Die regulären Treffen sind kostenlos, Spenden sind willkommen.</p>',
					}),
					item({
						question: 'Wo finden die Treffen statt?',
						answer: '<p>Im Gemeinschaftshaus – Details stehen beim jeweiligen Termin.</p>',
					}),
				],
			}),
		],
	})
	publish(news.id, { blocks: [block('collectionList', { collection: 'news', limit: 24 })] })
	publish(events.id, {
		blocks: [
			block('collectionList', {
				title: 'Kommende Termine',
				collection: 'events',
				filter: 'upcoming',
				limit: 50,
				layout: 'list',
			}),
			block('collectionList', {
				title: 'Vergangene Termine',
				collection: 'events',
				filter: 'past',
				limit: 12,
				layout: 'list',
			}),
		],
	})
	publish(contact.id, {
		blocks: [
			block('text', {
				content:
					'<p>Schreib uns eine Nachricht an <a href="mailto:hallo@example.org">hallo@example.org</a>.</p>',
			}),
		],
	})

	const n1 = entries.create('news', {
		title: 'Unser neues Programm ist da',
		status: 'published',
		data: {
			date: day(-3),
			category: 'Verein',
			teaser: 'Für das kommende Halbjahr haben wir viele neue Formate geplant.',
			tags: ['Programm', 'Termine'],
			body: [
				block('text', {
					content: '<p>Vom Lagerfeuer-Abend bis zur Wochenend-Wanderung ist für alle etwas dabei.</p>',
				}),
			],
		},
	})
	entries.create('news', {
		title: 'Rückblick: Sommerfest',
		status: 'published',
		data: {
			date: day(-20),
			category: 'Allgemein',
			teaser: 'Ein großartiger Tag mit über 60 Gästen.',
			body: [block('markdown', { content: 'Danke an **alle Helfer:innen**!' })],
			related: [n1.id],
		},
	})
	const events_: [string, number, string, Data][] = [
		['Offener Abend', 7, '19:00', { location: 'Gemeinschaftshaus', price: 0 }],
		['Wanderung im Herbstwald', 21, '10:00', { location: 'Treffpunkt Bahnhof', price: 5 }],
		['Lagerfeuer & Geschichten', -14, '18:30', { location: 'Waldplatz', price: 0 }],
	]
	for (const [title, offset, time, data] of events_)
		entries.create('events', {
			title,
			status: 'published',
			data: {
				start: day(offset, time),
				description: `<p>${title} – wir freuen uns auf dich!</p>`,
				speakers: [item({ name: 'Max Mustermann', role: 'Moderation' })],
				...data,
			},
		})

	settings.set('contact', {
		...settings.get('contact'),
		email: 'hallo@example.org',
		address: 'Musterstraße 1\n12345 Musterstadt',
		social: [item({ network: 'Instagram', url: 'https://instagram.com' })],
	})
	settings.set('footer', {
		...settings.get('footer'),
		text: '<p>Mit ❤️ gebaut mit Bun &amp; Elysia.</p>',
		links: [item({ link: { href: '', page: contact.id, label: 'Impressum' } })],
	})
	console.log('🌱 Demo-Inhalte angelegt')
}
