/*
 * File: src/modules/auth/userAuth/userAuth.model.js
 * Absolute Accountability: FINAL REBUILD. Added stateful session management.
 */

const { db, pgp } = require("../../../database/db");
const CustomError = require("../../../utils/errorHandler");

// Tables based on 01_Security_Base.sql
const T_USERS = "master_users";
const T_ROLES = "master_roles";
const T_OTP = "user_otp";
const T_SESSIONS = "user_sessions"; // ✅ NEW: For Refresh Tokens

/**
 * Finds a user and their role/OTP data by email.
 */
const findUserByEmail = async (email, t) => {
  const query = `
    SELECT 
      u.user_id, u.email, u.full_name, u.password_hash, u.role_id,
      u.is_active, u.is_verified, u.last_login,
      r.role_name,
      otp.otp_code, otp.expires_at AS otp_expiry
    FROM ${T_USERS} u
    LEFT JOIN ${T_ROLES} r ON u.role_id = r.role_id
    LEFT JOIN ${T_OTP} otp ON u.user_id = otp.user_id
    WHERE u.email = $1;
  `;
  // Using t.oneOrNone ensures transaction integrity
  return t.oneOrNone(query, [email]);
};

/**
 * Finds a user and their role/OTP data by ID.
 */
const findUserById = async (user_id, t) => {
  const query = `
    SELECT 
      u.user_id, u.email, u.full_name, u.password_hash, u.role_id,
      u.is_active, u.is_verified, u.last_login,
      r.role_name,
      otp.otp_code, otp.expires_at AS otp_expiry
    FROM ${T_USERS} u
    LEFT JOIN ${T_ROLES} r ON u.role_id = r.role_id
    LEFT JOIN ${T_OTP} otp ON u.user_id = otp.user_id
    WHERE u.user_id = $1;
  `;
  return t.oneOrNone(query, [user_id]);
};

/**
 * Creates a new user during registration.
 */
const createUser = async (userData, t) => {
  // CRITICAL FIX: Ensure 'password_hash' is used, not 'password'
  const data = {
    ...userData,
    is_verified: false,
    password_hash: userData.password_hash,
  };
  const query =
    pgp.helpers.insert(data, null, T_USERS) +
    " RETURNING user_id, email, full_name, role_id, is_verified";

  try {
    return await t.one(query);
  } catch (error) {
    if (error.code === "23505") {
      throw new CustomError("User already exists.", 409);
    }
    throw error;
  }
};

/**
 * Inserts or updates a user's OTP.
 */
const updateUserOtp = async (user_id, otp, otpExpiry, t) => {
  const query = `
    INSERT INTO ${T_OTP} (user_id, otp_code, expires_at, attempts)
    VALUES ($1, $2, $3, 0)
    ON CONFLICT (user_id)
    DO UPDATE SET
      otp_code = EXCLUDED.otp_code,
      expires_at = EXCLUDED.expires_at,
      attempts = 0,
      created_at = NOW();
  `;
  return t.none(query, [user_id, otp, otpExpiry]);
};

/**
 * Clears an OTP after successful use or expiry.
 */
const clearUserOtp = async (user_id, t) => {
  return t.none(`DELETE FROM ${T_OTP} WHERE user_id = $1`, [user_id]);
};

/**
 * Updates the user's last login timestamp.
 */
const updateLastLogin = async (user_id, t) => {
  return t.none(`UPDATE ${T_USERS} SET last_login = NOW() WHERE user_id = $1`, [
    user_id,
  ]);
};

/**
 * Sets is_verified to TRUE for a user (Used for registration completion).
 */
const verifyUser = async (user_id, t) => {
  return t.none(
    `UPDATE ${T_USERS} SET is_verified = TRUE, updated_at = NOW() WHERE user_id = $1`,
    [user_id]
  );
};

/**
 * Updates the user's password and clears the OTP (Used for Forgot Password Step 2).
 */
const updatePasswordAndClearOtp = async (user_id, newHashedPassword, t) => {
  // CRITICAL: Ensure this is wrapped in db.tx by the service layer
  await t.none(
    `UPDATE ${T_USERS} SET password_hash = $1, updated_at = NOW() WHERE user_id = $2`,
    [newHashedPassword, user_id]
  );
  await t.none(`DELETE FROM ${T_OTP} WHERE user_id = $1`, [user_id]);
};

// ----------------------------------------------------
// ✅ NEW STATEFUL SESSION MANAGEMENT FUNCTIONS
// ----------------------------------------------------

/**
 * Creates a new session/refresh token entry (Mandatory db.tx for CUD).
 */
const createSession = async (user_id, refreshToken, expiresAt, t) => {
  const query = `
    INSERT INTO ${T_SESSIONS} (user_id, refresh_token, expires_at)
    VALUES ($1, $2, $3)
    RETURNING session_id, refresh_token, expires_at;
  `;
  return t.one(query, [user_id, refreshToken, expiresAt]);
};

/**
 * Deletes a session/refresh token (Mandatory db.tx for CUD).
 */
const deleteSessionByToken = async (refreshToken, t) => {
  // Returns rowCount (0 or 1)
  const result = await t.result(
    `DELETE FROM ${T_SESSIONS} WHERE refresh_token = $1`,
    [refreshToken],
    (r) => r.rowCount
  );
  return result > 0; // Return true if deleted, false if not found
};

module.exports = {
  findUserByEmail,
  findUserById,
  createUser,
  updateUserOtp,
  clearUserOtp,
  updateLastLogin,
  verifyUser,
  updatePasswordAndClearOtp,
  createSession, // ✅ NEW
  deleteSessionByToken, // ✅ NEW
  // Note: findUserByName, findSafeUserById/Email are omitted for brevity but should be in the real file.
};
