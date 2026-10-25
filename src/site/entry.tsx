// Detail templates for collection entries (key = collection name). Collections without a
// template use <GenericEntry>, which renders all fields from the config.
import type { FunctionComponent } from 'preact'
import { config } from '../config'
import type { expandEntry } from '../expand'
import type { Data } from '../types'
import { Blocks, EntryCard, Fields } from './blocks'
import { A, Html, Img } from './components'
import { formatDate, useSite } from './context'

type EntryProps = { entry: ReturnType<typeof expandEntry> }

const Back = ({ collection }: { collection: string }) => {
	const route = config.collections[collection]?.route
	return route ? (
		<a href={route.split('/').slice(0, -1).join('/') || '/'} class="back">
			← Zurück
		</a>
	) : null
}

const News: FunctionComponent<EntryProps> = ({ entry }) => {
	const { lang } = useSite()
	const { data } = entry
	return (
		<article class="entry">
			<header class="entry-header">
				<p class="meta">
					<time datetime={data.date}>{formatDate(data.date, lang)}</time>
					{data.category && <span class="badge">{data.category}</span>}
				</p>
				<h1>{entry.title}</h1>
				{data.teaser && <p class="lead">{data.teaser}</p>}
			</header>
			<Img media={data.image} class="rounded" eager />
			<Blocks blocks={data.body} />
			{data.tags?.length > 0 && (
				<ul class="tags">
					{data.tags.map((t: string) => (
						<li key={t}>{t}</li>
					))}
				</ul>
			)}
			{data.related?.length > 0 && (
				<aside>
					<h2>Weitere Artikel</h2>
					<div class="grid">
						{data.related.map((e: EntryProps['entry']) => (
							<EntryCard key={e.id} entry={e} layout="cards" />
						))}
					</div>
				</aside>
			)}
			<Back collection={entry.collection} />
		</article>
	)
}

const Event: FunctionComponent<EntryProps> = ({ entry }) => {
	const { lang } = useSite()
	const { data } = entry
	return (
		<article class="entry">
			<header class="entry-header">
				<h1>{entry.title}</h1>
				<dl class="facts">
					<dt>Wann</dt>
					<dd>
						<time datetime={data.start}>{formatDate(data.start, lang)}</time>
						{data.end && (
							<>
								{' – '}
								<time datetime={data.end}>{formatDate(data.end, lang)}</time>
							</>
						)}
					</dd>
					{data.location && (
						<>
							<dt>Wo</dt>
							<dd>{data.location}</dd>
						</>
					)}
					{data.price != null && (
						<>
							<dt>Eintritt</dt>
							<dd>
								{data.price === 0
									? 'frei'
									: new Intl.NumberFormat(lang, { style: 'currency', currency: 'EUR' }).format(data.price)}
							</dd>
						</>
					)}
				</dl>
				<A link={data.tickets} class="button" />
			</header>
			<Img media={data.image} class="rounded" eager />
			<Html html={data.description} />
			{data.speakers?.length > 0 && (
				<section>
					<h2>Mitwirkende</h2>
					<ul class="people">
						{data.speakers.map((s: Data) => (
							<li key={s._id}>
								<Img media={s.photo} sizes="6rem" />
								<strong>{s.name}</strong>
								{s.role && <span>{s.role}</span>}
							</li>
						))}
					</ul>
				</section>
			)}
			{data.attachments && (
				<p>
					<a href={data.attachments.url} class="button secondary" download>
						📎 {data.attachments.name}
					</a>
				</p>
			)}
			<Back collection={entry.collection} />
		</article>
	)
}

const GenericEntry: FunctionComponent<EntryProps> = ({ entry }) => (
	<article class="entry">
		<h1>{entry.title}</h1>
		<Fields fields={config.collections[entry.collection]?.fields ?? []} data={entry.data} />
		<Back collection={entry.collection} />
	</article>
)

export const entryTemplates: Record<string, FunctionComponent<EntryProps>> = { news: News, events: Event }
export const EntryView = ({ entry }: EntryProps) => {
	const Template = entryTemplates[entry.collection] ?? GenericEntry
	return <Template entry={entry} />
}
