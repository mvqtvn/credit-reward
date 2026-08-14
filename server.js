const express = require("express");
const cors = require("cors");
const db = require("./db");
const app = express();
const PORT = 3000;


// allow website request
app.use(cors());
// allow JSON request
app.use(express.json());

//  route check server running
app.get("/", (req, res) => {
    res.json({
        message: "NJC Rewards server is running!"
    });
});

// connect to sql
app.get("/api/test-db", (req, res) => {

    db.query("SELECT * FROM students", (err, results) => {

        if (err) {
            console.error(err);

            return res.status(500).json({
                error: "Database query failed"
            });
        }

        res.json(results);
    });
});

// Get student Information
app.get("/api/student/rfid/:uid", (req, res) => {
    const rfidUid = req.params.uid;
    const sql = `
        SELECT
            student_id,
            email,
            student_name,
            credits,
            join_leaderboard,
            level,
            account_status
        FROM students
        WHERE rfid_uid = ?
    `;
    db.query(sql, [rfidUid], (err, results) => {
        if (err) {
            console.error(err);

            return res.status(500).json({
                error: "Database query failed"
            });
        }
        if (results.length === 0) {

            return res.status(404).json({
                error: "RFID not registered"
            });
        }
        res.json(results[0]);
    });
});

// Scan cup
app.post("/api/rfid/scan", (req, res) => {
    const { rfid_uid } = req.body;

    // check for rfid
    if (!rfid_uid) {
        return res.status(400).json({
            error: "RFID UID is required"
        });
    }

    // 1. find the student
    const findStudentSQL = `
        SELECT
            student_id,
            student_name,
            credits
        FROM students
        WHERE rfid_uid = ?
    `;

    db.query(
        findStudentSQL,
        [rfid_uid],
        (err, results) => {

            if (err) {
                console.error(err);

                return res.status(500).json({
                    error: "Database query failed"
                });
            }

            // rfid shows no connection
            if (results.length === 0) {

                return res.status(404).json({
                    error: "RFID not registered"
                });
            }


            const student = results[0];
            const studentId = student.student_id;
            const creditsToAdd = 5;

            // 2. add credits

            const updateCreditsSQL = `
                UPDATE students
                SET credits = credits + ?
                WHERE student_id = ?
            `;

            db.query(
                updateCreditsSQL,
                [creditsToAdd, studentId],
                (err) => {

                    if (err) {
                        console.error(err);

                        return res.status(500).json({
                            error: "Failed to update credits"
                        });
                    }

                    // 3. record transaction

                    const transactionSQL = `
                        INSERT INTO credit_transactions
                        (
                            student_id,
                            credits_change,
                            reason
                        )
                        VALUES (?, ?, ?)
                    `;

                    db.query(
                        transactionSQL,
                        [
                            studentId,
                            creditsToAdd,
                            "Reusable cup scan"
                        ],
                        (err) => {

                            if (err) {
                                console.error(err);

                                return res.status(500).json({
                                    error: "Failed to record transaction"
                                });
                            }

                            // 4. update balance

                            const getUpdatedStudentSQL = `
                                SELECT
                                    student_id,
                                    student_name,
                                    credits
                                FROM students
                                WHERE student_id = ?
                            `;

                            db.query(
                                getUpdatedStudentSQL,
                                [studentId],
                                (err, updatedResults) => {

                                    if (err) {
                                        console.error(err);

                                        return res.status(500).json({
                                            error: "Failed to retrieve updated balance"
                                        });
                                    }

                                    const updatedStudent =
                                        updatedResults[0];


                                    // 5. Send result back

                                    res.json({
                                        success: true,
                                        student_id:
                                            updatedStudent.student_id,

                                        student_name:
                                            updatedStudent.student_name,

                                        credits_added:
                                            creditsToAdd,

                                        new_balance:
                                            updatedStudent.credits
                                    });
                                }
                            );
                        }
                    );
                }
            );
        }
    );
});


// start server
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});