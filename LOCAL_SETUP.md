# Applyly - Local setup

This is the local copy of the job application tracker.

## Run locally

```powershell
npm run dev
```

Open the local URL printed by the terminal. The production build has already been verified with:

```powershell
npm run build
```

The app uses the configured D1/SQLite binding for applications. Local `npm run dev` state is persisted under `.wrangler/state` and is reused across restarts. The `drizzle/` migration directory is applied by the local D1 binding; the API also safely creates the table if an existing local database has not been migrated yet.


