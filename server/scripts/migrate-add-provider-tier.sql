-- Add providers.provider_tier with safe backfill + index.
-- Idempotent: can be re-run safely.
-- Usage: mysql -u root -p by_excellence < server/scripts/migrate-add-provider-tier.sql

ALTER TABLE `providers`
  ADD COLUMN IF NOT EXISTS `provider_tier` ENUM('standard', 'premium') NULL AFTER `price_from`;

UPDATE `providers`
SET `provider_tier` = CASE
  WHEN `price_from` <= 1000 THEN 'standard'
  WHEN `price_from` > 1000 THEN 'premium'
  ELSE NULL
END
WHERE `provider_tier` IS NULL
   OR `provider_tier` NOT IN ('standard', 'premium');

SET @idx_exists := (
  SELECT COUNT(1)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'providers'
    AND index_name = 'idx_provider_tier'
);

SET @create_idx_sql := IF(
  @idx_exists = 0,
  'CREATE INDEX idx_provider_tier ON providers (provider_tier)',
  'SELECT 1'
);

PREPARE stmt FROM @create_idx_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
