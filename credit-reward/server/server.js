const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
const bodyParser = require("body-parser");
const { OAuth2Client } = require("google-auth-library");

const app = express();
app.use(bodyParser.json());
app.use(cors());
app.use(express.json());

const PORT = 3000;

// MySQL connection
const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "NJCreditReward1234", // from your SQL script
  database: "njc_rewards"
});

// Google OAuth client
const client = new OAuth2Client("YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com");

// Verify Google ID token
async function verifyGoogleToken(token) {
  const ticket = await client.verifyIdToken({
    idToken: token,
    audience: "YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com"
  });
  return ticket.getPayload(); // contains email, sub (Google user ID), etc.
}

// Route: check server running
app.get("/", (req, res) => {
  res.json({ message: "NJC Rewards server is running!" });
});

// Route: test DB connection
app.get("/api/test-db", (req, res) => {
  db.query("SELECT * FROM students", (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Database query failed" });
    }
    res.json(results);
  });
});

// Route: link RFID to student after Google login
app.post("/store-rfid", async (req, res) => {
  const { rfid, token } = req.body;

  if (!rfid || !token) {
    return res.status(400).json({ message: "RFID and Google token required" });
  }

  try {
    // Verify Google token
    const payload = await verifyGoogleToken(token);
    const email = payload.email;

    // Update student record with RFID UID
    db.query(
      "UPDATE students SET rfid_uid = ? WHERE email = ?",
      [rfid, email],
      (err, result) => {
        if (err) {
          console.error(err);
          return res.status(500).json({ message: "Database error" });
        }

        if (result.affectedRows === 0) {
          return res.status(404).json({ message: "Student not found for this email" });
        }

        res.json({ message: "RFID linked successfully to student account!" });
      }
    );
  } catch (error) {
    console.error(error);
    res.status(401).json({ message: "Invalid Google token" });
  }
});

// Route: get student info by RFID
app.get("/api/student/rfid/:uid", (req, res) => {
  const rfidUid = req.params.uid;
  const sql = `
    SELECT student_id, email, student_name, credits, join_leaderboard, level, account_status
    FROM students
    WHERE rfid_uid = ?
  `;
  db.query(sql, [rfidUid], (err, results) => {
    if (err) return res.status(500).json({ error: "Database query failed" });
    if (results.length === 0) return res.status(404).json({ error: "RFID not registered" });
    res.json(results[0]);
  });
});

// Route: scan cup (adds credits + transaction)
app.post("/api/rfid/scan", (req, res) => {
  const { rfid_uid } = req.body;
  if (!rfid_uid) return res.status(400).json({ error: "RFID UID is required" });

  const findStudentSQL = `
    SELECT student_id, student_name, credits
    FROM students
    WHERE rfid_uid = ?
  `;

  db.query(findStudentSQL, [rfid_uid], (err, results) => {
    if (err) return res.status(500).json({ error: "Database query failed" });
    if (results.length === 0) return res.status(404).json({ error: "RFID not registered" });

    const student = results[0];
    const studentId = student.student_id;
    const creditsToAdd = 5;

    // Update credits
    db.query("UPDATE students SET credits = credits + ? WHERE student_id = ?", [creditsToAdd, studentId], (err) => {
      if (err) return res.status(500).json({ error: "Failed to update credits" });

      // Record transaction
      db.query(
        "INSERT INTO credit_transactions (student_id, credits_change, reason) VALUES (?, ?, ?)",
        [studentId, creditsToAdd, "Reusable cup scan"],
        (err) => {
          if (err) return res.status(500).json({ error: "Failed to record transaction" });

          // Get updated balance
          db.query("SELECT student_id, student_name, credits FROM students WHERE student_id = ?", [studentId], (err, updatedResults) => {
            if (err) return res.status(500).json({ error: "Failed to retrieve updated balance" });

            const updatedStudent = updatedResults[0];
            res.json({
              success: true,
              student_id: updatedStudent.student_id,
              student_name: updatedStudent.student_name,
              credits_added: creditsToAdd,
              new_balance: updatedStudent.credits
            });
          });
        }
      );
    });
  });
});

// Route: get notifications
app.get("/api/notifications/:student_id", (req, res) => {
  const studentId = req.params.student_id;
  const sql = `
    SELECT transaction_id, credits_change, reason, transaction_date
    FROM credit_transactions
    WHERE student_id = ?
    ORDER BY transaction_date DESC
    LIMIT 50
  `;
  db.query(sql, [studentId], (err, results) => {
    if (err) return res.status(500).json({ error: "Database query failed" });

    const notifications = results.map(transaction => {
      const isEarned = transaction.credits_change > 0;
      const amount = isEarned ? "+" + transaction.credits_change : transaction.credits_change;
      const date = new Date(transaction.transaction_date);
      return {
        type: isEarned ? "earned" : "spent",
        amount,
        description: transaction.reason,
        details: "See transaction details",
        time: date.toLocaleTimeString(),
        date: date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }),
        raw_date: transaction.transaction_date
      };
    });

    res.json(notifications);
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
