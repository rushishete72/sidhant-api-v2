/*
 * File: src/database/reset_and_seed.js
 * Absolute Accountability: FINAL SIMPLIFICATION.
 * All manual connection management and transactions (db.tx) removed.
 * Relies only on the stable pg-promise pool (db.none) to minimize overhead and prevent ECONNRESET on Cloud DB.
 */

require("dotenv").config({
  path: require("path").resolve(process.cwd(), ".env"),
});
const { db, pgp } = require("./db");
const fs = require("fs");
const path = require("path");

// SQL files ke paths
const SCHEMA_DIR = path.join(__dirname, "schema_modules");
const SEED_DIR = path.join(__dirname, "seed_data");

const SCHEMA_FILES = [
  "01_Security_Base.sql",
  "02_Master_UOMs_Entities.sql",
  "03_Part_Definition.sql",
  "04_QC_Inventory_Mgt.sql",
  "07_Procurement_Purchasing.sql",
  "08_Inventory_Receipts.sql",
  "05_Production_Flow.sql",
  "06_Performance_Indexes.sql",
];

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
  try {
    console.log("=================================================");
    console.log("== GEMS Database Reset and Seed Utility ==");
    console.log("=================================================");

    // 1. Initial Connection Test (Directly on the pool)
    await db.one("SELECT 1");
    console.log("[DB] कनेक्शन टेस्ट सफल। (SELECT 1)");

    // 2. Dropping and Recreating Schema
    console.log("\n[STEP 1] Dropping existing public schema...");
    try {
      // Use IF EXISTS for robustness against network failures
      await db.none("DROP SCHEMA IF EXISTS public CASCADE");
      console.log("[STEP 1] Schema 'public' dropped successfully.");
    } catch (dropError) {
      if (dropError.code === "ECONNRESET") {
        console.warn(
          `[WARN] Schema drop failed due to network reset. Proceeding to create/re-use.`
        );
      } else {
        throw dropError;
      }
    }

    console.log("\n[STEP 2] Recreating public schema...");
    // Use IF NOT EXISTS to prevent 42P06 crash
    await db.none("CREATE SCHEMA IF NOT EXISTS public");
    console.log(
      "[STEP 2] Schema 'public' ensured (created or already existed)."
    );

    // 3. Executing Schema and Seed files sequentially using the pool (db.none)
    console.log("\n[STEP 3] Executing schema SQL files...");
    for (const file of SCHEMA_FILES) {
      const filePath = path.join(SCHEMA_DIR, file);
      console.log(`  -> Executing SCHEMA: ${file}`);
      const sql = readFile(filePath);
      await db.none(sql); // Simple execution on the pool
      console.log(`  -> OK: ${file}`);
    }
    console.log("[STEP 3] All schema files executed successfully.");

    // 4. Executing seed data SQL files
    console.log("\n[STEP 4] Executing seed data SQL files...");
    for (const file of SEED_FILES) {
      const filePath = path.join(SEED_DIR, file);
      console.log(`  -> Seeding DATA: ${file}`);
      const sql = readFile(filePath);
      await db.none(sql); // Simple execution on the pool
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
    pgp.end();
    console.log(`\n[DB] pg-promise pool closed.`);
  }
}

// Script ko chalayein
runReset();
