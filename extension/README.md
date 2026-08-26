# Applyly Companion

Applyly Companion is the privacy-first Chromium extension for a locally running Applyly instance. It marks job cards that match your local application history without copying the application database into the extension.

> Status: experimental and actively under development. The current detector is a useful foundation, but it is not yet reliable enough to identify every previously applied job across all job boards. Always verify a detected company, role, and URL in Applyly.

## Install locally

1. From the repository root, run **npm install** and **npm run dev**.
2. Open Applyly Settings and create a browser-extension pairing token. Copy it immediately; Applyly stores only its hash.
3. Open **chrome://extensions** or **edge://extensions** and enable Developer mode.
4. Choose **Load unpacked** and select this **extension** directory.
5. Open the extension, expand **Connection settings**, paste the token, and choose **Save and connect**.

If Applyly runs on a different local port, enter that full local origin, for example **http://localhost:4173**.

The committed public manifest key gives development installs the stable extension ID **febphjmgnkpofbinjebefmenfldbjbbb**. Applyly's development server allows that exact extension origin. If you loaded an earlier keyless build, remove it once and load this directory again. For later code updates, use **Reload** on the extension card and refresh the job page; deleting the extension is not required.

## Current known limitations

- Detection is based on currently rendered page content. Virtualized lists, closed shadow DOM, cross-origin iframes, client-only fields, and unstable job URLs can prevent a match.
- Some boards expose platform branding or incomplete company/role markup, which can lead to missed cards or incorrect company history.
- Persistent guidance may need a refresh or route change after a site finishes loading new content.
- Site-specific adapters and broader authenticated job-board testing are still being developed.
- Matching and capture are assistive only. The extension never saves or changes an application automatically.

## Two ways to use it

### Guide a job site

Open a job board or careers site, click the extension, and choose **Enable** under **Guide this site**. Chrome asks for access to that exact site. Once enabled, Applyly:

1. watches the rendered job feed as it loads, changes route, paginates, or adds infinite-scroll results;
2. detects up to 100 visible job entries per scan using job links, structured JobPosting data, semantic card attributes, and conservative card fallbacks;
3. compares normalized job URLs first, followed by company domains, names, and aliases through the paired local API;
4. adds non-layout-shifting guidance to every matching job card and reports how many visible cards have history;
5. distinguishes an exact tracked job, a similar tracked role, and broader history with the same company;
6. opens a compact history panel where you can inspect tracked roles, open the exact Applyly record, or review the visible job as a prefilled draft.

The content script is registered only for sites you enable and persists across page refreshes and browser restarts. Choose **Disable** in the same popup to unregister it and remove that site's permission.

### Scan once

Choose **Scan page** when you want a one-time check without enabling persistent guidance. On a single job page you can correct the detected company and review a prefilled Applyly draft. The extension never saves an application itself.

Browser-internal pages and extension-store pages cannot be scanned.

## Matching behavior

Exact normalized job URLs are the strongest signal. Applyly recognizes stable Wellfound, LinkedIn, and Indeed job identifiers even when tracking parameters or URL formatting differ. If the URL is unavailable or has changed, company identity and role text provide lower-confidence context.

Company-history guidance does not claim that the visible job itself was previously applied to. It means Applyly found one or more local applications associated with that employer. Open the guidance panel to inspect tracked roles, statuses, and dates.

Only rendered page content can be inspected. Jobs hidden behind a closed shadow root, a cross-origin iframe, or content not yet loaded into a virtualized feed may appear only after the site renders them. The mutation-aware guide rescans when new visible cards arrive.

## Privacy and security

- No remote backend, analytics, telemetry, or third-party requests.
- Required host access is limited to local Applyly. Job-site access is optional and requested for the current hostname only when you enable guidance.
- There is no static all-sites content script and no all-sites permission.
- Application records stay in Applyly's local D1/SQLite database.
- The extension stores the local Applyly origin, pairing token, and enabled site patterns in browser-local extension storage.
- Visible job candidates and match results are processed ephemerally. A short in-memory tab cache avoids duplicate requests and is discarded with the extension worker or tab.
- Matching and capture remain read-only. Capture passes bounded job details in a localhost URL for review; API version 1 exposes no extension mutation capability.
- Localhost host permissions exist only so the popup and service worker can call the local Applyly API.

Treat the pairing token like a local password. Revoke it from Applyly Settings if the browser profile or computer is shared or compromised. See [PRIVACY.md](PRIVACY.md) for the data-flow inventory.

## Current boundaries

- Chromium Manifest V3; Chrome and Edge load-unpacked workflows are supported.
- Persistent guidance is opt-in per site.
- Collection scans are bounded to 100 currently rendered candidates and 25 returned history records per candidate.
- Matching is local and read-only.
- Application creation, application updates, remote synchronization, developer-visible analytics, and background access to sites you did not enable remain excluded.