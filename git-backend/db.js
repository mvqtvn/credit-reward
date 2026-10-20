const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env"), quiet: true });

const mysql = require("mysql2");

const db = mysql.createPool({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "NJCreditReward1234",
    database: process.env.DB_NAME || "njc_rewards",
    waitForConnections: true,
    connectionLimit: Number(process.env.DB_CONNECTION_LIMIT) || 10,
    queueLimit: 0
});

module.exports = db;