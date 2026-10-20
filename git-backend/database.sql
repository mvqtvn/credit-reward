-- Create database
CREATE DATABASE IF NOT EXISTS njc_rewards;
USE njc_rewards;

-- 1. STUDENT DATA TABLE
CREATE TABLE student_data (
    student_id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    rfid_uid VARCHAR(50) UNIQUE,
    house VARCHAR(255) NOT NULL,
    level INT NOT NULL CHECK (level BETWEEN 1 AND 6),
    password_hash VARCHAR(255) NOT NULL
);

-- 2. STUDENT ECOCOINS TABLE
CREATE TABLE ecocoins (
    ecocoin_id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL UNIQUE,
    credit INT NOT NULL DEFAULT 0 CHECK (credit >= 0),
    drink_stall_scans INT NOT NULL DEFAULT 0 CHECK (drink_stall_scans >= 0),
    FOREIGN KEY (student_id) REFERENCES student_data(student_id) ON DELETE CASCADE
);

-- Sample balances are kept separate from live student profiles and balances.
CREATE OR REPLACE VIEW sample_ecocoin_balances AS
SELECT 'maggie@students.edu.sg' AS email, 140 AS credit, 28 AS drink_stall_scans
UNION ALL SELECT 'eric@students.edu.sg', 100, 20
UNION ALL SELECT 'ferne@students.edu.sg', 80, 15
UNION ALL SELECT 'bhavna@students.edu.sg', 50, 9
UNION ALL SELECT 'natalie@students.edu.sg', 0, 0;

INSERT INTO ecocoins (student_id, credit, drink_stall_scans)
SELECT students.student_id, sample_balances.credit, sample_balances.drink_stall_scans
FROM student_data AS students
JOIN sample_ecocoin_balances AS sample_balances ON sample_balances.email = students.email
ON DUPLICATE KEY UPDATE
    credit = VALUES(credit),
    drink_stall_scans = VALUES(drink_stall_scans);

-- 3. HOUSE CREDITS TABLE
CREATE TABLE house_credits (
    house_name VARCHAR(255) PRIMARY KEY,
    total_usage_number INT NOT NULL DEFAULT 0 CHECK (total_usage_number >= 0)
);

-- Demo leaderboard totals; replace with live house totals when available.
INSERT INTO house_credits (house_name, total_usage_number)
VALUES
    ('Lignum', 1280),
    ('Terra', 1175),
    ('Aqua', 960),
    ('Ignis', 825),
    ('Solaris', 710)
ON DUPLICATE KEY UPDATE
    total_usage_number = IF(
        total_usage_number = 0,
        VALUES(total_usage_number),
        total_usage_number
    );

-- 4. REWARDS TABLE
CREATE TABLE rewards (
    reward_id INT AUTO_INCREMENT PRIMARY KEY,
    reward_name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    cost INT NOT NULL CHECK (cost >= 0),
    stock INT NOT NULL DEFAULT 0 CHECK (stock >= 0),
    image_urls TEXT
);

-- 5. CREDIT TRANSACTION TABLE
CREATE TABLE credit_transaction (
    transaction_id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    transaction_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    credit_change INT NOT NULL,
    type ENUM('EARN', 'SPENT') NOT NULL,
    reason VARCHAR(255) NOT NULL,
    usage_number INT NOT NULL DEFAULT 0,
    FOREIGN KEY (student_id) REFERENCES student_data(student_id) ON DELETE CASCADE
);

-- 6. REDEMPTION STATUS TABLE
CREATE TABLE redemption_status (
    redemption_id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    reward_id INT NOT NULL,
    redemption_status ENUM('Redeemed', 'Unredeemed') NOT NULL DEFAULT 'Unredeemed',
    house_design VARCHAR(50) NULL,
    FOREIGN KEY (student_id) REFERENCES student_data(student_id) ON DELETE CASCADE,
    FOREIGN KEY (reward_id) REFERENCES rewards(reward_id)
);

-- After a student collects a reward, an admin can mark its redemption complete:
-- UPDATE redemption_status SET redemption_status = 'Redeemed' WHERE redemption_id = ?;

-- INDEXES FOR PERFORMANCE
CREATE INDEX idx_transaction_student_date
    ON credit_transaction(student_id, transaction_date, transaction_id);
CREATE INDEX idx_redemption_student ON redemption_status(student_id);
CREATE INDEX idx_redemption_reward ON redemption_status(reward_id);

DELIMITER $$

CREATE TRIGGER trg_drink_stall_scan_insert
AFTER INSERT ON credit_transaction
FOR EACH ROW
BEGIN
    IF NEW.reason = 'DrinkStall' THEN
        UPDATE ecocoins
        SET drink_stall_scans = drink_stall_scans + 1
        WHERE student_id = NEW.student_id;
    END IF;
END$$

CREATE TRIGGER trg_drink_stall_scan_update
AFTER UPDATE ON credit_transaction
FOR EACH ROW
BEGIN
    IF OLD.student_id = NEW.student_id THEN
        UPDATE ecocoins
        SET drink_stall_scans = GREATEST(
            0,
            drink_stall_scans
                - IF(OLD.reason = 'DrinkStall', 1, 0)
                + IF(NEW.reason = 'DrinkStall', 1, 0)
        )
        WHERE student_id = NEW.student_id;
    ELSE
        IF OLD.reason = 'DrinkStall' THEN
            UPDATE ecocoins
            SET drink_stall_scans = GREATEST(0, drink_stall_scans - 1)
            WHERE student_id = OLD.student_id;
        END IF;
        IF NEW.reason = 'DrinkStall' THEN
            UPDATE ecocoins
            SET drink_stall_scans = drink_stall_scans + 1
            WHERE student_id = NEW.student_id;
        END IF;
    END IF;
END$$

CREATE TRIGGER trg_drink_stall_scan_delete
AFTER DELETE ON credit_transaction
FOR EACH ROW
BEGIN
    IF OLD.reason = 'DrinkStall' THEN
        UPDATE ecocoins
        SET drink_stall_scans = GREATEST(0, drink_stall_scans - 1)
        WHERE student_id = OLD.student_id;
    END IF;
END$$

DELIMITER ;