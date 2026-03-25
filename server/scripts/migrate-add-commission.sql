-- Commission: provider premium rate + payment snapshot columns.
-- Idempotent for MySQL/Percona 8.0.18 (no ADD COLUMN IF NOT EXISTS).
-- Usage: mysql -u root -p by_excellence < server/scripts/migrate-add-commission.sql

-- providers.premium_commission_percent — only 20 or 30 (enforced in app); NULL => default 20% for premium
SET @sql = (
  SELECT IF(
    EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = 'providers' AND column_name = 'premium_commission_percent'
    ),
    'SELECT 1',
    'ALTER TABLE providers ADD COLUMN `premium_commission_percent` DECIMAL(5,2) NULL COMMENT ''20 or 30 for premium tier'' AFTER `provider_tier`'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- payments snapshot when marked paid
SET @sql = (
  SELECT IF(
    EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = 'payments' AND column_name = 'commission_rate_percent'
    ),
    'SELECT 1',
    'ALTER TABLE payments ADD COLUMN `commission_rate_percent` DECIMAL(5,2) NULL AFTER `amount`'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = 'payments' AND column_name = 'admin_commission_amount'
    ),
    'SELECT 1',
    'ALTER TABLE payments ADD COLUMN `admin_commission_amount` DECIMAL(10,2) NULL AFTER `commission_rate_percent`'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = 'payments' AND column_name = 'provider_net_amount'
    ),
    'SELECT 1',
    'ALTER TABLE payments ADD COLUMN `provider_net_amount` DECIMAL(10,2) NULL AFTER `admin_commission_amount`'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
