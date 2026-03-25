-- =====================================================
-- BY_EXCELLENCE FULL SCHEMA WITH CLIENTS, ADMINS, TRIGGERS
-- =====================================================

DROP DATABASE IF EXISTS by_excellence;

CREATE DATABASE by_excellence
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

USE by_excellence;

-- =====================================================
-- ROLES
-- =====================================================
CREATE TABLE roles (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    UNIQUE KEY uq_role_name (name)
) ENGINE=InnoDB;

INSERT INTO roles (id, name) VALUES
(1,'client'), (2,'provider'), (3,'admin');

-- =====================================================
-- USERS
-- =====================================================
CREATE TABLE users (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(150),
    role_id BIGINT UNSIGNED NOT NULL,
    is_email_verified BOOLEAN DEFAULT FALSE,
    verification_token VARCHAR(255),
    verification_token_expires DATETIME,
    reset_token VARCHAR(255),
    reset_token_expires DATETIME,
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY uq_user_email (email),
    INDEX idx_user_role (role_id),
    CONSTRAINT fk_user_role
        FOREIGN KEY (role_id)
        REFERENCES roles(id)
        ON DELETE RESTRICT
) ENGINE=InnoDB;

-- =====================================================
-- CLIENTS
-- =====================================================
CREATE TABLE clients (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    full_name VARCHAR(150),
    phone VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY uq_client_user (user_id),
    CONSTRAINT fk_client_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
) ENGINE=InnoDB;

-- =====================================================
-- ADMINS
-- =====================================================
CREATE TABLE admins (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    full_name VARCHAR(150),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY uq_admin_user (user_id),
    CONSTRAINT fk_admin_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
) ENGINE=InnoDB;

-- =====================================================
-- SERVICE CATEGORIES
-- =====================================================
CREATE TABLE service_categories (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    icon VARCHAR(100),
    image_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_category_name (name)
) ENGINE=InnoDB;

-- =====================================================
-- PROVIDERS
-- =====================================================
CREATE TABLE providers (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    display_name VARCHAR(150) DEFAULT 'New Provider',
    profession VARCHAR(150) DEFAULT 'Not specified',
    bio TEXT,
    photo_url TEXT,
    banner_url TEXT,
    city VARCHAR(150),
    category_id BIGINT UNSIGNED,
    price_from DECIMAL(10,2),
    provider_tier ENUM('standard','premium') NULL,
    premium_commission_percent DECIMAL(5,2) NULL COMMENT '20 or 30 for premium tier; NULL uses default 20%',
    portfolio_images JSON,
    is_verified BOOLEAN DEFAULT FALSE,
    rating DECIMAL(3,2),
    review_count INT DEFAULT 0,
    status ENUM('active','inactive','pending') DEFAULT 'pending',
    company_name VARCHAR(255),
    siret VARCHAR(14),
    vat_number VARCHAR(50),
    legal_address TEXT,
    insurance_certificate TEXT,
    video_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY uq_provider_user (user_id),
    CONSTRAINT fk_provider_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_provider_category FOREIGN KEY (category_id) REFERENCES service_categories(id) ON DELETE SET NULL,

    INDEX idx_provider_status (status),
    INDEX idx_provider_city (city),
    INDEX idx_provider_rating (rating),
    INDEX idx_provider_tier (provider_tier)
) ENGINE=InnoDB;

