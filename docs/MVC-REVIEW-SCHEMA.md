# MVC review vs schema (schema.sql 1–465)

This doc maps the current schema to models, controllers, and routes.

---

## 1. Schema → models

| Table | Model | Key changes |
|-------|--------|--------------|
| **roles** | `Role.js` | id AUTO_INCREMENT, name. Seed: 1=client, 2=provider, 3=admin. |
| **users** | `User.js` | id AUTO_INCREMENT, role_id BIGINT FK to roles. create() uses result.insertId; role string mapped to role_id (1,2,3). |
| **clients** | `Client.js` | id, user_id, full_name, phone, created_at, updated_date. Auto-created by trigger on user insert (role_id=1). |
| **admins** | `Admin.js` | id, user_id, full_name, created_at, updated_date. Auto-created by trigger (role_id=3). |
| **service_categories** | `ServiceCategory.js` | id AUTO_INCREMENT, name, description, icon, image_url, created_at. No updated_date, created_by. |
| **providers** | `Provider.js` | id AUTO_INCREMENT, user_id (not user_email), banner_url, portfolio_images (JSON), created_at, updated_date. Trigger creates row when user role_id=2. |
| **provider_availability** | `ProviderAvailability.js` | Table name singular. id, provider_id, day_of_week, start_time (TIME), end_time (TIME), is_available. No created_at/updated_date. |
| **service_requests** | `ServiceRequest.js` | client_id, provider_id (FKs). No client_email, client_name, client_phone, provider_name. created_at, updated_date. |
| **offers** | `Offer.js` | No client_email. created_at, updated_date. installment_requested BOOLEAN. |
| **payments** | `Payment.js` | No client_email, provider_id. created_at, updated_date. |
| **messages** | `Message.js` | sender_id (FK users), not sender_email/sender_name. created_at, updated_date. |
| **reviews** | `Review.js` | client_id (FK clients.user_id), not client_email/client_name. rating TINYINT. created_at, updated_date. |
| **favorites** | `Favorite.js` | Composite PK (client_id, provider_id). No id. created_at only. findById/delete use composite id "clientId_providerId". |

**service_items** – Not in current schema. `ServiceItem.js` is unchanged; add table to schema if you use it.

---

## 2. BaseModel / db

- **db.js** – `executeSQL()` returns raw result (rows for SELECT, ResultSetHeader with `insertId` for INSERT).
- **BaseModel** – `options.autoIncrement: true` → insert omits `id`, create() sets `this.id = result.insertId`. getUpdateColumns() excludes `id`, `created_date`, `created_at`. create() sets `created_at` / `created_date` / `updated_date` when present in columns.

---

## 3. Controllers / API

- **createEntityController** – Used by ServiceCategory, Provider, ServiceRequest, Offer, Payment, Review, Message, ProviderAvailability. Expects model: findAll(opts), findById(id), create(data), update(id, data), delete(id). All aligned with schema.
- **authController** – Uses User; register sends role 'client'|'provider'|'admin', User maps to role_id 1,2,3. User.create() uses AUTO_INCREMENT and insertId.
- **userController** – Uses User (findAll, findById, update, delete). update(id, { full_name, role }) – role can stay string; User.update maps to role_id if needed (or keep role_id in DB and expose role in API via AS role in SELECT).
- **favorites** – Favorite has no update (no-op). delete(id) expects composite id "clientId_providerId". Frontend should send that format for DELETE /api/favorites/:id.

---

## 4. Frontend / API contract

- **service_requests** – API should use `client_id`, `provider_id` (BIGINT), not emails/names. Resolve client_id from logged-in user (e.g. clients.user_id = users.id).
- **offers** – No `client_email` in body.
- **payments** – No `client_email`, `provider_id` in body.
- **messages** – Send `sender_id` (user id), not sender_email/sender_name.
- **reviews** – Send `client_id`, not client_email/client_name.
- **favorites** – Create: `{ client_id, provider_id }`. Delete: id = "clientId_providerId".
- **providers** – Create/update use `user_id` (required), not user_email.

---

## 5. Triggers (schema)

- User insert → create client (role_id=1), provider (role_id=2), or admin (role_id=3).
- User update role_id → create/delete corresponding profile row.
- Offer/review/payment triggers update service_requests and provider rating as in schema.

No controller changes needed for triggers; they run in the DB.

---

## 6. Routes (unchanged)

- `/api/auth`, `/api/users`, `/api/service-categories`, `/api/providers`, `/api/service-requests`, `/api/offers`, `/api/payments`, `/api/reviews`, `/api/messages`, `/api/service-items`, `/api/provider-availabilities`, `/api/favorites`, `/api/functions`, `/api/upload`.

If you add `service_items` to the schema, keep `/api/service-items`. Otherwise you can remove the route or add the table.
