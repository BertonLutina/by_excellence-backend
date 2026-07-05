# Provider collaboration

Multi-provider missions (combo requests) and post-creation invitations.

## Data model

### `service_requests`

| Column | Purpose |
|--------|---------|
| `provider_id` | Lead provider |
| `is_combo` | `true` when multiple providers are involved |
| `combo_payload` | JSON: `{ primary_provider_id, lines[], common_notes }` |

### `service_request_collaborators`

Tracks participants beyond the legacy `provider_id` field.

| Column | Notes |
|--------|-------|
| `role` | `lead` or `partner` |
| `status` | `invited`, `accepted`, `declined`, `removed` |
| `invited_by_provider_id` | Set when a lead invites a partner after creation |

On combo creation with structured `combo_payload`, rows are synced automatically (lead + partners start as `accepted` when submitted by the client).

### Offers

Index `uq_offer_request_provider` on `(request_id, provider_id)` — each collaborator may submit **one** offer per request.

## API

| Method | Path | Who |
|--------|------|-----|
| `GET` | `/api/service-requests/:id/collaborators` | Authenticated |
| `POST` | `/api/service-requests/:id/collaborators` | Lead provider or admin |
| `PUT` | `/api/service-requests/:id/collaborators/:providerId` | Invited provider (`accepted` / `declined`) |
| `DELETE` | `/api/service-requests/:id/collaborators/:providerId` | Lead or admin (soft-remove) |

### Create combo request

```json
POST /api/service-requests
{
  "provider_id": 42,
  "is_combo": true,
  "combo_payload": {
    "primary_provider_id": 42,
    "lines": [
      { "provider_id": 42, "note": "Site web" },
      { "provider_id": 17, "note": "Photos" }
    ],
    "common_notes": "Budget global"
  },
  "service_description": "…"
}
```

Validation: `lines.length >= 2`, unique provider IDs, all providers exist, primary in lines. Cannot combine with `selected_items` basket.

### Provider request list

`GET /api/service-requests?provider_id=X` returns requests where the provider is lead **or** an accepted/invited collaborator.

## Notifications

- Combo created → all collaborators
- Invite / accept / decline → relevant parties
- Status changes → all active collaborators (not only `provider_id`)

## Frontend

- `RequestForm.jsx` — sends structured `combo_payload`
- `RequestCollaborators.jsx` — admin + provider dashboard UI
- `AdminRequestDetail.jsx` — collaborators + combo offer total
- `ProviderDashboard.jsx` — partner badge, invite/accept, gated offer creation

## Migrations

Automatic on server start (`startupService.ensureCollaboratorsTable`) or manual:

```bash
mysql -u … -p … < server/scripts/migrate-provider-collaboration.sql
```
