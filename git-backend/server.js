const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const db = require("./db");

const app = express();
app.use(express.json());
app.use(cors());

// Serve static files from the website folder publicly
app.use(express.static(path.join(__dirname, "../website")));

const PORT = Number(process.env.PORT) || 3000;
const HOUSE_DESIGNS = ["Ignis", "Lignum", "Solaris", "Terra", "Aqua", "Aerius"];

let accountDataReady = false;
let startupDataReady = false;

// Route: check server running
app.get("/", (req, res) => {
  res.json({ message: "NJC Rewards server is running!" });
});

app.post("/api/auth/signin", (req, res) => {
  if (!accountDataReady) {
    return res.status(503).json({ error: "Student accounts are still loading. Please try again shortly." });
  }

  const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const password = typeof req.body.password === "string" ? req.body.password : "";

  if (!email || email.length > 255 || !password || password.length > 1024) {
    return res.status(400).json({ error: "Enter a valid email and password." });
  }

  const sql = `
    SELECT
      student.student_id,
      student.email,
      student.rfid_uid,
      COALESCE(ecocoins.credit, 0) AS credit,
      COALESCE(ecocoins.drink_stall_scans, 0) AS drinks_bought,
      student.house,
      student.level,
      student.password_hash
    FROM student_data AS student
    LEFT JOIN ecocoins ON ecocoins.student_id = student.student_id
    WHERE student.email = ?
    LIMIT 1
  `;

  db.query(sql, [email], (err, results) => {
    if (err) {
      console.error("Database error while signing in:", err);
      return res.status(500).json({ error: "Unable to sign in right now. Please try again." });
    }

    if (results.length === 0) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const student = results[0];
    verifyStudentPassword(password, student.password_hash)
      .then(isValid => {
        if (!isValid) {
          return res.status(401).json({ error: "Invalid email or password." });
        }

        res.json({
          student: {
            student_id: student.student_id,
            email: student.email,
            rfid_uid: student.rfid_uid,
            credit: student.credit,
            house: student.house,
            level: student.level,
            drinks_bought: Number(student.drinks_bought)
          }
        });
      })
      .catch(passwordError => {
        console.error("Unable to verify student password:", passwordError);
        res.status(500).json({ error: "Unable to sign in right now. Please try again." });
      });
  });
});

app.get("/api/students/:studentId", (req, res) => {
  if (!accountDataReady) {
    return res.status(503).json({ error: "Student accounts are still loading. Please try again shortly." });
  }

  const studentId = Number(req.params.studentId);
  if (!Number.isSafeInteger(studentId) || studentId <= 0) {
    return res.status(400).json({ error: "Invalid student ID." });
  }

  const sql = `
    SELECT
      student.student_id,
      student.email,
      student.rfid_uid,
      COALESCE(ecocoins.credit, 0) AS credit,
      COALESCE(ecocoins.drink_stall_scans, 0) AS drinks_bought,
      student.house,
      student.level
    FROM student_data AS student
    LEFT JOIN ecocoins ON ecocoins.student_id = student.student_id
    WHERE student.student_id = ?
    LIMIT 1
  `;

  db.query(sql, [studentId], (err, results) => {
    if (err) {
      console.error("Database error while refreshing student details:", err);
      return res.status(500).json({ error: "Unable to refresh student details." });
    }
    if (results.length === 0) {
      return res.status(404).json({ error: "Student account not found." });
    }

    const student = results[0];
    res.json({
      student: {
        ...student,
        drinks_bought: Number(student.drinks_bought)
      }
    });
  });
});

function verifyStudentPassword(password, encodedHash) {
  const [algorithm, saltHex, keyHex] = String(encodedHash || "").split("$");
  if (algorithm !== "scrypt" || !/^[a-f0-9]{32}$/i.test(saltHex || "")
      || !/^[a-f0-9]{128}$/i.test(keyHex || "")) {
    return Promise.resolve(false);
  }

  return new Promise((resolve, reject) => {
    crypto.scrypt(password, Buffer.from(saltHex, "hex"), 64, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(crypto.timingSafeEqual(derivedKey, Buffer.from(keyHex, "hex")));
    });
  });
}

