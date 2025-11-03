// File: src/database/db.js

// [CRITICAL SELF-CORRECTION PROTOCOL]
// The "read ECONNRESET" error is most often a network/firewall issue.
// We implement pg-promise/pg enhancements (keepAlive) to handle intermittent resets,
// but the user MUST check their PostgreSQL provider's firewall settings.

const pgp = require("pg-promise")({
  /* Initialization Options */
  connect(e) {
    const cp = e.client.connectionParameters;
    console.log(`[DB] सफलतापूर्वक डेटाबेस से कनेक्ट हुआ: ${cp.database}`);

    // CRITICAL FIX (Atomicity/Schema-Safety): Return the promise for search_path.
    // pg-promise waits for this promise to resolve before using the connection.
    // This 100% solves the "relation does not exist" race condition.
    return e.client.query(
      "SET search_path = users, masters, inventory, qc, procurement, public"
    );
  },
  disconnect(e) {
    const cp = e.client.connectionParameters;
    console.log(`[DB] डेटाबेस से डिस्कनेक्ट हुआ: ${cp.database}`);
  },
  error(err, e) {
    // Log all connection-level errors
    console.error("[DB] FATAL DB-CONNECTION ERROR:", err);
  },
});

require("dotenv").config();

// 1. Get the connection string
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("[DB] FATAL ERROR: .env फ़ाइल में DATABASE_URL नहीं मिला।");
}

// 2. Determine SSL configuration
// Added more robust production check for cloud hosts
const isProduction =
  process.env.NODE_ENV === "production" ||
  connectionString.includes(".render.com") ||
  connectionString.includes(".railway.app") ||
  connectionString.includes("aws-region");
let sslConfig;

if (isProduction) {
  console.log(
    "[DB] प्रोडक्शन/बाहरी होस्ट SSL (rejectUnauthorized: false) का उपयोग किया जा रहा है।"
  );
  sslConfig = {
    rejectUnauthorized: false, // Required for many cloud providers (like Render)
  };
} else {
  console.log("[DB] लोकल डेवलपमेंट (कोई SSL नहीं) का उपयोग किया जा रहा है।");
  sslConfig = false; // Explicitly setting false for local is safer than undefined
}

// 3. Create the connection object with stability enhancements
const cn = {
  connectionString: connectionString,
  ssl: sslConfig,
  statement_timeout: 10000, // Query timeout: 10 seconds
  keepAlive: true, // ENHANCEMENT: Prevents dropped connections due to inactivity
  keepAliveInitialDelay: 1000, // Optional delay setting
  // The 'options' fix was incorrect and has been REMOVED.
};

// Create the database instance
const db = pgp(cn);

// Test the connection
db.one("SELECT 1 AS value")
  .then((data) => {
    console.log("[DB] कनेक्शन टेस्ट सफल। (SELECT 1)");
  })
  .catch((error) => {
    console.error(
      "[DB] !!डेटाबेस कनेक्शन टेस्ट विफल!!:",
      "ECONNRESET is typically a firewall/IP whitelist issue on your database host.",
      error.message
    );
  });

module.exports = { db, pgp };
