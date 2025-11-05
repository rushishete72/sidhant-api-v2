// File: src/modules/master/users/user.model.js

// निर्भरताएँ
const { db, pgp } = require("../../../../src/database/db");
const APIError = require("../../../utils/errorHandler");
// Password hashing के लिए bcrypt की आवश्यकता है (Service Layer में उपयोग होगा, लेकिन Model CRUD Functions पर ध्यान केंद्रित करता है)
const TABLE_NAME = "master_users";

// --- Helper Function ---
/** उपयोगकर्ता (User) और उसकी भूमिका (Role) को एक साथ प्राप्त करता है। */
const getUserWithRole = async (userId) => {
  const query = `
        SELECT
            u.user_id, u.full_name, u.email, 
            u.is_active, u.is_verified, u.last_login,
            r.role_id, r.role_name
        FROM master_users u
        LEFT JOIN master_roles r ON u.role_id = r.role_id
        WHERE u.user_id = $1;
    `;
  return db.oneOrNone(query, [userId]);
};

// =========================================================================
// CORE FUNCTIONS
// =========================================================================

/** 1. एक नया उपयोगकर्ता (User) बनाता है। */
const createUser = async (data) => {
  const { full_name, email, password_hash, role_id } = data;

  // सुनिश्चित करें कि केवल आवश्यक कॉलम डालें
  const columns = new pgp.helpers.ColumnSet(
    ["full_name", "email", "password_hash", "role_id", "is_verified"],
    { table: TABLE_NAME }
  );

  const insertQuery =
    pgp.helpers.insert(
      {
        full_name: full_name.trim(),
        email: email.toLowerCase().trim(),
        password_hash: password_hash,
        role_id: role_id,
        is_verified: true, // Admin-created user को तुरंत सत्यापित (verified) माना जाता है।
      },
      columns,
      TABLE_NAME
    ) + " RETURNING user_id;";

  try {
    const result = await db.one(insertQuery);
    return getUserWithRole(result.user_id);
  } catch (error) {
    if (error.code === "23505") {
      throw new APIError("यह ईमेल (Email) पहले से मौजूद है।", 409);
    }
    console.error("Database Error in createUser:", error);
    throw new APIError("Database insertion failed.", 500);
  }
};

/** 2. ID द्वारा उपयोगकर्ता को प्राप्त करता है। */
const getUserById = async (userId) => {
  return getUserWithRole(userId);
};

/** 3. सभी उपयोगकर्ताओं और उनकी भूमिकाओं को प्राप्त करता है। */
const getAllUsers = async ({ limit, offset }) => {
  const params = { limit, offset };

  const dataQuery = `
        SELECT
            u.user_id, u.full_name, u.email, u.is_active, u.is_verified, 
            r.role_name
        FROM master_users u
        LEFT JOIN master_roles r ON u.role_id = r.role_id
        ORDER BY u.full_name ASC
        LIMIT $<limit> OFFSET $<offset>
    `;

  const countQuery = `SELECT COUNT(*) FROM master_users`;

  const [dataResult, countResult] = await db.tx((t) => {
    return Promise.all([t.any(dataQuery, params), t.one(countQuery)]);
  });

  return {
    data: dataResult,
    total_count: parseInt(countResult.count, 10),
  };
};

/** 4. उपयोगकर्ता का नाम/status अपडेट करता है। */
const updateUser = async (userId, data) => {
  if (Object.keys(data).length === 0) {
    return getUserWithRole(userId);
  }

  if (data.full_name) {
    data.full_name = data.full_name.trim();
  }
  if (data.email) {
    data.email = data.email.toLowerCase().trim();
  }
  data.updated_at = new Date();

  // केवल allowed columns को पास करें
  const allowedColumns = [
    "full_name",
    "is_active",
    "is_verified",
    "password_hash",
    "role_id",
    "updated_at",
  ];
  const updateData = {};
  allowedColumns.forEach((col) => {
    if (data[col] !== undefined) {
      updateData[col] = data[col];
    }
  });

  // यदि updateData खाली है, तो रोल के साथ user लौटाएँ
  if (Object.keys(updateData).length === 0) return getUserWithRole(userId);

  // 🚨 CRITICAL FIX: pgp.helpers.update को केवल अपडेट किए जा रहे फ़ील्ड की कुंजियाँ पास करें।
  // Object.keys(updateData) अब केवल वे कुंजियाँ लौटाएगा जो 'data' में मौजूद थीं।
  const updateQuery =
    pgp.helpers.update(updateData, Object.keys(updateData), TABLE_NAME) +
    ` WHERE user_id = ${userId} RETURNING user_id`;

  // ... (rest of the try/catch block remains the same)
  try {
    const result = await db.oneOrNone(updateQuery); // Call to line 128 was here
    if (!result) return null;

    return getUserWithRole(result.user_id);
  } catch (error) {
    if (error.code === "23505") {
      throw new APIError("अपडेट विफल: यह ईमेल (Email) पहले से मौजूद है।", 409);
    }
    console.error("DB Error in updateUser:", error);
    throw new APIError("Database update failed.", 500);
  }
};

module.exports = {
  createUser,
  getUserById,
  getAllUsers,
  updateUser, // सभी PUT, PATCH, deactivate, activate के लिए आधार
  getUserWithRole,
};
