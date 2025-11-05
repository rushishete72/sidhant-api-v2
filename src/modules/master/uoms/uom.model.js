// File: src/modules/master/uoms/uom.model.js (FINAL FIX: Full User Auditing)

const { number } = require("joi");
const { db, pgp } = require("../../../../src/database/db");
const APIError = require("../../../utils/errorHandler");
const TABLE_NAME = "master_uoms";

// --- Helper Function ---
const getUOMByIdOrCode = async (identifier) => {
  // ✅ SELECT list में सभी ऑडिट फ़ील्ड जोड़े गए
  // [ARCHITECTURAL FIX]: Use standard JS to determine if the identifier is a number (ID)
    const isId = /^\d+$/.test(String(identifier).trim());
    
    // Set the WHERE condition based on the type of identifier
    const condition = isId ? 'uom_id = $1' : 'uom_code = $1';
  const query = `
        SELECT 
            uom_id, uom_code, uom_name, is_active, 
            created_at, created_by_user_id, updated_at, updated_by_user_id 
     FROM ${TABLE_NAME}
        WHERE ${condition}
    `;
   return db.oneOrNone(query, [identifier]);
  

};

// =========================================================================
// CORE CRUD FUNCTIONS
// =========================================================================

/** 1. सभी UOMs को प्राप्त करता है। */
const getAllUOMs = async ({ limit, offset }) => {
  const params = { limit, offset };

  // ✅ SELECT list में audit fields जोड़े गए
  const dataQuery = `
        SELECT uom_id, uom_code, uom_name, is_active, created_at, updated_at, created_by_user_id
        FROM ${TABLE_NAME}
        ORDER BY uom_code ASC
        LIMIT $<limit> OFFSET $<offset>
    `;

  const countQuery = `SELECT COUNT(*) FROM ${TABLE_NAME}`;

  const [dataResult, countResult] = await db.tx((t) => {
    return Promise.all([t.any(dataQuery, params), t.one(countQuery)]);
  });

  return {
    data: dataResult,
    total_count: parseInt(countResult.count, 10),
  };
};

/** 2. ID द्वारा UOM प्राप्त करता है। */
const getUOMById = async (uomId) => {

  return getUOMByIdOrCode(uomId);
};

/** 3. एक नया UOM बनाता है। */
const createUOM = async (data) => {
  const { uom_code, uom_name, created_by_user_id } = data; // ✅ created_by_user_id प्राप्त करें

  const insertData = {
    uom_code: uom_code.trim(),
    uom_name: uom_name.trim(),
    created_by_user_id: created_by_user_id, // ✅ Insert किया गया
  };

  const columns = new pgp.helpers.ColumnSet(
    ["uom_code", "uom_name", "created_by_user_id"],
    { table: TABLE_NAME }
  );

  const insertQuery =
    pgp.helpers.insert(insertData, columns, TABLE_NAME) + " RETURNING uom_id;";

  try {
    const result = await db.one(insertQuery);
    return getUOMById(result.uom_id);
  } catch (error) {
    if (error.code === "23505") {
      throw new APIError(`यह UOM Code (${uom_code}) पहले से मौजूद है।`, 409);
    }
    console.error("Database Error in createUOM:", error);
    throw new APIError("Database insertion failed.", 500);
  }
};

/** 4. UOM का नाम/कोड/स्टेटस अपडेट करता है। */
const updateUOM = async (uomId, data) => {
  if (Object.keys(data).length === 0) {
    return getUOMById(uomId);
  }

  if (data.uom_code) {
    data.uom_code = data.uom_code.trim();
  }
  if (data.uom_name) {
    data.uom_name = data.uom_name.trim();
  }

  // updated_at और updated_by_user_id को Controller द्वारा inject किया जाएगा।
  data.updated_at = new Date();

  // pgp.helpers.update को केवल मौजूद कुंजियाँ पास करें
  const updateQuery =
    pgp.helpers.update(data, Object.keys(data), TABLE_NAME) +
    ` WHERE uom_id = ${uomId} RETURNING uom_id`;

  try {
    const result = await db.oneOrNone(updateQuery);
    if (!result) return null;

    return getUOMById(result.uom_id);
  } catch (error) {
    if (error.code === "23505") {
      throw new APIError("अपडेट विफल: यह UOM Code पहले से मौजूद है।", 409);
    }
    console.error("DB Error in updateUOM:", error);
    throw new APIError("Database update failed.", 500);
  }
};

module.exports = {
  getAllUOMs,
  getUOMById,
  createUOM,
  updateUOM,
};
