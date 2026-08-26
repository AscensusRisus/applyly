# Applyly

Applyly `0.2.0` is a local-first job application tracker for keeping applications, follow-ups, status changes, and pipeline performance in one place.

It is built with React 19, vinext, Vite, Cloudflare Workers, Cloudflare D1/SQLite, Drizzle ORM, and Drizzle SQL migrations.

## What it includes

- Application pipeline with searchable and filterable statuses
- Optional salary, application URL, contact email, source, next step, and next action date
- Status flow including `Applied`, `Contact`, `Phone screen`, `Assessment`, `Interview`, `Offer`, `Rejected`, and `Withdrawn`
- Persistent status history for every application
- Timeline view for individual application status changes, including undo
- Editable application details, notes, source, contact, next steps, salary, and links
- Insights dashboard with status distribution, pipeline health, reach rates, conversion metrics, and time-based activity
- All-time and year-specific Insights views
- Data page with JSON, CSV, Excel workbook, and printable PDF export options
- JSON, CSV, and Excel import with explicit replacement confirmation
- Settings for display name, default location, default source, and default applied-date behavior
- Local D1/SQLite persistence across development-server restarts
- Versioned extension capability handshake and user-controlled pairing tokens
- Read-only company matching through normalized names, domains, and aliases

The repository includes a Chromium Manifest V3 companion extension in extension/. It uses a versioned, token-paired, read-only API. Localhost access is required; persistent page guidance is optional and requested one site at a time from the extension popup. General CORS access remains disabled.

The extension is experimental and still under active development. Its current matching approach is not yet reliable enough to claim that it can automatically find every job a user previously applied to. Detection can miss or misidentify cards on sites with virtualized feeds, client-rendered content, ambiguous company/role markup, shadow DOM, iframes, or changing job URLs. Use the extension as an assistive guide and verify the detected company and job before acting.

## Requirements

- Node.js `>=22.13.0`
- npm

## Run locally

```bash
npm install
npm run dev
```

Open the URL printed in the terminal, usually `http://localhost:3000`.

Before the development server starts, Applyly automatically applies pending local D1 migrations to the configured persistent state. Wrangler rolls back a failed migration instead of leaving a partially upgraded schema.

To stop the development server, press `Ctrl+C`.

## Data persistence

During local development, application data is stored by the local D1/SQLite runtime under `.wrangler/state`.

This directory is intentionally ignored by Git and survives `npm run dev` restarts. Do not delete it if you want to keep your local applications.

The application data is not stored only in browser localStorage. Browser storage is used for display preferences such as the name, default location, default source, and default applied-date behavior.

When deployed, the application uses the configured Cloudflare D1 database instead of the local state directory.

## Database and migrations

The database schema is defined in `db/schema.ts`. Committed SQL migrations live in `drizzle/`.

The current migration chain includes applications, status history, application metadata, normalized company identity, and local extension pairing state. After changing the Drizzle schema, generate a migration with:

```bash
npm run db:generate
```

Do not commit local database files or `.wrangler/state`.

## API contract

The active HTTP endpoints, request/response schemas, HTTP error statuses, backup format, and compatibility rules are documented in [API_CONTRACT.md](API_CONTRACT.md).

The existing application API remains same-origin for backward compatibility. The extension namespace is read-only, requires a user-generated pairing token, and advertises its supported features through the health endpoint. Extension mutations are intentionally disabled.

## Browser extension

Applyly does not read browser pages by itself. The companion extension supports a one-time **Scan page** action and an optional **Guide this site** mode. Enabling guidance requests access only to the current hostname, registers a refresh-safe content script for that site, and watches newly rendered cards on dynamic or infinite-scroll job feeds.

The extension currently provides these experimental features:

- API and backup version discovery through GET /api/health
- Pairing creation and revocation from Settings
- Token-protected POST /api/extension/match and POST /api/extension/page-match endpoints
- URL-first matching followed by normalized company names, aliases, and company domains
- Structured JobPosting extraction, URL-led semantic job-card detection, and common ATS support without treating ordinary company cards as jobs
- Per-card guidance for exact tracked jobs, similar roles, and broader company history, with local history details and review/open actions
- Mutation-aware rescanning after refreshes, client-side route changes, pagination, and newly rendered feed entries
- A review-first capture handoff that prefills Applyly without granting extension write access
- Duplicate-aware saves, no extension write operations, and no remote telemetry

Known extension issues:

- Some job boards still expose only partial or unstable card information, so company matching and per-card placement can be incomplete or incorrect.
- Dynamic feeds may require the page to finish rendering before scanning; a refresh or route transition can still be needed on some sites.
- Site-specific extraction needs further adapters and real-world testing, especially for application-history pages and authenticated job boards.
- The extension remains read-only and review-first; it does not create or update applications automatically.

To install or reload it locally, follow [extension/README.md](extension/README.md). The extension calls Applyly through its local host permission and never reads D1/SQLite files. Enabled hostnames, the local endpoint, and the pairing token are the only durable extension settings.
## Analytics model

Insights are calculated from status history rather than only the current status. An application that moves through:

```text
Applied -> Assessment -> Interview -> Offer
```

is counted as having reached each stage. The dashboard can show transitions such as Application to Interview, Application to Rejected, Interview to Offer, and Interview to Rejected.

The analytics endpoints are:

```text
GET /api/applications/analytics
GET /api/applications/analytics?year=2026
```

Application history is available at:

```text
GET /api/applications/:id
```

## Dependencies

Runtime dependencies:

- React `19.2.6` and React DOM `19.2.6`
- Next `16.2.6` compatibility/runtime packages used by vinext
- vinext `0.0.50`
- Drizzle ORM `0.45.2`
- fflate `^0.8.3` for browser-side XLSX packaging and reading

Development dependencies include Vite `8.0.13`, the Cloudflare Vite plugin `1.37.1`, Wrangler `4.92.0`, Drizzle Kit `0.31.10`, TypeScript `5.9.3`, ESLint `9.39.4`, React type packages, Tailwind PostCSS, and the React/Vinext build plugins. Exact resolved versions are recorded in `package-lock.json`.

## Useful commands

```bash
npm run dev          # Start local development
npm run build        # Create a production build
npm run start        # Start the production build
npm test             # Build and run regression tests
npm run lint         # Run ESLint
npm run db:generate        # Generate Drizzle migrations
npm run db:migrate:local  # Apply pending migrations to local persistent data
```

## GitHub safety

The repository intentionally ignores local and private files, including:

- `.wrangler/`
- `.npm-cache/`
- `.openai/`
- `.env*` files, except `.env.example`
- SQLite database files
- Build output and local workspace metadata

The personal `.openai/hosting.json` file is kept local. Never commit personal project identifiers or credentials.

## Project structure

```text
app/             React UI and API routes
db/              Drizzle schema
drizzle/         SQL migrations
worker/           Cloudflare Worker entry point
tests/            Build and persistence regression tests
public/           Static assets
API_CONTRACT.md  Active HTTP endpoint contract
```

## License

Applyly is released under the [MIT License](LICENSE).
