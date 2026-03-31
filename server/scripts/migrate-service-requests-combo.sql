-- Service requests: guest fields + combo metadata. Run once:
--   mysql -u USER -p DATABASE < server/scripts/migrate-service-requests-combo.sql
--
-- client_id becomes nullable for guest requests (client_email + client_name required in API).

ALTER TABLE service_requests
  MODIFY client_id BIGINT UNSIGNED NULL;

ALTER TABLE service_requests
  ADD COLUMN client_name VARCHAR(255) NULL AFTER client_id,
  ADD COLUMN client_email VARCHAR(255) NULL AFTER client_name,
  ADD COLUMN client_phone VARCHAR(50) NULL AFTER client_email,
  ADD COLUMN provider_name VARCHAR(255) NULL AFTER provider_id,
  ADD COLUMN is_combo BOOLEAN NOT NULL DEFAULT FALSE AFTER service_description,
  ADD COLUMN combo_payload JSON NULL AFTER is_combo;
