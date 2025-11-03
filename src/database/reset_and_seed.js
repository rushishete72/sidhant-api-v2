/*
 * Context Note: यह स्क्रिप्ट डेटाबेस स्कीमा को पूरी तरह से रीसेट (Schema Drops)
 * करती है और फिर सभी SQL मॉड्यूल फ़ाइलों (01-08 स्कीमा, 09-10 सीड) को
 * क्रम से चलाकर डेटाबेस को तैयार करती है।
 *
 * यह सुनिश्चित करता है कि आपके पास हमेशा एक स्वच्छ और सीडेड डेटाबेस हो।
 */

// **यह सुनिश्चित करता है कि DATABASE_URL लोड हो**
require("dotenv").config({
  path: require("path").resolve(__dirname, "../../.env"),
});
// ----------------------------------------------------

// 1. निर्भरताएँ लोड करें
const fs = require("fs");
const path = require("path");
const { db } = require("./db"); // . का मतलब है 'इसी डायरेक्टरी में'

// 2. फ़ाइल पाथ परिभाषित करें
const SCHEMA_DIR = path.join(__dirname, "schema_modules");
const SEED_DIR = path.join(__dirname, "seed_data");

/**
 * सभी तालिकाओं और अनुक्रमों को हटाने के लिए SQL कमांड।
 * इसे आपके मॉड्यूल की ड्रॉप ऑर्डर को रिवर्स में हैंडल करना चाहिए।
 */
const DROP_SQL = `
    -- Warning: This will drop ALL data and structure for the listed tables.
    DROP TABLE IF EXISTS inventory_stock_on_hand, inventory_transaction_history, 
                         inventory_receipt_items, inventory_receipts,
                         procurement_po_items, procurement_purchase_orders,
                         qc_result_details, qc_inspection_results, qc_plan_items, qc_inspection_plans, qc_lots,
                         inventory_stock_statuses, inventory_bin_locations, inventory_warehouses,
                         master_parts, master_suppliers, master_clients, master_uoms,
                         user_sessions, master_users, master_roles,
                         production_work_orders 
    CASCADE;

    -- Sequences and Types
    DROP SEQUENCE IF EXISTS po_number_seq CASCADE;
    -- यदि आपने कोई कस्टम टाइप बनाया है तो उसे यहाँ ड्रॉप करें।
`;

/**
 * एक डायरेक्टरी से .sql फ़ाइलें पढ़ता है और उन्हें क्रम में निष्पादित (Execute) करता है।
 * @param {string} dirPath - SQL फ़ाइलों वाली डायरेक्टरी का पाथ।
 * @param {string} type - 'SCHEMA' या 'SEED'
 */
const executeSqlFiles = async (dirPath, type) => {
  const files = fs
    .readdirSync(dirPath)
    .filter((file) => file.endsWith(".sql"))
    .sort(); // 01_, 02_, ... क्रम में चलाने के लिए

  console.log(
    `\n[${type} EXECUTION] Running ${files.length} files from ${dirPath}...`
  );

  for (const file of files) {
    const filePath = path.join(dirPath, file);
    const sql = fs.readFileSync(filePath, "utf-8");

    console.log(` -> Executing ${file}`);

    try {
      await db.none(sql);
    } catch (error) {
      console.error(`\n[FATAL ERROR] Failed to run ${file}:`, error.message);
      // गंभीर त्रुटि पर प्रक्रिया को बंद करें
      process.exit(1);
    }
  }
};

/**
 * मुख्य रीसेट और सीड फ़ंक्शन।
 */
async function resetAndSeed() {
  console.log("=================================================");
  console.log("== GEMS Database Reset and Seed Utility ==");
  console.log("=================================================");

  try {
    // 1. पुरानी तालिकाओं और अनुक्रमों को हटाएँ
    console.log("\n[STEP 1] Dropping existing schema...");
    await db.none(DROP_SQL);
    console.log("   ✅ Cleanup complete.");

    // 2. स्कीमा फ़ाइलें (01 से 08) चलाएँ
    await executeSqlFiles(SCHEMA_DIR, "SCHEMA");
    console.log("   ✅ All Schemas created successfully.");

    // 3. सीड फ़ाइलें (09 से 10) चलाएँ
    await executeSqlFiles(SEED_DIR, "SEED");
    console.log("   ✅ All Seed data loaded successfully.");

    // 4. सफलतापूर्वक समाप्ति
    console.log("\n=================================================");
    console.log("== Database Setup Complete: Ready for testing. ==");
    console.log("== Admin User: rushishete72@gmail.com / password123 ==");
    console.log("=================================================");
  } catch (error) {
    console.error(
      "\n[CRITICAL FAILURE] Database connection or operation failed:",
      error.message
    );
    process.exit(1); // विफल होने पर प्रक्रिया बंद करें
  } finally {
    // pg-promise कनेक्शन बंद करें
    db.$pool.end();
  }
}

// स्क्रिप्ट निष्पादित करें
resetAndSeed();
