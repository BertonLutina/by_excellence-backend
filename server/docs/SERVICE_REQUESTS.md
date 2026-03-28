# Service requests API (`/api/service-requests`)

## Authentication

| Method | Auth |
|--------|------|
| `GET /`, `GET /:id`, `PUT`, `DELETE` | Bearer token required |
| `POST /` | Optional (`optionalAuth`). **Clients** get `client_id` set from the JWT. **Guests** and **provider/admin** sessions must send `client_email` + `client_name` on the body; the row is stored with `client_id` null and those fields (so a logged-in provider can still submit the public form).

## `POST /api/service-requests`

### Body (whitelist stored)

| Field | Type | Notes |
|-------|------|--------|
| `provider_id` | number | Required. Must exist in `providers`. |
| `service_description` | string | Required. |
| `provider_name` | string | Optional; defaults to provider `display_name`. |
| `client_name` | string | Required for guests; optional for logged-in clients (defaults to profile). |
| `client_email` | string | Required for guests. |
| `client_phone` | string | Optional. |
| `preferred_date` | `YYYY-MM-DD` | Optional. |
| `budget` | string | Optional. |
| `status` | enum | Default `request_sent`. |
| `is_combo` | boolean | Optional; also inferred if `service_description` contains `=== DEMANDE COMBO ===`. |
| `combo_payload` | object or JSON string | Optional structured combo (see below). |

Unknown fields are not persisted (model only maps known columns).

### Combo: `combo_payload` schema

```json
{
  "primary_provider_id": 12,
  "lines": [
    { "provider_id": 12, "note": "optional per line" },
    { "provider_id": 34, "note": "" }
  ],
  "common_notes": "optional shared notes"
}
```

Rules when `lines` is present:

- At least **2** lines.
- Each `provider_id` must exist; **no duplicate** `provider_id` in `lines`.
- The primary provider from the URL/body may or may not appear in `lines` (product choice).

If `is_combo` is true but only the legacy text in `service_description` is sent (no structured `combo_payload`), validation still succeeds.

### Errors (400)

- Missing `provider_id`, `service_description`, or guest `client_email` / `client_name`.
- Invalid `provider_id` (unknown provider).
- Invalid `status`.
- Invalid `combo_payload` JSON.
- Structured combo: fewer than 2 lines, duplicate provider, or unknown provider id.

## `GET /api/providers`

Public list (optional auth). Sorting:

- `?sort=-rating` → order by `rating` descending.

`rating`, `price_from`, and similar DECIMAL fields are returned as **numbers** in JSON.

Default `limit` is 100; maximum **500**.

## Migration

Apply once:

```bash
mysql -u USER -p DATABASE < server/scripts/migrate-service-requests-combo.sql
```

Fresh installs using `server/config/schema.sql` already include these columns.
