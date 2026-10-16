const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
const bodyParser = require("body-parser");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const app = express();
app.use(bodyParser.json());
app.use(cors());
app.use(express.json());

// Serve static files from the website folder publicly
app.use(express.static(path.join(__dirname, "../website")));

const PORT = 3000;

// MySQL connection
const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "NJCreditReward1234",
  database: "njc_rewards"
});

let accountDataReady = false;

// Route: check server running
app.get("/", (req, res) => {
  res.json({ message: "NJC Rewards server is running!" });
});

app.post("/api/auth/signin", (req, res) => {
  if (!accountDataReady) {
    return res.status(503).json({ error: "Student accounts are still loading. Please try again shortly." });
  }

  const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";

  if (!email || email.length > 255) {
    return res.status(400).json({ error: "Enter a valid email address." });
  }

  const sql = `
    SELECT
      student.student_id,
      student.email,
      student.credit,
      student.house,
      student.level,
      COALESCE((
        SELECT SUM(transactions.usage_number)
        FROM credit_transaction AS transactions
        WHERE transactions.student_id = student.student_id
      ), 0) AS drinks_bought
    FROM student_data AS student
    WHERE student.email = ?
    LIMIT 1
  `;

  db.query(sql, [email], (err, results) => {
    if (err) {
      console.error("Database error while signing in:", err);
      return res.status(500).json({ error: "Unable to sign in right now. Please try again." });
    }

    if (results.length === 0) {
      return res.status(404).json({ error: "This email is not linked to a student account." });
    }

    const student = results[0];
    res.json({
      student: {
        student_id: student.student_id,
        email: student.email,
        credit: student.credit,
        house: student.house,
        level: student.level,
        drinks_bought: Number(student.drinks_bought)
      }
    });
  });
});

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

// Route: Get all rewards (including parsing the image array for carousels)
app.get("/api/rewards", (req, res) => {
  const sql = "SELECT * FROM rewards";

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

  const rawContent = fs.readFileSync(filePath, "utf8").trim();
  if (!rawContent) {
    return { processed: 0 };
  }

  const lines = rawContent.split(/\r?\n/);
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
      stock = VALUES(stock),
      image_urls = VALUES(image_urls)
  `;

  let processed = 0;

  for (let i = 1; i < lines.length; i++) {
    const currentLine = lines[i].trim();
    if (!currentLine) continue;

    // Better CSV parser regex handling quoted JSON strings properly
    const columns = [];
    let inQuotes = false;
    let currentCol = "";

    for (let charIdx = 0; charIdx < currentLine.length; charIdx++) {
      const char = currentLine[charIdx];
      if (char === '"' && (charIdx === 0 || currentLine[charIdx - 1] !== '\\')) {
        inQuotes = !inQuotes;
        currentCol += char;
      } else if (char === ',' && !inQuotes) {
        columns.push(currentCol.trim());
        currentCol = "";
      } else {
        currentCol += char;
      }
    }
    columns.push(currentCol.trim());

    const cleanColumns = columns.map(col => {
      let clean = col.trim();
      // If the entire cell is wrapped in quotes, unquote it
      if (clean.startsWith('"') && clean.endsWith('"')) {
        clean = clean.slice(1, -1);
      }
      return clean.replace(/""/g, '"');
    });

    const rewardId = parseInt(cleanColumns[0], 10);
    const rewardName = cleanColumns[1];
    const description = cleanColumns[2] || null;
    const cost = parseInt(cleanColumns[3], 10);
    const stock = parseInt(cleanColumns[4], 10) || 0;

    // Clean up image URLs string so it's valid JSON array format
    let rawImages = cleanColumns[5] || '["/assets/images/njclogo.png"]';
    rawImages = rawImages.replace(/^["']|["']$/g, '');
    if (!rawImages.startsWith('[')) {
      rawImages = JSON.stringify([rawImages]);
    }

    try {
      await new Promise((resolve, reject) => {
        db.query(
          sql,
          [rewardId, rewardName, description, cost, stock, rawImages],
          error => error ? reject(error) : resolve()
        );
      });
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

    const result = await new Promise((resolve, reject) => {
      db.query(sql, columns, (error, queryResult) => error ? reject(error) : resolve(queryResult));
    }).catch(error => {
      throw new Error(`${fileName} line ${index + 1} could not be loaded: ${error.message}`);
    });
    inserted += result.affectedRows;
  }

  return { inserted };
}

async function seedStudentAccountsFromCSV() {
  const students = await seedCsvRows(
    "student_data.csv",
    6,
    `INSERT INTO student_data (student_id, email, rfid_uid, credit, house, level)
     VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE student_id = student_data.student_id`
  );
  const transactions = await seedCsvRows(
    "credit_transaction.csv",
    7,
    `INSERT INTO credit_transaction
       (transaction_id, student_id, transaction_date, credit_change, type, reason, usage_number)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE transaction_id = credit_transaction.transaction_id`
  );

  accountDataReady = true;
  console.log(`Student CSV seed complete: ${students.inserted} student(s), ${transactions.inserted} transaction(s) inserted.`);
}

seedStudentAccountsFromCSV().catch(error => {
  console.error("Student CSV seed failed:", error.message);
});

// Trigger synchronization automatically on reboot
syncLocalCSVToMySQL()
  .then(({ processed }) => {
    console.log(`Startup CSV sync complete: ${processed} reward(s) processed.`);
  })
  .catch(error => {
    console.error("Startup CSV sync failed:", error.message);
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