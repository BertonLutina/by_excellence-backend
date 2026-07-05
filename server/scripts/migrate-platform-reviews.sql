-- Migration: create platform_reviews table for landing page testimonials
CREATE TABLE IF NOT EXISTS `platform_reviews` (
    `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `author_full_name` VARCHAR(150) DEFAULT NULL,
    `author_profession` VARCHAR(150) DEFAULT NULL,
    `author_location` VARCHAR(100) DEFAULT NULL,
    `author_role` ENUM('client', 'provider') DEFAULT 'client',
    `author_user_id` BIGINT UNSIGNED DEFAULT NULL,
    `rating` TINYINT UNSIGNED NOT NULL DEFAULT 5,
    `comment` TEXT NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_date` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_pr_rating` (`rating`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
