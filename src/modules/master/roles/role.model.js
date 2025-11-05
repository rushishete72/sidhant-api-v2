// File: src/modules/master/roles/role.model.js (FIXED & UP-TO-DATE)
/*
 * Context Note: यह 'master_roles' और 'permissions' टेबल के लिए डेटाबेस तर्क (logic) को संभालता है।
 */

// निर्भरताएँ (Dependencies)
const { db, pgp } = require("../../../../src/database/db");
// ✅ FIXED: CustomError क्लास को APIError के रूप में आयात किया गया।
const APIError = require("../../../utils/errorHandler");
// ✅ FIXED: टेबल का नाम 'master_roles' का उपयोग किया गया है।
const TABLE_NAME = "master_roles";
const PERMISSIONS_TABLE = "permissions";
// --- Helper Functions ---

/** भूमिका (Role) और उसकी अनुमतियों (Permissions) को एक साथ प्राप्त करता है। */
const getRoleWithPermissions = async (roleId) => {
  const query = `
        SELECT
            r.role_id, r.role_name, r.created_at, r.updated_at,
            COALESCE(ARRAY_AGG(p.permission_key) FILTER (WHERE p.permission_key IS NOT NULL), '{}') AS permissions
        FROM master_roles r  
        LEFT JOIN role_permissions rp ON r.role_id = rp.role_id
        LEFT JOIN permissions p ON rp.permission_id = p.permission_id
        WHERE r.role_id = $1
        GROUP BY r.role_id, r.role_name, r.created_at, r.updated_at;
    `;
  return db.oneOrNone(query, [roleId]);
};

// =========================================================================
// A. CORE CRUD FUNCTIONS
// =========================================================================

/** 1. सभी भूमिकाओं (Roles) और उनकी अनुमतियों (Permissions) को प्राप्त करता है। */
const getAllRoles = async ({ limit, offset }) => {
  const params = { limit, offset };

  const baseQuery = `
        FROM master_roles r  
        LEFT JOIN role_permissions rp ON r.role_id = rp.role_id
        LEFT JOIN permissions p ON rp.permission_id = p.permission_id
        GROUP BY r.role_id, r.role_name, r.created_at, r.updated_at
        ORDER BY r.role_name ASC
        LIMIT $<limit> OFFSET $<offset>
    `;

  const dataQuery = `
        SELECT
            r.role_id, r.role_name, r.created_at,
            COALESCE(ARRAY_AGG(p.permission_key) FILTER (WHERE p.permission_key IS NOT NULL), '{}') AS permissions
        ${baseQuery}
    `;

  const countQuery = `SELECT COUNT(*) FROM master_roles`;

  const [dataResult, countResult] = await db.tx((t) => {
    return Promise.all([t.any(dataQuery, params), t.one(countQuery)]);
  });

  return {
    data: dataResult,
    total_count: parseInt(countResult.count, 10),
  };
};

/** 2. ID द्वारा भूमिका को प्राप्त करता है। */
const getRoleById = async (roleId) => {
  return getRoleWithPermissions(roleId);
};

/** 3. एक नई भूमिका (Role) बनाता है। */
const createRole = async (data) => {
  const { role_name } = data;
  const columns = new pgp.helpers.ColumnSet(["role_name"], {
    table: TABLE_NAME,
  });

  const insertQuery =
    pgp.helpers.insert({ role_name: role_name.trim() }, columns, TABLE_NAME) +
    " RETURNING role_id, role_name;";

  try {
    const result = await db.one(insertQuery);
    return getRoleWithPermissions(result.role_id);
  } catch (error) {
    if (error.code === "23505") {
      throw new APIError("यह भूमिका नाम (Role Name) पहले से मौजूद है।", 409);
    }
    console.error("Database Error in createRole:", error);
    throw new APIError("Database insertion failed.", 500);
  }
};

/** 4. भूमिका का नाम/विवरण (Name/Description) अपडेट करता है। */
const updateRole = async (roleId, data) => {
  if (Object.keys(data).length === 0) {
    return getRoleWithPermissions(roleId);
  }

  if (data.role_name) {
    data.role_name = data.role_name.trim();
  }
  data.updated_at = new Date();

  const updateQuery =
    pgp.helpers.update(data, ["role_name", "updated_at"], TABLE_NAME) +
    ` WHERE role_id = ${roleId} RETURNING role_id`;

  try {
    const result = await db.oneOrNone(updateQuery);
    if (!result) return null;

    return getRoleWithPermissions(result.role_id);
  } catch (error) {
    if (error.code === "23505") {
      throw new APIError(
        "अपडेट विफल: यह भूमिका नाम (Role Name) पहले से मौजूद है।",
        409
      );
    }
    console.error("DB Error in updateRole:", error);
    throw new APIError("Database update failed.", 500);
  }
};

