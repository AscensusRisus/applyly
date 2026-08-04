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

The browser extension is not part of the current release. The existing API is a same-origin local application API; extension-specific CORS, pairing, permissions, and authentication are future work.

## Requirements

- Node.js `>=22.13.0`
- npm

## Run locally

```bash
npm install
npm run dev
```

Open the URL printed in the terminal, usually `http://localhost:3000`.

To stop the development server, press `Ctrl+C`.

## Data persistence

During local development, application data is stored by the local D1/SQLite runtime under `.wrangler/state`.

This directory is intentionally ignored by Git and survives `npm run dev` restarts. Do not delete it if you want to keep your local applications.

The application data is not stored only in browser localStorage. Browser storage is used for display preferences such as the name, default location, default source, and default applied-date behavior.

When deployed, the application uses the configured Cloudflare D1 database instead of the local state directory.

## Database and migrations

The database schema is defined in `db/schema.ts`. Committed SQL migrations live in `drizzle/`.

The current migration chain includes the applications table, status history, and application metadata fields. After changing the Drizzle schema, generate a migration with:

```bash
npm run db:generate
```

Do not commit local database files or `.wrangler/state`.

## API contract

The active HTTP endpoints, request/response schemas, HTTP error statuses, backup format, and compatibility rules are documented in [API_CONTRACT.md](API_CONTRACT.md).

The current API is same-origin and local-first. It does not yet provide extension-specific CORS, authentication, pairing, or permission controls.

## Analytics model

Insights are calculated from status history rather than only the current status. An application that moves through:

```text
Applied -> Assessment -> Interview -> Offer
```

is counted as having reached each stage. The dashboard can show transitions such as Application → Interview, Application → Rejected, Interview → Offer, and Interview → Rejected.

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
npm run db:generate  # Generate Drizzle migrations
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
