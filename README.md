# Applyly

Applyly is a local-first job application tracker for keeping applications, follow-ups, status changes, and pipeline performance in one place.

It is built with React, vinext, Cloudflare Workers, Cloudflare D1/SQLite, and Drizzle migrations.

## What it includes

- Application pipeline with searchable and filterable statuses
- Optional application URL, contact email, source, next step, and next action date
- Status flow including `Applied`, `Phone screen`, `Assessment`, `Interview`, `Offer`, and `Rejected`
- Persistent status history for every application
- Timeline view for individual application status changes
- Insights dashboard with:
  - total applications
  - color-coded status distribution
  - assessment and interview reach rates
  - interview-to-offer conversion
  - interview-to-rejected conversion
  - monthly application activity
- Settings for display name, default location, and data management
- Local D1/SQLite persistence across development-server restarts

## Requirements

- Node.js `>=22.13.0`
- npm

## Run locally

```bash
npm install
npm run dev
```

Open the URL printed in the terminal, usually:

```text
http://localhost:3000
```

To stop the development server, press `Ctrl+C`.

## Data persistence

During local development, application data is stored by the local D1/SQLite runtime under:

```text
.wrangler/state
```

This directory is intentionally ignored by Git and survives `npm run dev` restarts. Do not delete it if you want to keep your local applications.

For a local backup, copy the `.wrangler/state` directory to a safe location. The application data is not stored only in browser localStorage; browser storage is used only for display preferences such as the name and default location.

When deployed, the application uses the configured Cloudflare D1 database instead of the local state directory.

## Database and migrations

The database schema is defined in:

```text
db/schema.ts
```

Committed SQL migrations live in:

```text
drizzle/
```

The current migrations include the applications table, status history, and additional application metadata fields.

After changing the Drizzle schema, generate a migration with:

```bash
npm run db:generate
```

Do not commit local database files or `.wrangler/state`.

## Analytics model

Insights are calculated from status history rather than only the current status. This means an application that moves through:

```text
Applied -> Assessment -> Interview -> Offer
```

is counted as having reached each stage. The dashboard can therefore show meaningful transitions such as:

- Application -> Interview
- Application -> Rejected
- Interview -> Offer
- Interview -> Rejected

The analytics API is available at:

```text
GET /api/applications/analytics
```

Application history is available at:

```text
GET /api/applications/:id
```

## Useful commands

```bash
npm run dev       # Start local development
npm run build     # Create a production build
npm run start     # Start the production build
npm test          # Build and run regression tests
npm run lint      # Run ESLint
npm run db:generate  # Generate Drizzle migrations
```

## GitHub safety

The repository intentionally ignores local and private files, including:

- `.wrangler/`
- `.npm-cache/`
- `.openai/`
- `.env*` files, except `.env.example`
- SQLite database files
- build output and local workspace metadata

The personal `.openai/hosting.json` file is kept local. If hosting configuration is needed, create it locally from the example configuration and never commit personal project identifiers or credentials.

## Project structure

```text
app/       React UI and API routes
db/        Drizzle schema
drizzle/   SQL migrations
worker/    Cloudflare Worker entry point
tests/     Build and persistence regression tests
public/    Static assets
```

## License

Applyly is released under the [MIT License](LICENSE).

