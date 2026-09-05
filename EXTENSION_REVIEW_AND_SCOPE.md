# Applyly extension review and scope

Date: 2026-09-05. Extension version: 0.5.0.

## Product direction being pursued

Make Applyly a useful companion while reading a job posting: capture the selected job, correct the details, optionally check previous applications, and open a reviewable draft in the local tracker. Success means a user can transfer a job without manually copying its company, role, and URL, even when history pairing has not been configured.

The current milestone delivers this capture workflow. Future scope below is a proposed development sequence, not a scheduled background task or a claim that those features exist.

## Review findings

- Popup scanning called the health/pairing check before reading the page. A stopped server, missing token, or setup failure made even capture unusable.
- Connection status trusted that a token existed and the server reported pairing enabled. It did not authenticate the supplied token, so invalid tokens could appear connected.
- Collection scans exposed matched history but offered no popup capture path for a selected, previously unseen job. Those new jobs are often exactly what users need to track.
- Only the company could be corrected. Incorrect role or URL extraction could pass into the app unchanged.
- Failed scans could retain old page context and results. Editing a candidate also needed to invalidate history, including responses still in flight.
- Popup history records were informational rather than links to the corresponding application.
- Existing extension tests mostly asserted source strings and manifest contracts. They did not execute the popup workflow.
- App integration already supports bounded capture parameters, explicit review before save, record deep links, duplicate protection, and paired read-only matching. This milestone uses those contracts; no application database schema or existing records were modified.

## Implemented changes

- Capture is the first popup action. Reading the current tab makes no local API request and requires no pairing token.
- A job selector exposes all detected candidates, including jobs with no local history. Company, role, and URL are editable. Empty extraction falls back to the current page URL for manual entry.
- Keep draft stores one explicit browser-local draft. It restores after reopening the popup. A subsequent kept draft replaces it; discard explicitly removes it. Ordinary unsaved edits remain temporary.
- Review captured job in Applyly retains that draft and opens the existing app form. It never records an application automatically. The draft stays until discarded because opening a tab does not confirm a successful app save.
- Check history authenticates the configured token and checks the selected, edited job. Results link directly to the existing record. Exact matches do not prevent opening a draft; the user can inspect the record and the app retains duplicate protection.
- Failed rescans clear old capture controls and results. Edits and selection changes clear results; superseded requests cannot repopulate them.
- Local address configuration works without a token. Popup requests and background configuration enforce localhost/127.0.0.1 HTTP origins. Background capture handoff no longer requires a token.
- Guide this site is retained as a secondary experimental feature, with the existing opt-in host permissions.
- Updated installation/privacy documentation and added executable popup regression tests to npm test.

## Validation

- Popup regression tests: unpaired capture without network requests; collection selection and edited handoff; kept draft restoration/discard; rejected token status; failed rescan cleanup; manual fallback; invalid URL/remote endpoint rejection; exact application deep link.
- Existing manifest, extension contract, and page-reader tests passed.
- JavaScript syntax checks passed. Repository lint passed.
- Production build and the full npm test suite passed, including the isolated API integration test that writes a record, restarts the server, verifies persistence, and enforces extension contracts. The new popup suite has 11 behavioral tests, including late response invalidation, offline history fallback, and token-free endpoint configuration.
- The popup tests execute the real script with a simulated DOM and Chrome APIs. They are not an installed-extension browser test.
- Live browser automation could not initialize: Windows sandbox helper_unknown_error. No claim is made of visual popup QA, real Chrome permission prompts, or authenticated LinkedIn/Indeed/Wellfound behavior.

## Extraction reliability phase update

The first part of the extraction phase is now implemented and covered by executable sanitized HTML fixtures:

- Nested structured JobPosting data is traversed through common mainEntity, mainEntityOfPage, hasPart, @graph, and itemListElement containers. Schema type URLs and object-shaped job URLs are accepted.
- LinkedIn-style split-pane cards are recognized through data-job-id and data-occludable-job-id. If a job link itself also contains a job-card class, extraction climbs to the surrounding card before reading company fields.
- tests/fixtures/structured-jobposting.html and tests/fixtures/linkedin-split-pane.html run the real page-context script with a small fixture DOM harness. This verifies extracted company, role, URL, detail/collection mode, and nested structured data behavior.

This is fixture-based reliability evidence, not live support for every LinkedIn layout or authenticated job board. Manual correction remains part of the workflow, and the real-browser acceptance phase is still required.

## Future scope, in priority order

1. Real-browser acceptance: reload version 0.5.0 in Chrome/Edge, capture a single posting and a collection entry, correct fields, close/reopen a kept draft, start Applyly, save with an explicit date, and reopen the exact record. Repeat with revoked pairing and the local server stopped. Confirm existing app duplicate behavior from an actual browser handoff.
2. Extraction reliability continuation: add more sanitized fixtures for supported ATS and job-board layouts, then test each adapter against a fixture before claiming support. Keep manual editing available.
3. Draft inbox, only after the single-draft workflow is validated: multiple explicitly saved jobs, URL deduplication, deletion, clear unsaved versus applied states, and a bounded retention policy. This version intentionally keeps one draft, not an application database copy.
4. Guidance hardening: cancel and discard obsolete background scans, remove already-rendered overlays on every matching tab when site access is disabled, and verify route changes and virtualized lists in a real browser. Popup request invalidation is implemented; these broader guide lifecycle changes remain future work.
5. Main app follow-up: if collecting jobs before applying becomes a core use case, introduce an explicit prospect/inbox state with additive migration and tests. Do not silently assign an applied date to a captured job.

## Excluded from this milestone

Automatic applications, form autofill/submission, bulk scraping, remote synchronization, AI-generated application text, extension-side application writes, and universal job-board support. No deployment or publishing was performed.

## Local use

Reload the unpacked extension from this repository's extension directory. Open a job page, choose Scan page, select/edit the job, and choose Keep draft or Review captured job in Applyly. Run npm run dev before saving in the local app. Configure pairing only when you want Check history or experimental site guidance.