app.get("/api/notifications/:studentId", (req, res) => {
  const studentId = Number(req.params.studentId);
  if (!Number.isSafeInteger(studentId) || studentId <= 0) {
    return res.status(400).json({ error: "Invalid student ID." });
  }

  const sql = `
    SELECT
      CASE WHEN type = 'EARN' THEN 'earned' ELSE 'spent' END AS type,
      reason AS description,
      ABS(credit_change) AS amount,
      DATE_FORMAT(transaction_date, '%Y-%m-%d') AS date,
      DATE_FORMAT(transaction_date, '%H:%i') AS time
    FROM credit_transaction
    WHERE student_id = ?
    ORDER BY transaction_date DESC, transaction_id DESC
    LIMIT 50
  `;

  db.query(sql, [studentId], (err, results) => {
    if (err) {
      console.error("Database error while fetching student notifications:", err);
      return res.status(500).json({ error: "Unable to load notifications." });
    }

    res.json(results);
  });
});

app.get("/api/redemptions/:studentId", (req, res) => {
  if (!startupDataReady) {
    return res.status(503).json({ error: "Reward data is still loading. Please try again shortly." });
  }

  const studentId = Number(req.params.studentId);
  if (!Number.isSafeInteger(studentId) || studentId <= 0) {
    return res.status(400).json({ error: "Invalid student ID." });
  }

  const sql = `
    SELECT
      redemption.redemption_id AS redemptionId,
      redemption.redemption_status AS status,
      reward.reward_name AS rewardName,
      reward.description,
      reward.cost,
      reward.image_urls AS imageUrls,
      redemption.house_design AS houseDesign
    FROM redemption_status AS redemption
    JOIN rewards AS reward ON reward.reward_id = redemption.reward_id
    WHERE redemption.student_id = ?
      AND redemption.redemption_status = 'Unredeemed'
    ORDER BY redemption.redemption_id DESC
  `;

  db.query(sql, [studentId], (err, results) => {
    if (err) {
      console.error("Database error while fetching student redemptions:", err);
      return res.status(500).json({ error: "Unable to load unredeemed rewards." });
    }

    res.json(results.map(redemption => {
      let imageUrls;
      try {
        imageUrls = JSON.parse(redemption.imageUrls || "[]");
      } catch (error) {
        console.error("Invalid reward image data for redemption:", error);
        imageUrls = [];
      }

      return { ...redemption, imageUrls: Array.isArray(imageUrls) ? imageUrls : [] };
    }));
  });
});

