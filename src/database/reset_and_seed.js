// File: src/database/reset_and_seed.js
// FINAL FIX: Wrapped all schema and seed operations in a single db.tx block for maximum connection stability and atomicity.

require("dotenv").config();
const { db } = require("./db");
const fs = require("fs");
const path = require("path");

// --- Configuration ---
const SCHEMA_DIR = path.join(__dirname, "schema_modules");
const SEED_DIR = path.join(__dirname, "seed_data");

// --- Utility Functions ---

// Function to read and execute SQL files in order
const executeSqlFiles = async (t, directory, label) => {
  console.log(`[STEP] Executing ${label} files from: ${directory}`);
  const files = fs.readdirSync(directory).sort();

  for (const file of files) {
    if (file.endsWith(".sql")) {
      const filePath = path.join(directory, file);
      console.log(`[SQL] Executing ${file}...`);
      const sql = fs.readFileSync(filePath, "utf8");
      await t.none(sql);
    }
  }
  console.log(`[STEP] ${label} execution complete.`);
};

// --- Main Reset and Seed Logic ---
const resetAndSeed = async () => {
  console.log("=================================================");
  console.log("== GEMS Database Reset and Seed Utility ==");
  console.log("=================================================");

  try {
    // 🎯 CRITICAL FIX: Run all operations within a single transaction block (db.tx)
    // This dramatically increases connection stability and guarantees atomicity.
    await db.tx("db-reset-and-seed-transaction", async (t) => {
      // 1. Drop Schema (FORCE RESET)
      console.log("\n[STEP 1] Dropping existing public schema...");
      // WARNING: This command is highly destructive.
      await t.none("DROP SCHEMA public CASCADE");
      await t.none("CREATE SCHEMA public");
      console.log("[STEP 1] Schema dropped and recreated successfully.");

      // 2. Create Tables (Schema Modules)
      console.log("\n[STEP 2] Creating tables from schema modules...");
      await executeSqlFiles(t, SCHEMA_DIR, "Schema Modules");

      // 3. Insert Seed Data
      console.log("\n[STEP 3] Inserting initial and test seed data...");
      await executeSqlFiles(t, SEED_DIR, "Seed Data");

      console.log("\n=================================================");
      console.log("✅ SUCCESS: Database reset and seeded successfully!");
      console.log("=================================================");
    });
  } catch (error) {
    console.error(
      `\n[CRITICAL FAILURE] Database connection or operation failed:`,
      error.message || error
    );

    // --- SECONDARY NETWORK TROUBLESHOOTING GUIDE ---
    if (error.code === "ECONNRESET" || error.message.includes("ECONNRESET")) {
      console.log("\n--- DEBUG: ECONNRESET WARNING ---");
      console.log(
        "The connection was forcefully reset by your local system (Firewall/Antivirus)."
      );
      console.log(
        "1. Check your firewall settings to ensure Node.js is allowed outbound access."
      );
      console.log("2. If using a VPN/Proxy, try disabling it.");
      console.log(
        "3. Verify your PostgreSQL service is running and accessible on the specified port."
      );
      console.log("-----------------------------------");
    }

    process.exit(1);
  } finally {
    pgp.end(); // Gracefully close all connections in the pool
  }
};

// Start the process
const { pgp } = require("./db");
resetAndSeed();
