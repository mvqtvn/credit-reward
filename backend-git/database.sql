-- Create database
CREATE DATABASE IF NOT EXISTS njc_rewards;
USE njc_rewards;

-- 1. STUDENT DATA TABLE
CREATE TABLE student_data (
    student_id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    rfid_uid VARCHAR(50) UNIQUE,
    credit INT NOT NULL DEFAULT 0 CHECK (credit >= 0),
    house VARCHAR(255) NOT NULL,
    level INT NOT NULL CHECK (level BETWEEN 1 AND 6)
);

-- 2. HOUSE CREDITS TABLE
CREATE TABLE house_credits (
    house_name VARCHAR(255) PRIMARY KEY,
    total_usage_number INT NOT NULL DEFAULT 0 CHECK (total_usage_number >= 0)
);

-- 3. REWARDS TABLE
CREATE TABLE rewards (
    reward_id INT AUTO_INCREMENT PRIMARY KEY,
    reward_name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    cost INT NOT NULL CHECK (cost >= 0),
    stock INT NOT NULL DEFAULT 0 CHECK (stock >= 0),
    image_urls TEXT
);

-- 4. CREDIT TRANSACTION TABLE
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

-- 5. REDEMPTION TABLE
CREATE TABLE redemption (
    redemption_id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    reward_id INT NOT NULL,
    redemption_status ENUM('Redeemed', 'Unredeemed') NOT NULL DEFAULT 'Unredeemed',
    FOREIGN KEY (student_id) REFERENCES student_data(student_id) ON DELETE CASCADE,
    FOREIGN KEY (reward_id) REFERENCES rewards(reward_id)
);

-- INDEXES FOR PERFORMANCE
CREATE INDEX idx_student_rfid ON student_data(rfid_uid);
CREATE INDEX idx_transaction_student ON credit_transaction(student_id);
CREATE INDEX idx_redemption_student ON redemption(student_id);
CREATE INDEX idx_redemption_reward ON redemption(reward_id);