app.post("/api/redemptions", async (req, res) => {
  if (!startupDataReady) {
    return res.status(503).json({ error: "Reward data is still loading. Please try again shortly." });
  }

  const studentId = Number(req.body.studentId);
  const rewardId = Number(req.body.rewardId);
  const houseDesign = typeof req.body.houseDesign === "string" ? req.body.houseDesign : null;

  if (!Number.isSafeInteger(studentId) || studentId <= 0
      || !Number.isSafeInteger(rewardId) || rewardId <= 0) {
    return res.status(400).json({ error: "A valid student and reward are required." });
  }
  if (houseDesign !== null && !HOUSE_DESIGNS.includes(houseDesign)) {
    return res.status(400).json({ error: "Choose a valid house design." });
  }

  let connection;
  try {
    connection = await db.promise().getConnection();
    await connection.beginTransaction();

    const [students] = await connection.execute(
      `SELECT student.student_id, ecocoins.credit
       FROM student_data AS student
       LEFT JOIN ecocoins ON ecocoins.student_id = student.student_id
       WHERE student.student_id = ?
       FOR UPDATE`,
      [studentId]
    );
    if (students.length === 0 || students[0].credit === null) {
      const error = new Error("Student account not found.");
      error.statusCode = 404;
      throw error;
    }

    const [rewards] = await connection.execute(
      `SELECT reward_id, reward_name, cost, stock
       FROM rewards
       WHERE reward_id = ?
       FOR UPDATE`,
      [rewardId]
    );
    if (rewards.length === 0) {
      const error = new Error("Reward not found.");
      error.statusCode = 404;
      throw error;
    }

    const reward = rewards[0];
    const requiresHouseDesign = ["Keychains", "Socks", "Stickers"]
      .includes(reward.reward_name);
    if (requiresHouseDesign && houseDesign === null) {
      const error = new Error("Choose a house design for this reward.");
      error.statusCode = 400;
      throw error;
    }
    if (!requiresHouseDesign && houseDesign !== null) {
      const error = new Error("This reward does not have a house design.");
      error.statusCode = 400;
      throw error;
    }
    if (reward.stock <= 0) {
      const error = new Error("This reward is out of stock.");
      error.statusCode = 409;
      throw error;
    }
    if (students[0].credit < reward.cost) {
      const error = new Error("You do not have enough credits for this reward.");
      error.statusCode = 400;
      throw error;
    }

    await connection.execute(
      "UPDATE ecocoins SET credit = credit - ? WHERE student_id = ?",
      [reward.cost, studentId]
    );
    await connection.execute(
      "UPDATE rewards SET stock = stock - 1 WHERE reward_id = ?",
      [rewardId]
    );
    const [redemption] = await connection.execute(
      `INSERT INTO redemption_status (student_id, reward_id, redemption_status, house_design)
       VALUES (?, ?, 'Unredeemed', ?)`,
      [studentId, rewardId, houseDesign]
    );
    await connection.execute(
      `INSERT INTO credit_transaction (student_id, credit_change, type, reason, usage_number)
       VALUES (?, ?, 'SPENT', ?, 1)`,
      [
        studentId,
        -reward.cost,
        `Reward redemption: ${reward.reward_name}${houseDesign ? ` (${houseDesign} design)` : ""}`
      ]
    );

    const creditBalance = students[0].credit - reward.cost;
    await connection.commit();

    let csvSynced = true;
    try {
      const redemptionCsv = path.join(__dirname, "redemption.csv");
      const csvContents = await fs.promises.readFile(redemptionCsv, "utf8");
      const separator = csvContents && !csvContents.endsWith("\n") && !csvContents.endsWith("\r")
        ? "\n"
        : "";
      await fs.promises.appendFile(
        redemptionCsv,
        `${separator}${redemption.insertId},${studentId},${rewardId},Unredeemed,${houseDesign || ""}\n`,
        "utf8"
      );
    } catch (error) {
      csvSynced = false;
      console.error("Reward purchase was saved, but redemption.csv could not be updated:", error);
    }

    res.status(201).json({
      redemptionId: redemption.insertId,
      rewardName: reward.reward_name,
      creditBalance,
      csvSynced
    });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error("Unable to roll back reward purchase:", rollbackError);
      }
    }

    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error("Database error while purchasing reward:", error);
    return res.status(500).json({ error: "Unable to complete this reward purchase." });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

app.get("/api/leaderboard", (req, res) => {
  const sql = `
    SELECT house_name AS houseName, total_usage_number AS credits
    FROM house_credits
    ORDER BY total_usage_number DESC, house_name ASC
  `;

  db.query(sql, (err, results) => {
    if (err) {
      console.error("Database error while fetching the house leaderboard:", err);
      return res.status(500).json({ error: "Unable to load the house leaderboard." });
    }

    res.json(results);
  });
});

// Route: Get all rewards (including parsing the image array for carousels)
app.get("/api/rewards", (req, res) => {
  if (!startupDataReady) {
    return res.status(503).json({ error: "Reward data is still loading. Please try again shortly." });
  }

  const sql = `
    SELECT reward_id, reward_name, description, cost, stock, image_urls
    FROM rewards
  `;

  db.query(sql, (err, results) => {
    if (err) {
      console.error("Database error while fetching rewards:", err);
      return res.status(500).json({ error: "Database query failed" });
    }

    const formattedResults = results.map(item => {
      try {
        return {
          ...item,
          image_urls: JSON.parse(item.image_urls || '[]')
        };
      } catch (e) {
        return {
          ...item,
          image_urls: item.image_urls ? [item.image_urls] : []
        };
      }
    });

    res.json(formattedResults);
  });
});

// FUNCTION: Reads local rewards.csv and updates MySQL database storage securely
async function syncLocalCSVToMySQL() {
  const filePath = path.join(__dirname, "rewards.csv");

  if (!fs.existsSync(filePath)) {
    throw new Error("'rewards.csv' file not found in the server root folder.");
  }

  const rawContent = fs.readFileSync(filePath, "utf8");
  if (!rawContent) {
    return { processed: 0 };
  }

  const lines = rawContent.trim().split(/\r?\n/);
  if (lines.length <= 1) {
    return { processed: 0 };
  }

  const sql = `
    INSERT INTO rewards (reward_id, reward_name, description, cost, stock, image_urls)
    VALUES (?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      reward_name = VALUES(reward_name),
      description = VALUES(description),
      cost = VALUES(cost),
      image_urls = VALUES(image_urls)
  `;

  let processed = 0;

  for (let i = 1; i < lines.length; i++) {
    const currentLine = lines[i].trim();
    if (!currentLine) continue;

    const cleanColumns = parseCsvRow(currentLine);
    if (cleanColumns.length !== 6) {
      throw new Error(`rewards.csv line ${i + 1} has ${cleanColumns.length} columns; expected 6.`);
    }

    const rewardId = parseInt(cleanColumns[0], 10);
    const rewardName = cleanColumns[1];
    const description = cleanColumns[2] || null;
    const cost = parseInt(cleanColumns[3], 10);
    const stock = parseInt(cleanColumns[4], 10) || 0;

    let rawImages = cleanColumns[5] || '["/assets/images/njclogo.png"]';
    if (!rawImages.startsWith('[')) {
      rawImages = JSON.stringify([rawImages]);
    } else {
      const imageUrls = JSON.parse(rawImages);
      if (!Array.isArray(imageUrls)) {
        throw new Error(`rewards.csv line ${i + 1} image_urls must be a JSON array.`);
      }
    }

    try {
      await queryDatabase(sql, [rewardId, rewardName, description, cost, stock, rawImages]);
      processed++;
    } catch (error) {
      throw new Error(`CSV sync failed on line ${i + 1} (ID: ${rewardId}): ${error.message}`);
    }
  }

  return { processed };
}

function parseCsvRow(line) {
  const columns = [];
  let currentColumn = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index++) {
    const character = line[index];

    if (character === '"') {
      if (inQuotes && line[index + 1] === '"') {
        currentColumn += '"';
        index++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (character === "," && !inQuotes) {
      columns.push(currentColumn.trim());
      currentColumn = "";
    } else {
      currentColumn += character;
    }
  }

  if (inQuotes) {
    throw new Error("CSV row contains an unterminated quoted field.");
  }

  columns.push(currentColumn.trim());
  return columns;
}

async function seedCsvRows(fileName, expectedColumns, sql) {
  const filePath = path.join(__dirname, fileName);
  if (!fs.existsSync(filePath)) {
    throw new Error(`'${fileName}' file not found in the backend folder.`);
  }

  const lines = fs.readFileSync(filePath, "utf8").trim().split(/\r?\n/);
  if (lines.length <= 1) {
    return { inserted: 0 };
  }

  let inserted = 0;
  for (let index = 1; index < lines.length; index++) {
    if (!lines[index].trim()) continue;
    const columns = parseCsvRow(lines[index]);
    if (columns.length !== expectedColumns) {
      throw new Error(`${fileName} line ${index + 1} has ${columns.length} columns; expected ${expectedColumns}.`);
    }

    let result;
    try {
      result = await queryDatabase(sql, columns);
    } catch (error) {
      throw new Error(`${fileName} line ${index + 1} could not be loaded: ${error.message}`);
    }
    inserted += result.affectedRows;
  }

  return { inserted };
}

async function seedStudentAccountsFromCSV() {
  await ensureEcocoinScanTracking();
  await ensureStudentPasswordHash();

  const students = await seedCsvRows(
    "student_data.csv",
    6,
    `INSERT INTO student_data (student_id, email, rfid_uid, house, level, password_hash)
     VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       password_hash = COALESCE(NULLIF(student_data.password_hash, ''), VALUES(password_hash))`
  );
  await queryDatabase(`
    INSERT INTO ecocoins (student_id, credit, drink_stall_scans)
    SELECT students.student_id, sample_balances.credit, sample_balances.drink_stall_scans
    FROM student_data AS students
    JOIN sample_ecocoin_balances AS sample_balances ON sample_balances.email = students.email
    ON DUPLICATE KEY UPDATE ecocoin_id = ecocoins.ecocoin_id
  `);
  await queryDatabase(`
    INSERT INTO ecocoins (student_id)
    SELECT student_id
    FROM student_data
    ON DUPLICATE KEY UPDATE student_id = VALUES(student_id)
  `);
  accountDataReady = true;
  console.log(`Student CSV seed complete: ${students.inserted} student(s) inserted.`);
  return students;
}

async function ensureStudentPasswordHash() {
  const columns = await queryDatabase("SHOW COLUMNS FROM student_data LIKE 'password_hash'");
  if (columns.length === 0) {
    await queryDatabase("ALTER TABLE student_data ADD COLUMN password_hash VARCHAR(255) NULL");
  }
}

function queryDatabase(sql, parameters = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, parameters, (error, results) => {
      if (error) {
        reject(error);
      } else {
        resolve(results);
      }
    });
  });
}