-- =====================================================
-- PROVIDER AVAILABILITY
-- =====================================================
CREATE TABLE provider_availability (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    provider_id BIGINT UNSIGNED NOT NULL,
    day_of_week TINYINT NOT NULL,
    start_time TIME,
    end_time TIME,
    is_available BOOLEAN DEFAULT TRUE,
    UNIQUE KEY uq_provider_day (provider_id, day_of_week),
    INDEX idx_availability_provider (provider_id),
    CONSTRAINT fk_availability_provider FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- =====================================================
-- SERVICE REQUESTS
-- =====================================================
CREATE TABLE service_requests (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    client_id BIGINT UNSIGNED NOT NULL,
    provider_id BIGINT UNSIGNED NOT NULL,
    service_description TEXT NOT NULL,
    preferred_date DATE,
    budget VARCHAR(100),
    status ENUM(
        'request_sent',
        'in_review',
        'offer_preparation',
        'offer_sent',
        'offer_accepted',
        'deposit_paid',
        'date_confirmed',
        'final_payment_pending',
        'completed',
        'cancelled'
    ) DEFAULT 'request_sent',
    confirmed_date DATE,
    admin_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_request_client FOREIGN KEY (client_id) REFERENCES clients(user_id) ON DELETE CASCADE,
    CONSTRAINT fk_request_provider FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE CASCADE,

    INDEX idx_request_provider (provider_id),
    INDEX idx_request_client (client_id),
    INDEX idx_request_status (status),
    INDEX idx_request_provider_status (provider_id, status)
) ENGINE=InnoDB;

-- =====================================================
-- OFFERS
-- =====================================================
CREATE TABLE offers (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    request_id BIGINT UNSIGNED NOT NULL,
    provider_id BIGINT UNSIGNED NOT NULL,
    title VARCHAR(255),
    description TEXT,
    items JSON,
    total_amount DECIMAL(10,2) NOT NULL,
    deposit_amount DECIMAL(10,2),
    deposit_percentage DECIMAL(5,2),
    conditions TEXT,
    valid_until DATE,
    status ENUM('draft','sent_to_admin','sent_to_client','accepted','rejected','expired') DEFAULT 'draft',
    installment_requested BOOLEAN DEFAULT FALSE,
    installment_count TINYINT,
    installment_status ENUM('pending','approved','rejected'),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_offer_request FOREIGN KEY (request_id) REFERENCES service_requests(id) ON DELETE CASCADE,
    CONSTRAINT fk_offer_provider FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE CASCADE,

    INDEX idx_offer_request (request_id),
    INDEX idx_offer_provider (provider_id),
    INDEX idx_offer_status (status)
) ENGINE=InnoDB;

-- =====================================================
-- PAYMENTS
-- =====================================================
CREATE TABLE payments (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    request_id BIGINT UNSIGNED NOT NULL,
    offer_id BIGINT UNSIGNED NOT NULL,
    type ENUM('deposit','final','installment') NOT NULL,
    installment_index TINYINT,
    installment_total TINYINT,
    amount DECIMAL(10,2) NOT NULL,
    commission_rate_percent DECIMAL(5,2) NULL,
    admin_commission_amount DECIMAL(10,2) NULL,
    provider_net_amount DECIMAL(10,2) NULL,
    status ENUM('pending','paid','failed','refunded') DEFAULT 'pending',
    paid_date DATETIME,
    payment_method VARCHAR(100),
    invoice_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_payment_request FOREIGN KEY (request_id) REFERENCES service_requests(id) ON DELETE CASCADE,
    CONSTRAINT fk_payment_offer FOREIGN KEY (offer_id) REFERENCES offers(id) ON DELETE CASCADE,

    INDEX idx_payment_request (request_id),
    INDEX idx_payment_offer (offer_id),
    INDEX idx_payment_status (status),
    INDEX idx_payment_type (type)
) ENGINE=InnoDB;

-- =====================================================
-- MESSAGES
-- =====================================================
CREATE TABLE messages (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    request_id BIGINT UNSIGNED NOT NULL,
    sender_id BIGINT UNSIGNED NOT NULL,
    sender_role ENUM('admin','client','provider'),
    content TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_message_request FOREIGN KEY (request_id) REFERENCES service_requests(id) ON DELETE CASCADE,
    CONSTRAINT fk_message_sender FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,

    INDEX idx_message_request (request_id),
    INDEX idx_message_sender (sender_id),
    INDEX idx_message_read (is_read)
) ENGINE=InnoDB;

-- =====================================================
-- REVIEWS
-- =====================================================
CREATE TABLE reviews (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    provider_id BIGINT UNSIGNED NOT NULL,
    client_id BIGINT UNSIGNED NOT NULL,
    request_id BIGINT UNSIGNED,
    rating TINYINT NOT NULL,
    comment TEXT,
    provider_response TEXT,
    provider_response_date DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_review_provider FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE CASCADE,
    CONSTRAINT fk_review_client FOREIGN KEY (client_id) REFERENCES clients(user_id) ON DELETE CASCADE,
    CONSTRAINT fk_review_request FOREIGN KEY (request_id) REFERENCES service_requests(id) ON DELETE SET NULL,

    INDEX idx_review_provider (provider_id),
    INDEX idx_review_rating (rating)
) ENGINE=InnoDB;

-- =====================================================
-- FAVORITES
-- =====================================================
CREATE TABLE favorites (
    client_id BIGINT UNSIGNED NOT NULL,
    provider_id BIGINT UNSIGNED NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (client_id, provider_id),
    CONSTRAINT fk_favorite_client FOREIGN KEY (client_id) REFERENCES clients(user_id) ON DELETE CASCADE,
    CONSTRAINT fk_favorite_provider FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE CASCADE,

    INDEX idx_favorite_provider (provider_id)
) ENGINE=InnoDB;

-- =====================================================
-- TRIGGERS
-- =====================================================
DELIMITER $$

-- Auto-update updated_date triggers
CREATE TRIGGER trg_providers_updated BEFORE UPDATE ON providers
FOR EACH ROW SET NEW.updated_date = NOW()$$

CREATE TRIGGER trg_service_requests_updated BEFORE UPDATE ON service_requests
FOR EACH ROW SET NEW.updated_date = NOW()$$

CREATE TRIGGER trg_offers_updated BEFORE UPDATE ON offers
FOR EACH ROW SET NEW.updated_date = NOW()$$

CREATE TRIGGER trg_payments_updated BEFORE UPDATE ON payments
FOR EACH ROW SET NEW.updated_date = NOW()$$

CREATE TRIGGER trg_reviews_updated BEFORE UPDATE ON reviews
FOR EACH ROW SET NEW.updated_date = NOW()$$

CREATE TRIGGER trg_messages_updated BEFORE UPDATE ON messages
FOR EACH ROW SET NEW.updated_date = NOW()$$

CREATE TRIGGER trg_clients_updated BEFORE UPDATE ON clients
FOR EACH ROW SET NEW.updated_date = NOW()$$

CREATE TRIGGER trg_admins_updated BEFORE UPDATE ON admins
FOR EACH ROW SET NEW.updated_date = NOW()$$

-- Auto-create profile tables after user insert
CREATE TRIGGER trg_after_user_insert_profiles
AFTER INSERT ON users
FOR EACH ROW
BEGIN
    IF NEW.role_id = 2 THEN
        INSERT INTO providers(user_id, display_name, profession)
        VALUES (NEW.id, COALESCE(NEW.full_name,'New Provider'), 'Not specified');
    ELSEIF NEW.role_id = 1 THEN
        INSERT INTO clients(user_id, full_name)
        VALUES (NEW.id, COALESCE(NEW.full_name,'New Client'));
    ELSEIF NEW.role_id = 3 THEN
        INSERT INTO admins(user_id, full_name)
        VALUES (NEW.id, COALESCE(NEW.full_name,'New Admin'));
    END IF;
END$$

CREATE TRIGGER trg_after_user_update_profiles
AFTER UPDATE ON users
FOR EACH ROW
BEGIN
    IF NEW.role_id = 2 AND OLD.role_id <> 2 THEN
        INSERT INTO providers(user_id, display_name, profession)
        VALUES (NEW.id, COALESCE(NEW.full_name,'New Provider'), 'Not specified');
    END IF;
    IF OLD.role_id = 2 AND NEW.role_id <> 2 THEN
        DELETE FROM providers WHERE user_id = NEW.id;
    END IF;

    IF NEW.role_id = 1 AND OLD.role_id <> 1 THEN
        INSERT INTO clients(user_id, full_name)
        VALUES (NEW.id, COALESCE(NEW.full_name,'New Client'));
    END IF;
    IF OLD.role_id = 1 AND NEW.role_id <> 1 THEN
        DELETE FROM clients WHERE user_id = NEW.id;
    END IF;

    IF NEW.role_id = 3 AND OLD.role_id <> 3 THEN
        INSERT INTO admins(user_id, full_name)
        VALUES (NEW.id, COALESCE(NEW.full_name,'New Admin'));
    END IF;
    IF OLD.role_id = 3 AND NEW.role_id <> 3 THEN
        DELETE FROM admins WHERE user_id = NEW.id;
    END IF;
END$$

-- Offer accepted -> update ServiceRequest
CREATE TRIGGER trg_offer_accepted_update_request AFTER UPDATE ON offers
FOR EACH ROW
BEGIN
    IF NEW.status = 'accepted' AND OLD.status != 'accepted' THEN
        UPDATE service_requests SET status='offer_accepted' WHERE id = NEW.request_id;
    END IF;
END$$

-- Offer sent_to_client -> update ServiceRequest
CREATE TRIGGER trg_offer_sent_to_client_update_request AFTER UPDATE ON offers
FOR EACH ROW
BEGIN
    IF NEW.status = 'sent_to_client' AND OLD.status != 'sent_to_client' THEN
        UPDATE service_requests SET status='offer_sent' WHERE id = NEW.request_id;
    END IF;
END$$

-- Deposit payment paid -> update ServiceRequest
CREATE TRIGGER trg_deposit_paid_update_request AFTER UPDATE ON payments
FOR EACH ROW
BEGIN
    IF NEW.status = 'paid' AND OLD.status != 'paid' AND NEW.type='deposit' THEN
        UPDATE service_requests SET status='deposit_paid' WHERE id = NEW.request_id;
    END IF;
END$$

-- Final payment paid -> update ServiceRequest to completed
CREATE TRIGGER trg_final_paid_complete_request AFTER UPDATE ON payments
FOR EACH ROW
BEGIN
    IF NEW.status = 'paid' AND OLD.status != 'paid' AND NEW.type='final' THEN
        UPDATE service_requests SET status='completed' WHERE id = NEW.request_id;
    END IF;
END$$

-- Installment payments all paid -> update ServiceRequest to completed
CREATE TRIGGER trg_installments_all_paid_complete_request AFTER UPDATE ON payments
FOR EACH ROW
BEGIN
    DECLARE total_count INT;
    DECLARE paid_count INT;

    IF NEW.status='paid' AND NEW.type='installment' THEN
        SELECT installment_total INTO total_count FROM payments WHERE id = NEW.id;
        SELECT COUNT(*) INTO paid_count
        FROM payments
        WHERE request_id=NEW.request_id AND type='installment' AND status='paid';

        IF paid_count >= total_count THEN
            UPDATE service_requests SET status='completed' WHERE id=NEW.request_id;
        END IF;
    END IF;
END$$

-- Reviews triggers -> recalc provider rating/review_count
CREATE TRIGGER trg_review_inserted_update_provider AFTER INSERT ON reviews
FOR EACH ROW
BEGIN
    UPDATE providers
    SET rating = (SELECT AVG(rating) FROM reviews WHERE provider_id = NEW.provider_id),
        review_count = (SELECT COUNT(*) FROM reviews WHERE provider_id = NEW.provider_id)
    WHERE id = NEW.provider_id;
END$$

CREATE TRIGGER trg_review_updated_update_provider AFTER UPDATE ON reviews
FOR EACH ROW
BEGIN
    UPDATE providers
    SET rating = (SELECT AVG(rating) FROM reviews WHERE provider_id = NEW.provider_id),
        review_count = (SELECT COUNT(*) FROM reviews WHERE provider_id = NEW.provider_id)
    WHERE id = NEW.provider_id;
END$$

CREATE TRIGGER trg_review_deleted_update_provider AFTER DELETE ON reviews
FOR EACH ROW
BEGIN
    UPDATE providers
    SET rating = COALESCE((SELECT AVG(rating) FROM reviews WHERE provider_id = OLD.provider_id),0),
        review_count = (SELECT COUNT(*) FROM reviews WHERE provider_id = OLD.provider_id)
    WHERE id = OLD.provider_id;
END$$

DELIMITER ;

-- =====================================================
-- END OF FULL BY_EXCELLENCE SCHEMA
-- =====================================================