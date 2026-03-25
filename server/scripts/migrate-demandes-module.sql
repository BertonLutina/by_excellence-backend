-- Demandes module migration (idempotent, safe to re-run)
-- Usage: mysql -u root -p by_excellence < server/scripts/migrate-demandes-module.sql

CREATE TABLE IF NOT EXISTS demandes (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  client_id BIGINT UNSIGNED NOT NULL,
  type ENUM('single','combo') NOT NULL,
  title VARCHAR(255) NULL,
  content TEXT NOT NULL,
  description TEXT NULL,
  status ENUM('pending','sent','accepted','rejected','completed') NOT NULL DEFAULT 'pending',
  forwarded_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_demandes_client (client_id),
  INDEX idx_demandes_status (status),
  CONSTRAINT fk_demandes_client FOREIGN KEY (client_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

SET @sql = (
  SELECT IF(
    EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = 'demandes' AND column_name = 'type'
    ),
    'SELECT 1',
    "ALTER TABLE demandes ADD COLUMN `type` ENUM('single','combo') NOT NULL DEFAULT 'single'"
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = 'demandes' AND column_name = 'title'
    ),
    'SELECT 1',
    "ALTER TABLE demandes ADD COLUMN `title` VARCHAR(255) NULL"
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = 'demandes' AND column_name = 'content'
    ),
    'SELECT 1',
    "ALTER TABLE demandes ADD COLUMN `content` TEXT NULL"
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = 'demandes' AND column_name = 'description'
    ),
    'SELECT 1',
    "ALTER TABLE demandes ADD COLUMN `description` TEXT NULL"
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = 'demandes' AND column_name = 'status'
    ),
    'SELECT 1',
    "ALTER TABLE demandes ADD COLUMN `status` ENUM('pending','sent','accepted','rejected','completed') NOT NULL DEFAULT 'pending'"
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = 'demandes' AND column_name = 'forwarded_at'
    ),
    'SELECT 1',
    "ALTER TABLE demandes ADD COLUMN `forwarded_at` DATETIME NULL"
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS demande_providers (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  demande_id BIGINT UNSIGNED NOT NULL,
  provider_id BIGINT UNSIGNED NOT NULL,
  status ENUM('pending','sent','accepted','rejected','completed') NOT NULL DEFAULT 'pending',
  assigned_part TEXT NULL,
  is_visible BOOLEAN NOT NULL DEFAULT TRUE,
  responded_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_demande_provider (demande_id, provider_id),
  INDEX idx_demande_providers_demande (demande_id),
  INDEX idx_demande_providers_provider (provider_id),
  INDEX idx_demande_providers_status (status),
  CONSTRAINT fk_demande_provider_demande FOREIGN KEY (demande_id) REFERENCES demandes(id) ON DELETE CASCADE,
  CONSTRAINT fk_demande_provider_provider FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS demande_provider_responses (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  demande_id BIGINT UNSIGNED NOT NULL,
  provider_id BIGINT UNSIGNED NOT NULL,
  response ENUM('accepted','rejected') NOT NULL,
  message TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_dpr_demande (demande_id),
  INDEX idx_dpr_provider (provider_id),
  CONSTRAINT fk_dpr_demande FOREIGN KEY (demande_id) REFERENCES demandes(id) ON DELETE CASCADE,
  CONSTRAINT fk_dpr_provider FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS notifications (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  type VARCHAR(100) NOT NULL,
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  payload JSON NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_notifications_user (user_id),
  INDEX idx_notifications_read (is_read),
  CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;