async function ensureRedemptionHouseDesign() {
  const columns = await queryDatabase("SHOW COLUMNS FROM redemption_status LIKE 'house_design'");
  if (columns.length === 0) {
    await queryDatabase(
      "ALTER TABLE redemption_status ADD COLUMN house_design VARCHAR(50) NULL AFTER redemption_status"
    );
  }
}

async function ensureEcocoinScanTracking() {
  const columns = await queryDatabase("SHOW COLUMNS FROM ecocoins LIKE 'drink_stall_scans'");
  if (columns.length === 0) {
    await queryDatabase(
      "ALTER TABLE ecocoins ADD COLUMN drink_stall_scans INT NOT NULL DEFAULT 0 CHECK (drink_stall_scans >= 0)"
    );
  }

  await ensureRedemptionHouseDesign();

  const transactionIndex = await queryDatabase(
    "SHOW INDEX FROM credit_transaction WHERE Key_name = 'idx_transaction_student_date'"
  );
  if (transactionIndex.length === 0) {
    await queryDatabase(
      "CREATE INDEX idx_transaction_student_date ON credit_transaction(student_id, transaction_date, transaction_id)"
    );
  }

  const legacyTransactionIndex = await queryDatabase(
    "SHOW INDEX FROM credit_transaction WHERE Key_name = 'idx_transaction_student'"
  );
  if (legacyTransactionIndex.length > 0) {
    await queryDatabase("DROP INDEX idx_transaction_student ON credit_transaction");
  }

  const redundantRfidIndex = await queryDatabase(
    "SHOW INDEX FROM student_data WHERE Key_name = 'idx_student_rfid'"
  );
  if (redundantRfidIndex.length > 0) {
    await queryDatabase("DROP INDEX idx_student_rfid ON student_data");
  }

  const triggers = [
    {
      name: "trg_drink_stall_scan_insert",
      sql: `CREATE TRIGGER trg_drink_stall_scan_insert
        AFTER INSERT ON credit_transaction
        FOR EACH ROW
        BEGIN
          IF NEW.reason = 'DrinkStall' THEN
            UPDATE ecocoins
            SET drink_stall_scans = drink_stall_scans + 1
            WHERE student_id = NEW.student_id;
          END IF;
        END`
    },
    {
      name: "trg_drink_stall_scan_update",
      sql: `CREATE TRIGGER trg_drink_stall_scan_update
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
        END`
    },
    {
      name: "trg_drink_stall_scan_delete",
      sql: `CREATE TRIGGER trg_drink_stall_scan_delete
        AFTER DELETE ON credit_transaction
        FOR EACH ROW
        BEGIN
          IF OLD.reason = 'DrinkStall' THEN
            UPDATE ecocoins
            SET drink_stall_scans = GREATEST(0, drink_stall_scans - 1)
            WHERE student_id = OLD.student_id;
          END IF;
        END`
    }
  ];

  for (const trigger of triggers) {
    const existing = await queryDatabase(
      "SELECT TRIGGER_NAME FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA = DATABASE() AND TRIGGER_NAME = ?",
      [trigger.name]
    );
    if (existing.length === 0) {
      await queryDatabase(trigger.sql);
    }
  }
}

