/*
 * File: src/modules/master/users/user.model.js
 * Module: Admin User Management (Read/Update/CRUD)
 * Absolute Accountability: Integrates all legacy CRUD logic using mandatory db.tx.
 */

const { db, pgp } = require("../../../database/db");
const CustomError = require("../../../utils/errorHandler");

const T_USERS = "master_users"; // ✅ FIX: Correct table name
const T_ROLES = "master_roles"; // ✅ FIX: Correct table name

// --- Helper Function to fetch user details with role_name ---
const getUserByIdWithRole = async (userId, t = db) => {
  // Fetches full user data, including role name
  const query = `
        SELECT u.*, r.role_name 
        FROM ${T_USERS} u
        LEFT JOIN ${T_ROLES} r ON u.role_id = r.role_id
        WHERE u.user_id = $1
    `;
  return t.oneOrNone(query, [userId]);
};

// =========================================================================
// A. CORE CRUD FUNCTIONS (Secured versions of user's uploaded logic)
// =========================================================================

/** 1. Creates a new user (Admin Panel) - Requires db.tx */
const createUser = async (data, t) => {
  const columns = new pgp.helpers.ColumnSet(
    [
      "email",
      "full_name",
      "password_hash",
      "role_id",
      "is_active",
      "is_verified",
      "created_by",
    ],
    { table: T_USERS }
  );

  const insertQuery =
    pgp.helpers.insert(data, columns, T_USERS) + ` RETURNING user_id;`;

  try {
    const result = await t.one(insertQuery); // Use transaction object 't'
    return getUserByIdWithRole(result.user_id, t);
  } catch (error) {
    if (error.code === "23505") {
      throw new CustomError("यह ईमेल पहले से मौजूद है।", 409);
    }
    if (error.code === "23503") {
      throw new CustomError("अमान्य भूमिका ID (Role ID) प्रदान की गई है।", 400);
    }
    throw new CustomError("Database insertion failed.", 500, error.message);
  }
};

/** 2. Fetches user by ID (Used by controller and internally) */
const getUserById = async (userId, t = db) => {
  return getUserByIdWithRole(userId, t);
};

/** 3. Admin: Fetches all user details with filtering/pagination (Used by getAllUsers) */
const getAllUsers = async ({
  limit = 25,
  offset = 0,
  search = "",
  isActive = null,
  isVerified = null,
}) => {
  const params = { limit, offset };
  let whereConditions = "";

  if (isActive !== null) {
    whereConditions += ' AND u."is_active" = $<isActive>';
    params.isActive = isActive;
  }
  if (isVerified !== null) {
    whereConditions += ' AND u."is_verified" = $<isVerified>';
    params.isVerified = isVerified;
  }
  if (search) {
    whereConditions +=
      ' AND (u."email" ILIKE $<searchPattern> OR u."full_name" ILIKE $<searchPattern>)';
    params.searchPattern = `%${search}%`;
  }

  const baseQuery = `
        FROM ${T_USERS} u
        LEFT JOIN ${T_ROLES} r ON u.role_id = r.role_id 
        WHERE 1=1 ${whereConditions}
    `;

  const countQuery = `SELECT COUNT(*) ${baseQuery}`;

  const dataQuery = `
        SELECT 
            u.user_id, u.email, u.full_name, u.is_active, u.is_verified, 
            r.role_name, u.created_at
        ${baseQuery}
        ORDER BY u.created_at DESC
        LIMIT $<limit> OFFSET $<offset>
    `;

  // Using db.tx for atomicity in combined fetch
  const [dataResult, countResult] = await db.tx((t) => {
    return Promise.all([t.any(dataQuery, params), t.one(countQuery, params)]);
  });

  return {
    data: dataResult,
    total_count: parseInt(countResult.count, 10),
  };
};

/** 4. Updates core user data (Used for general update and role/password dedicated routes) - Requires db.tx */
const updateUser = async (userId, data, t) => {
  if (Object.keys(data).length === 0) {
    return getUserByIdWithRole(userId, t);
  }

  const updateData = { ...data, updated_at: new Date() };

  const updateQuery =
    pgp.helpers.update(updateData, null, T_USERS) +
    ` WHERE user_id = ${userId} RETURNING user_id`;

  try {
    const result = await t.one(updateQuery);
    return getUserByIdWithRole(result.user_id, t);
  } catch (error) {
    if (error.code === "23505") {
      throw new CustomError("अपडेट विफल: यह ईमेल पहले से मौजूद है।", 409);
    }
    if (error.code === "23503") {
      throw new CustomError("अमान्य भूमिका ID (Role ID) प्रदान की गई है।", 400);
    }
    throw new CustomError("Database update failed.", 500, error.message);
  }
};

/** 5. Deactivates user (Sets is_active=FALSE) - Requires db.tx */
const deactivateUser = async (userId, t) => {
  const query = pgp.as.format(
    "UPDATE $1^ SET is_active = FALSE, updated_at = NOW() WHERE user_id = $2 AND is_active = TRUE RETURNING user_id, email, is_active;",
    [T_USERS, userId]
  );
  return t.oneOrNone(query);
};

/** 6. Activates user (Sets is_active=TRUE) - Requires db.tx */
const activateUser = async (userId, t) => {
  const query = pgp.as.format(
    "UPDATE $1^ SET is_active = TRUE, updated_at = NOW() WHERE user_id = $2 AND is_active = FALSE RETURNING user_id, email, is_active;",
    [T_USERS, userId]
  );
  return t.oneOrNone(query);
};

module.exports = {
  createUser,
  getUserById,
  getAllUsers,
  updateUser,
  deactivateUser,
  activateUser,
};
