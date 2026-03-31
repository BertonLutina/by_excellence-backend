-- Solo vs team + headcount. Run once:
--   mysql -u ... by_excellence < server/scripts/migrate-provider-structure.sql
-- If columns already exist, comment out the ALTER or ignore duplicate column errors.

ALTER TABLE `providers`
  ADD COLUMN `structure_type` ENUM('solo','team') NOT NULL DEFAULT 'solo' AFTER `company_name`,
  ADD COLUMN `worker_count` INT UNSIGNED NOT NULL DEFAULT 1 COMMENT 'Intervenants (1 = seul, 2+ = équipe)' AFTER `structure_type`;

UPDATE `providers` SET `structure_type` = 'solo', `worker_count` = 1 WHERE `worker_count` < 1;
