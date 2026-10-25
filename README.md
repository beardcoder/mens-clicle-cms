# mens-clicle-cms

Ein schlankes, blockbasiertes CMS auf **Bun 1.4** und **Elysia 2** (RC). Inhaltselemente, Sammlungen (News, Veranstaltungen, …) und globale Einstellungen werden per JSON konfiguriert. Ausgeliefert wird alles als **eine einzige Binärdatei**.

```bash
bun install
bun run dev            # Entwicklung (Watch-Modus, HMR im Admin)
bun --bun run start    # Produktion
bun run build          # → dist/cms  (Single Binary inkl. Admin, CSS, Default-Config)
./dist/cms
docker compose up --build   # oder als Container (siehe Deployment)
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
| Betrieb | Dockerfile (distroless, non-root, Healthcheck), Backup-Download und `cms restore`, Graceful Shutdown, Security-Header, CI über GitHub Actions |
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
| `SEED` | `true` (Demo-Inhalte bei leerer Datenbank) |
| `MAX_UPLOAD_MB` | `64` (maximale Request-Größe für Uploads) |

## Deployment mit Docker / Coolify

Die `Dockerfile` baut in zwei Stufen. Zuerst laufen Tests und `bun build --compile`, dann kommt nur die Binary in ein **distroless**-Image (glibc, keine Shell, User `nonroot` mit UID 65532, ca. 64 MB komprimiert). Der `HEALTHCHECK` ruft `cms --health` auf, ein Stoppen per `SIGTERM` beendet laufende Requests und schließt die Datenbank sauber.

**Coolify:**

1. *New Resource → Public/Private Repository* wählen, Build Pack **Dockerfile**.
2. *Ports Exposes*: `3000`. Domain eintragen, HTTPS übernimmt Coolify (Traefik).
3. *Persistent Storage → Volume Mount*: Destination Path **`/app/data`**. Ohne Volume gehen Datenbank und Uploads beim nächsten Deploy verloren.
4. Optional unter *Environment Variables*: `SEED=false` (keine Demo-Inhalte), `MAX_UPLOAD_MB`.
5. Deployen und `https://<domain>/admin` öffnen. Der erste Besuch legt das Admin-Konto an, also **direkt nach dem Deploy erledigen**.

Hinweise:

- Hinter dem Proxy setzt das CMS das Session-Cookie anhand von `X-Forwarded-Proto` als `Secure`. Fehlgeschlagene Logins werden pro Client-IP begrenzt (10 in 15 Minuten).
- Ein benanntes Volume übernimmt beim ersten Mounten die Rechte aus dem Image. Bei einem **Bind Mount** (Host-Verzeichnis) muss das Verzeichnis der UID 65532 gehören: `chown -R 65532:65532 /pfad`.
- Änderungen an `cms.config.json` kommen per Redeploy ins Image (die Config ist in der Binary eingebettet). Alternativ eine Datei nach `/app/cms.config.json` mounten, dann reicht ein Neustart.
- Alternativ `compose.yaml` als *Docker Compose*-Ressource verwenden, lokal genügt `docker compose up --build`.

## Backup & Restore

- **Backup:** Im Admin unter *Übersicht → Backup herunterladen* oder per `GET /api/backup` (mit Login). Geliefert wird ein `.tar.gz` mit einem konsistenten Datenbank-Snapshot (`VACUUM INTO`) und allen Uploads, gestreamt ohne Zwischendatei.
- **Restore** bei gestopptem Server:

  ```bash
  ./dist/cms restore cms-backup.tar.gz
  # Docker / Coolify (Container vorher stoppen):
  docker run --rm -v <volume>:/app/data -v $PWD/cms-backup.tar.gz:/backup.tar.gz:ro <image> restore /backup.tar.gz
  ```

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
