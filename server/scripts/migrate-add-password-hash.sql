-- Fix: add missing password_hash column to users (run if you get "Unknown column 'password_hash' in 'field list'")
-- Usage: mysql -u root -p by_excellence < backend/scripts/migrate-add-password-hash.sql

-- Add column (safe to run multiple times: will error if column already exists, which is fine)
ALTER TABLE `users` ADD COLUMN `password_hash` VARCHAR(255) NOT NULL DEFAULT '';

-- If you had a column named 'password' and want to copy data then remove it, uncomment:
-- UPDATE `users` SET password_hash = `password` WHERE password_hash = '' AND `password` IS NOT NULL AND `password` != '';
-- ALTER TABLE `users` DROP COLUMN `password`;
