const mysql = require("mysql");
const dotenv = require("dotenv");

dotenv.config();

const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  connectionLimit: 10,
  waitForConnections: true,
  queueLimit: 0,
  port: process.env.DB_PORT,
};
const pool = mysql.createPool(dbConfig);

function handleDisconnect() {
  pool.getConnection((err, connection) => {
    if (err) {
      console.error("Error connecting to MySQL:", err);
      setTimeout(handleDisconnect, 2000);
      return;
    }

    if (connection) {
      connection.release();
    }
  });

  // Handle unexpected errors
  pool.on("error", (err) => {
    console.error("MySQL pool error:", err);
    if (err.code === "PROTOCOL_CONNECTION_LOST" || err.code === "ECONNRESET") {
      handleDisconnect();
    } else {
      throw err;
    }
  });
}
handleDisconnect();

module.exports = { db: pool };
