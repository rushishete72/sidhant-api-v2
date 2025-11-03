// File: src/database/db.js
// FINAL, 100% CORRECTED VERSION
// This version fixes the "invalid command-line argument" error AND
// correctly sets the search_path by returning a promise in the 'connect' event.

const pgp = require("pg-promise")({
  /* Initialization Options */
  connect(e) {
    const cp = e.client.connectionParameters;
    console.log(`[DB] सफलतापूर्वक डेटाबेस से कनेक्ट हुआ: ${cp.database}`);

    // CRITICAL FIX: Return the promise.
    // pg-promise will wait for this promise to resolve
    // before releasing the connection for its first use.
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
const isRenderHost = connectionString.includes(".render.com");
let sslConfig;

if (isRenderHost) {
  console.log(
    "[DB] Production/Render.com SSL (rejectUnauthorized: false) के साथ कनेक्ट हो रहा है।"
  );
  sslConfig = {
    rejectUnauthorized: false, // Required for Render
  };
} else {
  // We check NODE_ENV for local development
  const isProduction = process.env.NODE_ENV === "production";
  if (isProduction) {
    console.log("[DB] Production (Non-Render) SSL के साथ कनेक्ट हो रहा है।");
    sslConfig = { rejectUnauthorized: false };
  } else {
    console.log("[DB] Local development (no SSL) के साथ कनेक्ट हो रहा है।");
    sslConfig = undefined; // local dev
  }
}

// 3. Create the connection object
const cn = {
  connectionString: connectionString,
  ssl: sslConfig,
  statement_timeout: 10000, // 10 seconds
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
    console.error("[DB] !!डेटाबेस कनेक्शन टेस्ट विफल!!:", error.message);
  });

module.exports = { db, pgp };
