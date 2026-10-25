# mens-clicle-cms

Ein schlankes, blockbasiertes CMS auf **Bun 1.4** und **Elysia 2** (RC). Inhaltselemente, Sammlungen (News, Veranstaltungen, …) und globale Einstellungen werden per JSON konfiguriert. Ausgeliefert wird alles als **eine einzige Binärdatei**.

```bash
bun install
bun run dev            # Entwicklung (Watch-Modus, HMR im Admin)
bun --bun run start    # Produktion
bun run build          # → dist/cms  (Single Binary inkl. Admin, CSS, Default-Config)
./dist/cms
```

Danach `http://localhost:3000/admin` öffnen. Beim ersten Start wird das Admin-Konto angelegt, und eine leere Datenbank bekommt Demo-Inhalte (abschalten mit `SEED=false`).

## Stack und Entscheidungen

| Bereich | Lösung |
| --- | --- |
| Server | Elysia 2 (`2.0.0-rc.0`), TypeBox-Validierung, Auth per Macro (`{ auth: true }`) |
| Datenbank | `bun:sqlite` (WAL, Migrationen über `PRAGMA user_version`), Inhalte als JSON-Spalten |
| Frontend-Templating | **`@elysia/html` mit Kita-JSX** (`/** @jsxImportSource @kitajs/html */`): TSX-Komponenten, die direkt zu Strings rendern, ohne Virtual DOM. Nutzerinhalte stehen in Elementen mit `safe` (escaped), `bun run lint` prüft das mit `xss-scan`. Der Render-Kontext läuft über `AsyncLocalStorage`. Kein Client-JS auf der Website (Akkordeon = natives `<details name>`) |
| Admin | Preact + Signals als SPA (nur hier, nicht auf der Website), gebündelt über Bun-HTML-Imports (HMR im Dev, im Binary eingebettet) |
| Drag & Drop | Native HTML5-DnD, keine Bibliothek (Seitenbaum, Blöcke, Repeater, Galerien) |
| Bilder | `Bun.Image`: Metadaten, ThumbHash-Platzhalter, WebP-Varianten on demand (Cache in `data/cache`), Drehen |
| Rich Text / Markdown | `HTMLRewriter` als Sanitizer, `Bun.markdown` für Markdown |
| Passwörter | `Bun.password` (argon2id), Sessions in SQLite, Cookie `HttpOnly; SameSite=Strict` |
| Performance | Gerenderte Seiten werden im Speicher gecacht (inkl. gzip) und bei jeder Änderung invalidiert |
| Qualität | TypeScript 7 nativ (`bun run typecheck`), Biome und `xss-scan` (`bun run lint`), `bun test`. TypeScript 5.9 liegt nur für `@kitajs/ts-html-plugin` bei, das die JS-API von TS braucht |

## Konfiguration: `cms.config.json`

Die Datei definiert **Blöcke**, **Sammlungen**, **Einstellungen** und zusätzliche **Seitenfelder**. `cms.schema.json` liefert Autovervollständigung im Editor (neu erzeugen mit `bun run schema`). Beim Start wird die Config validiert, inklusive Querverweisen wie unbekannten Sammlungen oder Blöcken.

Gesucht wird in dieser Reihenfolge: `CMS_CONFIG`, dann `./cms.config.json` im Arbeitsverzeichnis, sonst die beim Build eingebettete Config.

```jsonc
{
  "blocks": {
    "teaser": {
      "label": "Teaser", "icon": "🎯", "category": "Inhalt",
      "fields": [
        { "name": "title", "type": "text", "label": "Titel", "required": true },
        { "name": "image", "type": "image", "width": "half" },
        { "name": "items", "type": "repeater", "itemLabel": "title", "fields": [
          { "name": "title", "type": "text" },
          { "name": "body", "type": "richtext" }
        ]}
      ]
    }
  },
  "collections": {
    "jobs": { "label": "Jobs", "route": "/jobs", "dateField": "date", "fields": [ … ] }
  },
  "settings": {
    "general": { "label": "Allgemein", "fields": [ … ] }
  }
}
```

