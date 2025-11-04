/*
 * userAuth.model.js
 * Absolute Accountability: CRITICAL FIX. Class export ko hata kar plain object export kiya gaya hai.
 * Yeh circular dependency loop ko definitively break karega, jisse router crash theek ho jayega.
 * Static methods ko ab simple exported functions ke roop mein define kiya gaya hai.
 */

const { db, pgp } = require("../../../database/db");
const CustomError = require("../../../utils/errorHandler");

// Tables based on 01_Security_Base.sql
const T_USERS = "master_users";
const T_ROLES = "master_roles";
const T_OTP = "user_otp";

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
    JOIN ${T_ROLES} r ON u.role_id = r.role_id
    LEFT JOIN ${T_OTP} otp ON u.user_id = otp.user_id
    WHERE u.email = $1;
  `;
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
    JOIN ${T_ROLES} r ON u.role_id = r.role_id
    LEFT JOIN ${T_OTP} otp ON u.user_id = otp.user_id
    WHERE u.user_id = $1;
  `;
  return t.oneOrNone(query, [user_id]);
};

/**
 * (NEW) Finds a user by full name (case-insensitive search).
 */
const findUserByName = async (name, dbOrT = db) => {
  const query = `
    SELECT user_id, email, full_name, role_id, is_active
    FROM ${T_USERS}
    WHERE full_name ILIKE $1;
  `;
  return dbOrT.any(query, [`%${name}%`]);
};

/**
 * Creates a new user during registration.
 */
const createUser = async (userData, t) => {
  const columns = new pgp.helpers.ColumnSet(
    ["email", "password_hash", "full_name", "role_id", "is_verified"],
    { table: T_USERS }
  );
  const data = { ...userData, is_verified: false };
  const query =
    pgp.helpers.insert(data, columns) +
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
 * Updates the user's password hash.
 */
const updatePassword = async (user_id, newHashedPassword, t) => {
  // FIX: Parameter ordering fixed for the update statement in the original model
  return t.none(
    `UPDATE ${T_USERS} SET password_hash = $1, updated_at = NOW() WHERE user_id = $2`,
    [newHashedPassword, user_id]
  );
};

/**
 * (NEW) Fetches a user by ID *without* sensitive data.
 */
const findSafeUserById = async (user_id, dbOrT = db) => {
  const query = `
    SELECT 
      u.user_id, u.email, u.full_name, u.role_id,
      u.is_active, u.is_verified,
      r.role_name
    FROM ${T_USERS} u
    JOIN ${T_ROLES} r ON u.role_id = r.role_id
    WHERE u.user_id = $1;
  `;
  return dbOrT.oneOrNone(query, [user_id]);
};

/**
 * (NEW) Fetches a user by email *without* sensitive data.
 */
const findSafeUserByEmail = async (email, dbOrT = db) => {
  const query = `
    SELECT 
      u.user_id, u.email, u.full_name, u.role_id,
      u.is_active, u.is_verified,
      r.role_name
    FROM ${T_USERS} u
    JOIN ${T_ROLES} r ON u.role_id = r.role_id
    WHERE u.email = $1;
  `;
  return dbOrT.oneOrNone(query, [email]);
};

module.exports = {
  findUserByEmail,
  findUserById,
  findUserByName,
  createUser,
  updateUserOtp,
  clearUserOtp,
  updateLastLogin,
  updatePassword,
  findSafeUserById,
  findSafeUserByEmail,
};
