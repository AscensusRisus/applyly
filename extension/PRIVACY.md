# Applyly Companion privacy model

Applyly Companion is designed for a local Applyly instance. It has no vendor server and sends no job-search or application data to the project developer.

## Data stored in the browser profile

- applylyEndpoint: the local Applyly origin, normally http://localhost:3000
- applylyPairingToken: the user-created local API token
- applylyCaptureDraft: one company, role, and job URL, stored when you choose Keep draft or Review captured job in Applyly; retained until explicitly discarded or replaced by another kept draft
- applylyGuidedOrigins: the site patterns for which the user explicitly enabled persistent guidance

These values use browser-local extension storage. Application records are not copied into browser storage.

Capturing a page requires no API request. Checking connection authenticates the token using a synthetic job URL at connection-check.invalid, sent only to localhost; the extension does not contact that domain. Opening a draft puts its fields in a localhost URL, which can appear in browser history.

## Ephemeral data

For enabled tabs, the extension reads visible job-card fields such as company, role, and job URL. It sends those bounded candidates to the paired localhost POST /api/extension/page-match endpoint. Match results remain in memory long enough to mark the current page. A short per-tab fingerprint cache reduces duplicate local requests.

Reloading the extension, ending its worker, or closing the tab discards this in-memory data.

## Network boundaries

The extension calls only the configured localhost Applyly origin. It has no analytics SDK, telemetry endpoint, remote synchronization service, or third-party API. Job pages are read from the browser DOM; the extension does not re-request them from a separate server.

## Permissions

Localhost host permissions are required so the extension can call Applyly. Access to ordinary HTTP and HTTPS job sites is declared as optional. The popup requests only the current site's hostname after the user chooses **Enable**. Disabling guidance unregisters the content script and removes that site permission.

The extension has no static all-sites content script and does not request a permanent all-sites permission.

## Mutation boundary

Extension API version 1 is read-only. Matching does not create, update, or delete applications. Captured details open a prefilled localhost draft and require explicit review in Applyly before the existing UI saves anything.