# Applyly API contract

This document describes the active HTTP endpoints implemented under `app/api/applications`. It reflects the current `0.2.0` implementation and preserves the existing UI contract.

## Conventions

- Base URL is the same origin as the running Applyly app, usually `http://localhost:3000`.
- Requests and successful responses use JSON unless noted otherwise.
- Calendar dates use local `YYYY-MM-DD` format. They are not timestamps.
- History and backup timestamps are Unix milliseconds.
- Empty optional text values are stored and returned as `null`.
- Errors currently have no machine-readable `code` field. The contract is HTTP status plus `{ "error": "..." }`.
- The API currently has no authentication, CORS headers, rate limiting, or extension-specific permission model.
- Malformed JSON is normalized to 400 by the backup import route. The create route does not currently normalize JSON parsing failures, so clients should send valid JSON.

## Shared schemas

### Application payload

Used by `POST /api/applications` and `{ "details": ... }` on `PATCH /api/applications/:id`.

```json
{
  "company": "string",
  "role": "string",
  "location": "string",
  "status": "Applied | Phone screen | Assessment | Interview | Offer | Rejected",
  "appliedDate": "YYYY-MM-DD",
  "salary": "string | null",
  "url": "string | null",
  "notes": "string | null",
  "contactEmail": "string | null",
  "source": "string | null",
  "nextStep": "string | null",
  "nextActionDate": "string | null"
}
```

For creation, `company`, `role`, and `appliedDate` are required. `location` defaults to `Remote`; `status` defaults to `Applied`. Other fields are optional. The API validates these fields independently of the UI; clients should still send valid values.

### Validation rules

The create and details-update endpoints validate these fields independently of the UI:

- `status`, when present, must be one of `Applied`, `Phone screen`, `Assessment`, `Interview`, `Offer`, or `Rejected`.
- `appliedDate` is required and must be a real local `YYYY-MM-DD` date.
- `nextActionDate`, when present, must be a real local `YYYY-MM-DD` date.
- `url`, when present, must be an HTTP or HTTPS URL.
- `contactEmail`, when present, must have a valid email shape.

Validation failures return `400` with `{ "error": "..." }`.

### Application response

```json
{
  "id": 123,
  "company": "Example Co",
  "role": "Designer",
  "location": "Remote",
  "status": "Applied",
  "appliedDate": "2026-07-31",
  "salary": null,
  "url": null,
  "notes": null,
  "contactEmail": null,
  "source": null,
  "nextStep": null,
  "nextActionDate": null
}
```

### Error response

```json
{ "error": "Human-readable error message" }
```

## Endpoints

### `GET /api/applications`

Returns applications ordered by applied date descending, then ID descending.

- `200`: `{ "applications": [Application response] }`
- `500`: storage or database failure.

### `POST /api/applications`

Creates an application and its initial status-history record.

Request body: Application payload.

- `201`: `{ "application": Application response }`
- `400`: company or role is missing.
- `400`: applied date is not a valid local `YYYY-MM-DD` date.
- `500`: storage creation failure.

### `GET /api/applications/:id`

Returns status history for the numeric application ID.

`200` response:

```json
{
  "history": [
    {
      "id": 1,
      "status": "Applied",
      "changedAt": 1785492000000,
      "note": "Application created"
    }
  ]
}
```

- `500`: storage or database failure.
- Unknown IDs currently return `200` with an empty history rather than `404`.

### `PATCH /api/applications/:id`

Supports one operation per request.

#### Status update

```json
{ "status": "Interview" }
```

- `200`: `{ "ok": true }`
- `400`: status is missing or blank.
- `404`: application does not exist.
- `500`: storage update failure.

#### Details update

```json
{ "details": { /* Application payload */ } }
```

- `200`: `{ "ok": true, "application": Application response }`
- `400`: invalid applied date, missing company/role, or application not found.
- `500`: storage update failure.

#### Undo status history

```json
{ "undoHistoryId": 7 }
```

Removes the selected history entry and all later entries, restoring the previous status. The initial creation entry cannot be undone.

- `200`: `{ "ok": true, "status": "Interview" }`
- `400`: invalid/missing history entry or attempt to undo the creation entry.
- `500`: storage failure.

### `DELETE /api/applications/:id`

Deletes the application and its status history.

- `200`: `{ "ok": true }`
- `404`: application does not exist.
- `500`: deletion failure.

### `GET /api/applications/analytics`

Returns pipeline metrics calculated from status history. `?year=YYYY` scopes applications by applied year. Missing or invalid year values are treated as all-time.

`200` response:

```json
{
  "totalApplications": 10,
  "reachedAssessment": 6,
  "reachedInterview": 4,
  "reachedOffer": 1,
  "rejected": 3,
  "transitions": {
    "applicationToAssessment": 6,
    "applicationToInterview": 4,
    "applicationToRejected": 3,
    "interviewToOffer": 1,
    "interviewToRejected": 2
  }
}
```

- `500`: storage or database failure.

### `GET /api/applications/backup`

Returns a complete version-1 backup containing applications and status history.

```json
{
  "version": 1,
  "exportedAt": "2026-07-31T12:00:00.000Z",
  "applications": [
    {
      "id": 123,
      "company": "Example Co",
      "role": "Designer",
      "location": "Remote",
      "status": "Applied",
      "appliedDate": "2026-07-31",
      "salary": null,
      "url": null,
      "notes": null,
      "contactEmail": null,
      "source": null,
      "nextStep": null,
      "nextActionDate": null,
      "createdAt": 1785492000000,
      "history": [
        { "status": "Applied", "changedAt": 1785492000000, "note": "Application created" }
      ]
    }
  ]
}
```

- `200`: the backup object above.
- `500`: storage or database failure.

### `POST /api/applications/backup`

Replaces all applications and status history with a valid version-1 backup. The UI asks for confirmation before calling this endpoint; the endpoint itself validates but does not ask for confirmation.

Request body: the version-1 backup object described above.

- `200`: `{ "applications": [Application response] }`
- `400`: malformed or invalid backup, duplicate IDs, invalid required fields, unsupported statuses, invalid timestamps, out-of-order history, or history/status mismatch.

### `DELETE /api/applications/bulk-delete`

Deletes all applications and status-history rows in one D1 batch transaction.

- `200`: `{ "ok": true, "deleted": number }`
- `500`: storage or database failure.

### `GET /api/health`

Returns local API health and capabilities advertised to future clients.

- `200`: `{ "ok": true, "name": "applyly", "version": "0.2.0", "capabilities": string[] }`

## Compatibility rules

- Do not rename existing JSON properties without introducing a new API version.
- Preserve backup `version: 1` imports and exports.
- Clients should tolerate additional response properties.
- This is currently a same-origin local application API, not an extension API. CORS, pairing, permissions, and authentication must be designed before extension clients depend on it.