Ein neuer Block ist sofort im Admin nutzbar und wird ohne eigenes Template automatisch generisch gerendert. Für eigenes Markup legst du in `src/site/blocks.tsx` eine Komponente an (Schlüssel = Blocktyp). Texte aus Inhalten gehören in Elemente mit `safe`, z. B. `<h2 safe>{data.title}</h2>`. Bereits bereinigtes HTML (Rich Text) wird über `<Html html={…} />` ausgegeben. Detailseiten von Sammlungen bekommen ihr Template in `src/site/entry.tsx`.

### Feldtypen

| Typ | Wert | Optionen |
| --- | --- | --- |
| `text`, `textarea`, `email`, `url` | String | `max`, `placeholder`, `rows` |
| `richtext` | HTML (wird serverseitig bereinigt) | |
| `markdown`, `code` | String | `rows` |
| `number` | Zahl | `min`, `max`, `step` |
| `boolean` | true/false | |
| `select`, `multiselect` | String / String[] | `options` (String oder `{value,label}`) |
| `date`, `datetime`, `time`, `color` | ISO-String / `#rrggbb` | |
| `tags` | String[] | `min`, `max` |
| `link` | `{ href, label, target, page }` (interne Seite oder URL) | |
| `image`, `file` | Media-ID | `accept` (z. B. `application/pdf`) |
| `gallery` | Media-ID[] (sortierbar) | `min`, `max` |
| `relation` | Eintrag-ID(s) | `collection`, `multiple` |
| `page` | Seiten-ID | |
| `group` | Objekt | `fields` |
| `repeater` | Objekt[] (sortierbar, beliebig verschachtelbar) | `fields`, `min`, `max`, `itemLabel` |
| `blocks` | verschachtelte Blöcke | `allow` |

Alle Felder kennen `label`, `help`, `required`, `default` und `width` (`full`/`half`/`third`). Für jede Feldliste wird ein kompilierter TypeBox-Validator erzeugt.

## Routing (Website)

- Seiten bilden einen Baum, die URL ergibt sich aus den Slugs (`/ueber-uns/faq`). Die erste Root-Seite mit leerem Slug ist die Startseite `/`.
- Einträge einer Sammlung mit `route` sind unter `<route>/<slug>` erreichbar.
- Angemeldete Redakteur:innen sehen mit `?preview` auch Entwürfe.
- Dazu kommen `/sitemap.xml`, `/robots.txt` und `/media/:id/:name?w=640&f=webp` (responsive Bilder mit `srcset`).

## API

- Admin (Session): `/api/pages`, `/api/collections/:name`, `/api/media`, `/api/settings`, `/api/users`, `/api/config`
- Headless, öffentlich und schreibgeschützt mit aufgelösten Referenzen: `/api/content/page?path=/`, `/api/content/navigation`, `/api/content/settings`, `/api/content/:collection`, `/api/content/:collection/:slug`

## Umgebungsvariablen

| Variable | Default |
| --- | --- |
| `PORT` / `HOST` | `3000` / `0.0.0.0` |
| `DATA_DIR` | `./data` (Datenbank, Uploads, Bild-Cache) |
| `DATABASE` | `$DATA_DIR/cms.db` |
| `CMS_CONFIG` | `./cms.config.json` |
| `SEED` | `true` |

## Projektstruktur

```
cms.config.json      Blöcke, Sammlungen, Einstellungen
src/
  app.ts index.ts    Elysia-App und Start
  config.ts          Config-Schema (TypeBox) und Laden
  fields.ts          Feld-Definitionen → Validatoren
  expand.ts          Referenzen auflösen (Medien, Relationen, Links, Blöcke)
  repo/              SQLite-Zugriff (pages, entries, media, settings, users)
  api/               Elysia-Routen (auth, content, public)
  site/              SSR-Website: Layout, Block- und Eintrags-Templates, CSS
  admin/             Admin-SPA (Preact)
tests/               bun test
```
