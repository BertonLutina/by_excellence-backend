-- Provider collaboration: collaborators table + one offer per provider per request
-- Safe to run multiple times (IF NOT EXISTS / information_schema checks).

CREATE TABLE IF NOT EXISTS `service_request_collaborators` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `request_id` BIGINT UNSIGNED NOT NULL,
  `provider_id` BIGINT UNSIGNED NOT NULL,
  `role` ENUM('lead','partner') NOT NULL DEFAULT 'partner',
  `status` ENUM('invited','accepted','declined','removed') NOT NULL DEFAULT 'invited',
  `note` TEXT NULL,
  `invited_by_provider_id` BIGINT UNSIGNED NULL,
  `invited_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `responded_at` TIMESTAMP NULL,
  UNIQUE KEY `uq_request_collaborator` (`request_id`, `provider_id`),
  INDEX `idx_collab_provider` (`provider_id`, `status`),
  CONSTRAINT `fk_collab_request` FOREIGN KEY (`request_id`) REFERENCES `service_requests`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_collab_provider` FOREIGN KEY (`provider_id`) REFERENCES `providers`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Unique index: at most one offer per (request, provider) for combo missions
SET @idx_exists := (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'offers'
    AND index_name = 'uq_offer_request_provider'
);
SET @sql := IF(
  @idx_exists = 0,
  'ALTER TABLE `offers` ADD UNIQUE INDEX `uq_offer_request_provider` (`request_id`, `provider_id`)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
