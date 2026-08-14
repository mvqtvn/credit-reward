-- Create database
CREATE DATABASE IF NOT EXISTS njc_rewards;

USE njc_rewards;

-- STUDENTS
CREATE TABLE students (
    student_id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    rfid_uid VARCHAR(50) UNIQUE,
    student_name VARCHAR(255) NOT NULL,
    credits INT NOT NULL DEFAULT 0
        CHECK (credits >= 0),
    join_leaderboard BOOLEAN NOT NULL DEFAULT TRUE,
    level INT NOT NULL DEFAULT 1,
    account_status ENUM('active', 'graduated', 'deleted')
        NOT NULL DEFAULT 'active'
);

-- CREDIT TRANSACTIONS
CREATE TABLE credit_transactions (
    transaction_id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    credits_change INT NOT NULL,
    reason VARCHAR(255) NOT NULL,
    transaction_date DATETIME NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (student_id)
        REFERENCES students(student_id)
        ON DELETE CASCADE
);

-- REWARDS
CREATE TABLE rewards (
    reward_id INT AUTO_INCREMENT PRIMARY KEY,
    reward_name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    first_purchase_cost INT NOT NULL
        CHECK (first_purchase_cost >= 0),
    repeat_purchase_cost INT
        CHECK (
            repeat_purchase_cost IS NULL
            OR repeat_purchase_cost >= 0
        ),
    stock INT NOT NULL DEFAULT 0
        CHECK (stock >= 0),
    image_url VARCHAR(500)
);

-- REDEMPTIONS
CREATE TABLE redemptions (
    redemption_id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    reward_id INT NOT NULL,
    term VARCHAR(20) NOT NULL,
    credits_spent INT NOT NULL
        CHECK (credits_spent >= 0),
    redeemed_at DATETIME NOT NULL
        DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id)
        REFERENCES students(student_id)
        ON DELETE CASCADE,
    FOREIGN KEY (reward_id)
        REFERENCES rewards(reward_id)
);

-- INDEXES

CREATE INDEX idx_students_rfid
ON students(rfid_uid);

CREATE INDEX idx_transactions_student
ON credit_transactions(student_id);

CREATE INDEX idx_transactions_date
ON credit_transactions(transaction_date);

CREATE INDEX idx_redemptions_student
ON redemptions(student_id);

CREATE INDEX idx_redemptions_reward
ON redemptions(reward_id);

CREATE INDEX idx_redemptions_term
ON redemptions(student_id, reward_id, term);


-- TEST DATA: STUDENTS

INSERT INTO students
(
    email,
    rfid_uid,
    student_name,
    credits,
    join_leaderboard,
    level,
    account_status
)
VALUES
(
    'student1@njc.edu.sg',
    'ABC123',
    'maggie',
    10,
    TRUE,
    5,
    'active'
),
(
    'student2@njc.edu.sg',
    'XYZ098',
    'ferne',
    15,
    TRUE,
    5,
    'active'
),
(
    'student3@njc.edu.sg',
    '123456',
    'eric',
    5,
    TRUE,
    5,
    'active'
),
(
    'student4@njc.edu.sg',
    '562302',
    'bhavna',
    10,
    FALSE,
    5,
    'active'
),
(
    'student5@njc.edu.sg',
    '987653',
    'natalie',
    5,
    FALSE,
    5,
    'active'
);


-- TEST DATA: REWARDS

INSERT INTO rewards
(
    reward_name,
    description,
    first_purchase_cost,
    repeat_purchase_cost,
    stock,
    image_url
)
VALUES
(
    '$1 Bookshop Coupon',
    '$1 coupon for the NJC bookshop',
    40,
    75,
    100,
    '/images/bookshop-coupon.png'
),
(
    'House Socks',
    'NJC house socks',
    100,
    200,
    100,
    '/images/house-socks.png'
),
(
    'NJC-branded Notebook',
    'NJC branded notebook',
    125,
    175,
    50,
    '/images/notebook.png'
),
(
    'Past Year Orientation Shirt',
    'NJC orientation shirt from a previous year',
    200,
    NULL,
    50,
    '/images/orientation-shirt.png'
),
(
    'NJC School Jacket',
    'Official NJC school jacket',
    275,
    NULL,
    30,
    '/images/school-jacket.png'
);

-- TEST DATA: CREDIT TRANSACTIONS
-- Student One:
-- Started with 200 credits
-- Earned 5 from a cup scan
-- Earned 10 from House Week
-- Earned another 5 from a cup scan
-- Current balance should therefore be 220.
INSERT INTO credit_transactions
(
    student_id,
    credits_change,
    reason
)
VALUES
(
    1,
    5,
    'Reusable cup scan'
),
(
    1,
    10,
    'House Week activity'
),
(
    1,
    5,
    'Reusable cup scan'
);

ALTER USER 'root'@'localhost'
IDENTIFIED BY 'NJCreditReward1234';
FLUSH PRIVILEGES;

SELECT *
FROM students
WHERE student_id = 1;
SELECT *
FROM credit_transactions
WHERE student_id = 1
ORDER BY transaction_id DESC;