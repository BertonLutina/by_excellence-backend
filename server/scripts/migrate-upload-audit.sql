-- Idempotent: create upload_audit for upload metadata (MySQL 8+ / compatible)
CREATE TABLE IF NOT EXISTS upload_audit (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NULL,
    storage_key VARCHAR(512) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    size_bytes INT UNSIGNED NOT NULL,
    original_filename_sanitized VARCHAR(255) NULL,
    public_url TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_upload_user (user_id),
    INDEX idx_upload_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
