/*
 * File: src/database/db.js
 * Absolute Accountability: FINAL REBUILD.
 *
 * FIX 7 (ECONNRESET LOOP BREAKER): Pichla "Simplified Mode" (Fix 6)
 * ek galti thi. Usne keepAlive settings ko hata diya tha.
 *
 * YEH NAYA LOGIC HAI:
 * Hum 'pg-promise' ko 'connectionString' aur 'keepAlive'
 * settings, dono ek saath merge karke denge.
 * 'pg-promise' 'connectionString' se connect karega aur
 * 'keepAlive' settings ko us connection par apply kar dega.
 *
 * Yeh 'DROP SCHEMA' ke dauraan hone wale network
 * timeout (ECONNRESET) ko permanently fix kar dega.
 */

require("dotenv").config({
  path: require("path").resolve(process.cwd(), ".env"),
});
const pgp = require("pg-promise")();

// --- CRITICAL FIX: Connection Logic Rebuilt ---
let cn;

if (process.env.DATABASE_URL) {
  /**************************************************************
   * PRODUCTION / RENDER CONFIG
   *
   * Hum 'connectionString' aur 'keepAlive' ko merge kar rahe hain.
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
    // 1. Connection String ka upyog karein
    connectionString: process.env.DATABASE_URL,
    ...sslConfig, // SSL settings add karein

    // 2. Network settings ko force karein
    max: 20,
    idleTimeoutMillis: 30000,
    keepAlive: true,
    keepAliveInitialDelay: 30000, // 30 second keepalive (LOOP BREAKER)
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
    keepAlive: true,
    keepAliveInitialDelay: 30000,
  };
}
// --- End of Fix ---

// Initialize the database instance
const db = pgp(cn);

module.exports = { db, pgp };
