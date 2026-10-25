// Block templates. Add a component here (key = block type from cms.config.json) to give a block
// its own markup — blocks without a template are rendered by <GenericBlock> from their field definitions.
import type { FunctionComponent } from 'preact'
import { config } from '../config'
import { type ExpandedBlock, expandEntry, type Link } from '../expand'
import { markdown } from '../html'
import { entries } from '../repo/entries'
import type { Data, Field, Media } from '../types'
import { A, Html, Img } from './components'
import { formatDate, useSite } from './context'

export type BlockProps = { data: Data; block: ExpandedBlock }

const Heading = ({ text, as: Tag = 'h2' }: { text?: string; as?: 'h2' | 'h3' }) =>
	text ? <Tag class="block-title">{text}</Tag> : null

const Hero: FunctionComponent<BlockProps> = ({ data }) => (
	<div class={`hero hero-${data.align ?? 'center'}`} data-has-image={data.image ? '' : undefined}>
		<Img media={data.image} class="hero-bg" sizes="100vw" eager alt="" />
		<div class="hero-content">
			<h1>{data.title}</h1>
			{data.subtitle && <p class="lead">{data.subtitle}</p>}
			{data.buttons?.length > 0 && (
				<div class="buttons">
					{data.buttons.map((b: Data) => (
						<A key={b._id} link={b.link} class={`button ${b.style === 'secondary' ? 'secondary' : ''}`} />
					))}
				</div>
			)}
		</div>
	</div>
)

const Text: FunctionComponent<BlockProps> = ({ data }) => <Html html={data.content} />

const Markdown: FunctionComponent<BlockProps> = ({ data }) => <Html html={markdown(data.content ?? '')} />

const TextImage: FunctionComponent<BlockProps> = ({ data }) => (
	<div class={`split ${data.position === 'left' ? 'split-reverse' : ''}`}>
		<div>
			<Heading text={data.title} />
			<Html html={data.content} />
			<A link={data.link} class="button" />
		</div>
		<Img media={data.image} sizes="(max-width: 48rem) 100vw, 35rem" class="rounded" />
	</div>
)

const Image: FunctionComponent<BlockProps> = ({ data }) => (
	<figure class={data.wide ? 'wide' : ''}>
		<Img media={data.image} class="rounded" />
		{data.caption && <figcaption>{data.caption}</figcaption>}
	</figure>
)

const Gallery: FunctionComponent<BlockProps> = ({ data }) => (
	<>
		<Heading text={data.title} />
		<div class="gallery" style={`--cols:${data.columns ?? 3}`}>
			{(data.images as Media[]).map((m) => (
				<a key={m.id} href={m.url} target="_blank" rel="noopener">
					<Img media={m} sizes={`(max-width: 48rem) 50vw, ${Math.round(70 / (data.columns ?? 3))}rem`} />
				</a>
			))}
		</div>
	</>
)