// =========================================================================
// B. PERMISSIONS FUNCTIONS
// =========================================================================

/** 5. सभी उपलब्ध अनुमतियों (Permissions) को प्राप्त करता है। */
const getAllPermissions = async () => {
  // यह मानकर चलते हैं कि 'permissions' टेबल बन चुकी है।
  const query =
    "SELECT permission_id, permission_key, description FROM permissions ORDER BY permission_key ASC";
  return db.any(query);
};

//** 5.2. ✅ NEW FUNCTION: एक नई अनुमति (Permission) बनाता है।
const createPermission = async (data) => {
  const { permission_key, description } = data;
  const columns = new pgp.helpers.ColumnSet(["permission_key", "description"], {
    table: PERMISSIONS_TABLE,
  });

  const insertQuery =
    pgp.helpers.insert(
      {
        permission_key: permission_key.toLowerCase().trim(),
        description,
      },
      columns,
      PERMISSIONS_TABLE
    ) + " RETURNING permission_id, permission_key, description;";

  try {
    // अनुमति बनाते समय कोई ट्रांजेक्शन (db.tx) आवश्यक नहीं है
    const result = await db.one(insertQuery);
    return result;
  } catch (error) {
    if (error.code === "23505") {
      throw new APIError(
        `यह अनुमति कुंजी ('${permission_key}') पहले से मौजूद है।`,
        409
      );
    }
    console.error("Database Error in createPermission:", error);
    throw new APIError("Permission insertion failed.", 500);
  }
};

/** 6. भूमिका के लिए अनुमतियों को असाइन/रद्द (Assign/Revoke) करता है। (ट्रांजैक्शन में) */
const updateRolePermissions = async (roleId, permissionKeys) => {
  if (isNaN(Number(roleId)) || Number(roleId) <= 0) {
    return null;
  }

  // 1. ट्रांजैक्शन शुरू करें
  return db.tx(async (t) => {
    // 2. सुनिश्चित करें कि भूमिका (Role) मौजूद है
    const roleExists = await t.oneOrNone(
      "SELECT role_id FROM master_roles WHERE role_id = $1",
      [roleId]
    );
    if (!roleExists) {
      return null;
    }

    // 3. सभी मौजूदा अनुमतियाँ (Permissions) हटाएँ
    await t.none("DELETE FROM role_permissions WHERE role_id = $1", [roleId]);

    // 4. यदि कोई नई अनुमति कुंजी (key) नहीं है, तो यहीं समाप्त करें
    if (!permissionKeys || permissionKeys.length === 0) {
      return getRoleWithPermissions(roleId);
    }

    // 5. नई अनुमतियों की IDs प्राप्त करें
    const permissionListQuery = pgp.as.format(
      "SELECT permission_id, permission_key FROM permissions WHERE permission_key IN ($1:csv)",
      [permissionKeys]
    );
    const validPermissions = await t.any(permissionListQuery);

    // 6. अमान्य अनुमतियों की जाँच करें
    if (validPermissions.length !== permissionKeys.length) {
      const validKeys = new Set(validPermissions.map((p) => p.permission_key));
      const invalidKeys = permissionKeys.filter((key) => !validKeys.has(key));
      if (invalidKeys.length > 0) {
        throw new APIError(
          `अमान्य अनुमति कुंजी (Permission Key) प्रदान की गई है: ${invalidKeys.join(
            ", "
          )}.`,
          400
        );
      }
    }

    // 7. role_permissions टेबल में INSERT करें
    const rolePermissionsData = validPermissions.map((p) => ({
      role_id: roleId,
      permission_id: p.permission_id,
    }));

    const insertColumns = new pgp.helpers.ColumnSet(
      ["role_id", "permission_id"],
      { table: "role_permissions" }
    );
    const insertQuery = pgp.helpers.insert(rolePermissionsData, insertColumns);

    await t.none(insertQuery);

    // 8. अंतिम (Final) भूमिका डेटा लौटाएँ
    return getRoleWithPermissions(roleId);
  });
};

// =========================================================================
// FINAL EXPORTS
// =========================================================================

module.exports = {
  getAllRoles,
  getRoleById,
  createRole,
  updateRole,
  getAllPermissions,
  updateRolePermissions,
  createPermission,
};