// Load catalog and student rows before importing redemption records that reference them.
Promise.all([seedStudentAccountsFromCSV(), syncLocalCSVToMySQL()])
  .then(async ([students, rewards]) => {
    console.log(`Student CSV seed complete: ${students.inserted} student(s) inserted.`);
    console.log(`Startup CSV sync complete: ${rewards.processed} reward(s) processed.`);

    // Seed existing redemption IDs before new purchases are appended to the CSV.
    const redemptions = await seedCsvRows(
      "redemption.csv",
      5,
      `INSERT IGNORE INTO redemption_status
       (redemption_id, student_id, reward_id, redemption_status, house_design)
       VALUES (?, ?, ?, ?, ?)`
    );
    console.log(`Redemption CSV seed complete: ${redemptions.inserted} record(s) inserted.`);
    startupDataReady = true;
  })
  .catch(error => {
    console.error("Startup data initialization failed:", error.message);
  });

function requireAdminToken(req, res, next) {
  const expectedToken = process.env.ADMIN_SYNC_TOKEN;
  if (!expectedToken) {
    return res.status(503).json({ error: "Admin CSV sync is not configured on the server." });
  }

  const providedToken = req.get("x-admin-token");
  if (!providedToken) {
    return res.status(401).json({ error: "Admin token required." });
  }

  const expected = Buffer.from(expectedToken);
  const provided = Buffer.from(providedToken);
  if (expected.length !== provided.length || !crypto.timingSafeEqual(expected, provided)) {
    return res.status(401).json({ error: "Invalid admin token." });
  }

  next();
}

// Route: Authenticated manual CSV sync. Respond only after all rows finish.
app.post("/api/admin/sync-csv", requireAdminToken, async (req, res) => {
  try {
    const { processed } = await syncLocalCSVToMySQL();
    res.json({ success: true, processed, message: "Rewards CSV synchronized successfully." });
  } catch (error) {
    console.error("Manual CSV sync failed:", error.message);
    res.status(500).json({ error: "Rewards CSV synchronization failed.", details: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});