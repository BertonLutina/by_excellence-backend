-- Add admin dashboard status/access fields required by admin panel APIs
-- Usage: mysql -u root -p by_excellence < server/scripts/migrate-add-admin-panel-status-fields.sql

ALTER TABLE `clients`
  ADD COLUMN `status` ENUM('active','inactive','pending') NOT NULL DEFAULT 'pending' AFTER `phone`;

ALTER TABLE `admins`
  ADD COLUMN `status` ENUM('active','inactive','pending') NOT NULL DEFAULT 'active' AFTER `full_name`;

ALTER TABLE `providers`
  ADD COLUMN `coords` JSON NULL AFTER `legal_address`,
  ADD COLUMN `access` TINYINT(1) NOT NULL DEFAULT 1 AFTER `video_url`,
  ADD COLUMN `status_verification` TINYINT NOT NULL DEFAULT 0
    COMMENT '0=nothing,1=sent,2=in treatment,3=accepted,4=refused'
    AFTER `access`;

CREATE INDEX `idx_clients_status` ON `clients` (`status`);
CREATE INDEX `idx_admins_status` ON `admins` (`status`);
CREATE INDEX `idx_providers_access` ON `providers` (`access`);
CREATE INDEX `idx_providers_status_verification` ON `providers` (`status_verification`);
