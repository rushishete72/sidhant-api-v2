// File: src/database/reset_and_seed.js (FINAL RESILIENT FIX)

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

// उन टेबलों की सूची जिन्हें हमें हटाना है (रिवर्स डिपेंडेंसी क्रम में)
const ALL_TABLES_TO_DROP = [
  "user_otp",
  "user_sessions",
  "inventory_stock",
  "procurement_po_items",
  "inventory_receipt_items",
  "inventory_receipts",
  "procurement_purchase_orders",
  "qc_results",
  "qc_lots",
  "master_users",
  "role_permissions",
  "permissions",
  "master_roles",
  "part_master",
  "inventory_bin_locations",
  "inventory_warehouses",
  "inventory_stock_statuses",
  "master_clients",
  "master_suppliers",
  "master_uoms",
];

// RETRY CONSTANTS
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second delay

// Helper function jo file ko padhta hai
const readFile = (filePath) => {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch (err) {
    console.error(`[ERROR] File nahi padh sake: ${filePath}`, err);
    throw err;
  }
};

// =========================================================
// CRITICAL HELPER: Executes a command with retry logic
// =========================================================
const executeWithRetry = async (command, commandType) => {
  let attempt = 0;
  let success = false;

  while (attempt < MAX_RETRIES && !success) {
    try {
      await db.none(command);
      success = true;
    } catch (error) {
      attempt++;
      // ECONNRESET या 'not queryable' error होने पर ही Retry करें
      if (
        error.code === "ECONNRESET" ||
        error.message.includes("not queryable") ||
        error.message.includes("Broken pipe")
      ) {
        console.warn(
          `    [WARN] ${commandType} failed (Attempt ${attempt}/${MAX_RETRIES}). Retrying in ${
            RETRY_DELAY / 1000
          }s...`
        );
        if (attempt < MAX_RETRIES) {
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
        } else {
          console.error(
            `    [FATAL] Failed after ${MAX_RETRIES} attempts. Last command was: ${command.substring(
              0,
              50
            )}...`
          );
          throw error; // Throw final error
        }
      } else {
        // अन्य त्रुटियों (जैसे syntax, FK violation) को तुरंत फेंक दें
        throw error;
      }
    }
  }
};

// Asynchronous function jo reset aur seed ko chalata hai
async function runReset() {
  try {
    console.log("=================================================");
    console.log("== GEMS Database Reset and Seed Utility ==");
    console.log("================================================="); // 1. Initial Connection Test (Directly on the pool)

    await db.one("SELECT 1");
    console.log("[DB] कनेक्शन टेस्ट सफल। (SELECT 1)"); // ========================================================= // [STEP 1] Dropping tables (using retry helper) // =========================================================

    console.log(
      "\n[STEP 1] Dropping tables individually to avoid connection failure..."
    );
    for (const tableName of ALL_TABLES_TO_DROP) {
      const command = `DROP TABLE IF EXISTS ${tableName} CASCADE;`;
      console.log(`  -> Dropping table: ${tableName}`);
      await executeWithRetry(command, `DROP TABLE ${tableName}`);
    }
    console.log("[STEP 1] All core tables dropped successfully."); // ========================================================= // ========================================================= // [STEP 2] Ensure public schema context is set (3F000 fix) // =========================================================
    console.log("\n[STEP 2] Ensuring public schema context is set...");
    await executeWithRetry(
      "CREATE SCHEMA IF NOT EXISTS public",
      "CREATE SCHEMA"
    );
    await executeWithRetry("SET search_path TO public;", "SET search_path");
    console.log("[STEP 2] Schema 'public' created and search path set."); // ========================================================= // [STEP 3] Executing schema SQL files (using retry helper) // =========================================================

    console.log("\n[STEP 3] Executing schema SQL files...");
    for (const file of SCHEMA_FILES) {
      const filePath = path.join(SCHEMA_DIR, file);
      console.log(`  -> Executing SCHEMA: ${file}`);
      const sql = readFile(filePath); // SQL कंटेंट को तोड़ें और प्रत्येक कमांड को retry के साथ चलाएँ
      const commands = sql
        .split(";")
        .map((cmd) => cmd.trim())
        .filter((cmd) => cmd.length > 0);
      for (const command of commands) {
        // commandType में file name जोड़ें ताकि पता चल सके कि कौन सी फाइल फेल हुई
        await executeWithRetry(command, `CREATE in ${file}`);
      }
      console.log(`  -> OK: ${file}`);
    }
    console.log("[STEP 3] All schema files executed successfully."); // ========================================================= // [STEP 4] Executing seed data SQL files (using retry helper) // =========================================================

    console.log("\n[STEP 4] Executing seed data SQL files...");
    for (const file of SEED_FILES) {
      const filePath = path.join(SEED_DIR, file);
      console.log(`  -> Seeding DATA: ${file}`);
      const sql = readFile(filePath);
      const commands = sql
        .split(";")
        .map((cmd) => cmd.trim())
        .filter((cmd) => cmd.length > 0);
      for (const command of commands) {
        await executeWithRetry(command, `INSERT in ${file}`);
      }
      console.log(`  -> OK: ${file}`);
    }
    console.log("[STEP 4] All seed data files executed successfully.");

    console.log("\n=================================================");
    console.log("== DATABASE RESET AND SEED COMPLETE! ==");
    console.log("=================================================");
  } catch (error) {
    // ... (Error handling remains the same)
    if (error.code) {
      console.error(`\n[FATAL DB ERROR] Code: ${error.code}`, error.message);
      console.error("  Query:", error.query || "N/A");
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
