-- Adds Stripe Connect fields to `providers` so each provider can be paid out
-- directly via a Stripe Connect (Express) account instead of manual settlement.
-- Idempotent: can be re-run safely.
-- Usage: mysql -u root -p by_excellence < server/scripts/migrate-add-stripe-connect.sql

-- NOTE: all 4 columns are NULL-able (no NOT NULL / DEFAULT) on purpose.
-- Provider.create() inserts every column in Provider.COLUMNS on every provider
-- signup, including ones the caller never mentioned (undefined -> NULL via
-- normalizeBindings). A NOT NULL column here would make EVERY provider
-- signup throw a DB error the day this migration lands. The application layer
-- treats NULL stripe_connect_status as 'none' and NULL stripe_payouts_enabled
-- as falsy, so this is safe.
ALTER TABLE `providers`
  ADD COLUMN IF NOT EXISTS `stripe_account_id` VARCHAR(255) NULL COMMENT 'Stripe Connect account id (acct_...)' AFTER `worker_count`,
  ADD COLUMN IF NOT EXISTS `stripe_connect_status` ENUM('none','pending','active','restricted') NULL COMMENT 'none/NULL=never started, pending=onboarding incomplete, active=payouts_enabled, restricted=Stripe flagged requirements' AFTER `stripe_account_id`,
  ADD COLUMN IF NOT EXISTS `stripe_payouts_enabled` TINYINT(1) NULL COMMENT 'Mirrors Stripe account.payouts_enabled, set only by the account.updated webhook' AFTER `stripe_connect_status`,
  ADD COLUMN IF NOT EXISTS `stripe_connect_requested_at` DATETIME NULL COMMENT 'When the provider checked "receive payments via Stripe"' AFTER `stripe_payouts_enabled`;

SET @idx_exists := (
  SELECT COUNT(1)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'providers'
    AND index_name = 'idx_stripe_account_id'
);

SET @create_idx_sql := IF(
  @idx_exists = 0,
  'CREATE UNIQUE INDEX idx_stripe_account_id ON providers (stripe_account_id)',
  'SELECT 1'
);

PREPARE stmt FROM @create_idx_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
