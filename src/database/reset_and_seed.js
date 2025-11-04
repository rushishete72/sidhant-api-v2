/*
 * File: src/database/reset_and_seed.js
 * Absolute Accountability: Rebuilt to fix SQL dependency order.
 *
 * FIX 9 (Code 42P01): 'relation "inventory_bin_locations" does not exist'.
 * Yeh error isliye tha kyunki SCHEMA_FILES array mein file '07'
 * file '04' se pehle execute ho rahi thi.
 *
 * File '07' (Procurement) file '04' (Inventory Mgt) par depend karti hai.
 * Order ko correct kar diya gaya hai.
 */

require("dotenv").config({
  path: require("path").resolve(process.cwd(), ".env"),
});
const { db, pgp } = require("./db"); // db.js se import karein
const fs = require("fs");
const path = require("path");

// SQL files ke paths
const SCHEMA_DIR = path.join(__dirname, "schema_modules");
const SEED_DIR = path.join(__dirname, "seed_data");

// --- CRITICAL FIX: SQL files ka order sahi kiya gaya ---
const SCHEMA_FILES = [
  "01_Security_Base.sql",
  "02_Master_UOMs_Entities.sql",
  "03_Part_Definition.sql",
  "04_QC_Inventory_Mgt.sql", // FIX: Is file ko 07 se pehle move kiya gaya
  "07_Procurement_Purchasing.sql", // FIX: Yeh file 04 par depend karti hai
  "08_Inventory_Receipts.sql",
  "05_Production_Flow.sql",
  "06_Performance_Indexes.sql",
];
// --- End of Fix ---

const SEED_FILES = ["09_Initial_Master_Data.sql", "10_Test_Transactions.sql"];

// Helper function jo file ko padhta hai
const readFile = (filePath) => {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch (err) {
    console.error(`[ERROR] File nahi padh sake: ${filePath}`, err);
    throw err;
  }
};

// Asynchronous function jo reset aur seed ko chalata hai
async function runReset() {
  let connection;
  let originalTimeout; // Original timeout ko store karne ke liye

  try {
    console.log("=================================================");
    console.log("== GEMS Database Reset and Seed Utility ==");
    console.log("=================================================");

    // 1. Connect karein
    connection = await db.connect();
    console.log(`[DB] सफलतापूर्वक डेटाबेस से कनेक्ट हुआ।`);

    // Connection test
    await connection.one("SELECT 1");
    console.log("[DB] कनेक्शन टेस्ट सफल। (SELECT 1)");

    // Session timeout ko unlimited set karein
    const timeoutResult = await connection.one("SHOW statement_timeout");
    originalTimeout = timeoutResult.statement_timeout;
    console.log(
      `[DB] Original statement_timeout: ${originalTimeout}. Setting to 0 for reset...`
    );
    await connection.none("SET statement_timeout = 0");

    // Handle 'Schema does not exist'
    console.log("\n[STEP 1] Dropping existing public schema...");
    try {
      await connection.none("DROP SCHEMA public CASCADE");
      console.log("[STEP 1] Schema 'public' dropped successfully.");
    } catch (dropError) {
      if (dropError.code === "3F000") {
        console.warn(
          `[WARN] Schema 'public' pehle se hi delete hai (Code: 3F000). Skipping drop.`
        );
      } else {
        throw dropError;
      }
    }

    console.log("\n[STEP 2] Recreating public schema...");
    await connection.none("CREATE SCHEMA public");
    console.log("[STEP 2] Schema 'public' recreated successfully.");

    console.log("\n[STEP 3] Executing schema SQL files (Corrected Order)...");
    for (const file of SCHEMA_FILES) {
      const filePath = path.join(SCHEMA_DIR, file);
      console.log(`  -> Executing: ${file}`);
      const sql = readFile(filePath);
      await connection.none(sql);
      console.log(`  -> OK: ${file}`);
    }
    console.log("[STEP 3] All schema files executed successfully.");

    console.log("\n[STEP 4] Executing seed data SQL files...");
    for (const file of SEED_FILES) {
      const filePath = path.join(SEED_DIR, file);
      console.log(`  -> Seeding: ${file}`);
      const sql = readFile(filePath);
      await connection.none(sql);
      console.log(`  -> OK: ${file}`);
    }
    console.log("[STEP 4] All seed data files executed successfully.");

    console.log("\n=================================================");
    console.log("== DATABASE RESET AND SEED COMPLETE! ==");
    console.log("=================================================");
  } catch (error) {
    if (error.code) {
      console.error(`\n[FATAL DB ERROR] Code: ${error.code}`, error.message);
      console.error("  Query:", error.query || "N/A");
    } else {
      console.error(
        "\n[CRITICAL FAILURE] Database connection or operation failed:",
        error.message || error
      );
    }
  } finally {
    if (connection) {
      try {
        if (originalTimeout) {
          console.log(
            `\n[DB] Restoring statement_timeout to ${originalTimeout}...`
          );
          await connection.none("SET statement_timeout = $1", [
            originalTimeout,
          ]);
        }
        connection.done(); // Connection ko pool mein release karein
        console.log(`\n[DB] डेटाबेस से डिस्कनेक्ट हुआ।`);
      } catch (releaseError) {
        console.error(
          "[DB] Error releasing connection:",
          releaseError.message || releaseError
        );
      }
    }
    pgp.end(); // pg-promise connection pool ko band karein
  }
}

// Script ko chalayein
runReset();