const embedUrl = (url = '') => {
	const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/)
	if (yt) return `https://www.youtube-nocookie.com/embed/${yt[1]}`
	const vimeo = url.match(/vimeo\.com\/(\d+)/)
	if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}?dnt=1`
	return null
}

const Video: FunctionComponent<BlockProps> = ({ data }) => {
	const src = embedUrl(data.url)
	return (
		<figure>
			{src ? (
				<iframe
					class="video"
					src={src}
					title={data.caption || 'Video'}
					loading="lazy"
					allow="autoplay; fullscreen; picture-in-picture"
					allowFullScreen
				/>
			) : (
				<a href={data.url}>{data.url}</a>
			)}
			{data.caption && <figcaption>{data.caption}</figcaption>}
		</figure>
	)
}

const Accordion: FunctionComponent<BlockProps> = ({ data, block }) => (
	<>
		<Heading text={data.title} />
		<div class="accordion">
			{data.items.map((item: Data) => (
				<details key={item._id} name={data.exclusive ? `acc-${block.id}` : undefined}>
					<summary>{item.question}</summary>
					<Html html={item.answer} />
				</details>
			))}
		</div>
	</>
)

const Cards: FunctionComponent<BlockProps> = ({ data }) => (
	<>
		<Heading text={data.title} />
		{data.intro && <p class="lead">{data.intro}</p>}
		<div class="grid" style={`--cols:${data.columns ?? 3}`}>
			{data.items.map((item: Data) => (
				<article key={item._id} class="card">
					<Img media={item.image} sizes="(max-width: 48rem) 100vw, 25rem" />
					<div class="card-body">
						{item.icon && <span class="card-icon">{item.icon}</span>}
						<h3>{item.title}</h3>
						{item.text && <p>{item.text}</p>}
						<A link={item.link} class="more" />
					</div>
				</article>
			))}
		</div>
	</>
)

const Columns: FunctionComponent<BlockProps> = ({ data }) => (
	<div class={`columns columns-${data.ratio ?? '1-1'}`}>
		<div>
			<Blocks blocks={data.left} />
		</div>
		<div>
			<Blocks blocks={data.right} />
		</div>
	</div>
)

const Quote: FunctionComponent<BlockProps> = ({ data }) => (
	<blockquote class="quote">
		<p>{data.text}</p>
		{data.author && (
			<footer>
				<cite>{data.author}</cite>
				{data.role && <span>, {data.role}</span>}
			</footer>
		)}
	</blockquote>
)

const Cta: FunctionComponent<BlockProps> = ({ data }) => (
	<div class="cta" style={`--cta:${data.color ?? 'var(--accent)'}`}>
		<h2>{data.title}</h2>
		{data.text && <p>{data.text}</p>}
		<A link={data.link} class="button inverted" />
	</div>
)

export function EntryCard({ entry, layout }: { entry: ReturnType<typeof expandEntry>; layout: string }) {
	const { lang } = useSite()
	const def = config.collections[entry.collection]
	const date = def?.dateField ? entry.data[def.dateField] : undefined
	const teaser = entry.data.teaser ?? entry.data.location
	return (
		<article class={layout === 'list' ? 'list-item' : 'card'}>
			{layout !== 'list' && <Img media={entry.data.image} sizes="(max-width: 48rem) 100vw, 25rem" />}
			<div class="card-body">
				{date && <time datetime={date}>{formatDate(date, lang)}</time>}
				<h3>
					<a href={entry.url}>{entry.title}</a>
				</h3>
				{teaser && <p>{teaser}</p>}
			</div>
		</article>
	)
}

const CollectionList: FunctionComponent<BlockProps> = ({ data }) => {
	const site = useSite()
	if (!config.collections[data.collection]) return null
	const { items } = entries.list(data.collection, {
		status: site.preview ? undefined : 'published',
		filter: data.filter,
		limit: data.limit ?? 6,
	})
	const layout = data.layout ?? 'cards'
	return (
		<>
			<Heading text={data.title} />
			{items.length ? (
				<div class={layout === 'list' ? 'list' : 'grid'}>
					{items.map((e) => (
						<EntryCard key={e.id} entry={expandEntry(e, site.expand)} layout={layout} />
					))}
				</div>
			) : (
				<p class="muted">Keine Einträge vorhanden.</p>
			)}
			{data.more && (
				<p>
					<A link={data.more} class="more" />
				</p>
			)}
		</>
	)
}

const RawHtml: FunctionComponent<BlockProps> = ({ data }) => (
	<div dangerouslySetInnerHTML={{ __html: data.code ?? '' }} />
)

const Divider: FunctionComponent<BlockProps> = ({ data }) => (
	<hr class={`divider divider-${data.space ?? 'm'}`} />
)

export const templates: Record<string, FunctionComponent<BlockProps>> = {
	hero: Hero,
	text: Text,
	markdown: Markdown,
	textImage: TextImage,
	image: Image,
	gallery: Gallery,
	video: Video,
	accordion: Accordion,
	cards: Cards,
	columns: Columns,
	quote: Quote,
	cta: Cta,
	collectionList: CollectionList,
	html: RawHtml,
	divider: Divider,
}

/** Fallback renderer: outputs any field type sensibly, so new JSON-defined blocks work immediately */
export function FieldValue({ field, value }: { field: Field; value: any }) {
	const { lang } = useSite()
	if (value == null || value === '' || (Array.isArray(value) && !value.length)) return null
	switch (field.type) {
		case 'richtext':
			return <Html html={value} />
		case 'markdown':
			return <Html html={markdown(value)} />
		case 'image':
			return <Img media={value} class="rounded" />
		case 'file':
			return (
				<a href={value.url} download>
					📎 {value.name}
				</a>
			)
		case 'gallery':
			return (
				<div class="gallery">
					{value.map((m: Media) => (
						<Img key={m.id} media={m} sizes="33vw" />
					))}
				</div>
			)
		case 'link':
			return <A link={value as Link} class="button" />
		case 'boolean':
		case 'color':
			return null
		case 'date':
		case 'datetime':
			return <time datetime={value}>{formatDate(value, lang)}</time>
		case 'tags':
		case 'multiselect':
			return (
				<ul class="tags">
					{value.map((v: string) => (
						<li key={v}>{v}</li>
					))}
				</ul>
			)
		case 'relation':
			return (
				<ul>
					{[value].flat().map((e: Data) => (
						<li key={e.id}>{e.url ? <a href={e.url}>{e.title}</a> : e.title}</li>
					))}
				</ul>
			)
		case 'page':
			return <a href={value.path}>{value.title}</a>
		case 'group':
			return <Fields fields={field.fields ?? []} data={value} />
		case 'repeater':
			return (
				<div class="stack">
					{value.map((item: Data) => (
						<div key={item._id}>
							<Fields fields={field.fields ?? []} data={item} />
						</div>
					))}
				</div>
			)
		case 'blocks':
			return <Blocks blocks={value} />
		case 'code':
			return (
				<pre>
					<code>{value}</code>
				</pre>
			)
		default:
			return field.name === 'title' ? <h2>{value}</h2> : <p>{String(value)}</p>
	}
}

export const Fields = ({ fields, data }: { fields: Field[]; data: Data }) => (
	<>
		{fields.map((f) => (
			<FieldValue key={f.name} field={f} value={data[f.name]} />
		))}
	</>
)

const GenericBlock: FunctionComponent<BlockProps> = ({ data, block }) => (
	<Fields fields={config.blocks[block.type]?.fields ?? []} data={data} />
)

export function Blocks({ blocks }: { blocks: ExpandedBlock[] | undefined }) {
	return (
		<>
			{blocks?.map((block) => {
				const Template = templates[block.type] ?? GenericBlock
				return (
					<section key={block.id} id={`b-${block.id.slice(-8)}`} class={`block block-${block.type}`}>
						<Template data={block.data} block={block} />
					</section>
				)
			})}
		</>
	)
}
