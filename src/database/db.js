/*
 * File: src/database/db.js
 * Absolute Accountability: FINAL HARDENING.
 * Removed unrecognized "cap" option. Ensures KeepAlive settings are forced.
 */

require("dotenv").config({
  path: require("path").resolve(process.cwd(), ".env"),
});

// CRITICAL FIX: Initializing pgp WITHOUT unrecognized options
const pgp = require("pg-promise")();

// --- CRITICAL FIX: Connection Logic Rebuilt ---
let cn;

if (process.env.DATABASE_URL) {
  /**************************************************************
   * PRODUCTION / RENDER CONFIG
   **************************************************************/
  console.log("[DB] DATABASE_URL ka upyog kiya ja raha hai (KeepAlive Mode).");

  const useSSL = process.env.DB_SSL === "true";
  const sslConfig = useSSL ? { ssl: { rejectUnauthorized: false } } : {};

  if (useSSL) {
    console.log(
      "[DB] DB_SSL=true. SSL (rejectUnauthorized: false) का उपयोग किया जा रहा है।"
    );
  } else {
    console.log(
      "[DB] DB_SSL=false ya set nahi hai. SSL का उपयोग नहीं किया जा रहा है।"
    );
  }

  cn = {
    connectionString: process.env.DATABASE_URL,
    ...sslConfig,
    max: 20,
    idleTimeoutMillis: 30000,
    // CRITICAL: Explicitly set keepAlive flags for the driver
    keepAlive: true,
    keepAliveInitialDelay: 30000,
    connectionTimeoutMillis: 10000, // Connection must succeed within 10s
  };
} else {
  /**************************************************************
   * LOCAL DEVELOPMENT CONFIG
   **************************************************************/
  console.log(
    "[DB] Local DB_HOST, DB_USER ka upyog kiya ja raha hai (Advanced Mode)."
  );

  const useSSL = process.env.DB_SSL === "true";
  const sslConfig = useSSL ? { ssl: { rejectUnauthorized: false } } : {};
  if (useSSL) {
    console.log(
      "[DB] DB_SSL=true. SSL (rejectUnauthorized: false) का उपयोग किया जा रहा है।"
    );
  }

  cn = {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ...sslConfig,
    max: 20,
    idleTimeoutMillis: 30000,
    // CRITICAL: Explicitly set keepAlive flags for the driver
    keepAlive: true,
    keepAliveInitialDelay: 30000,
    connectionTimeoutMillis: 10000,
  };
}
// --- End of Fix ---

// Initialize the database instance
const db = pgp(cn);

// Test connectivity immediately on startup
db.connect()
  .then((obj) => {
    obj.done();
    console.log("[DB] PostgreSQL connection pool initialized and verified.");
  })
  .catch((error) => {
    console.error(
      "🚨 FATAL DB ERROR: Could not connect to PostgreSQL.",
      error.message
    );
  });

module.exports = { db, pgp };
