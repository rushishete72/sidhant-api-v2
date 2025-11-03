/**
 * src/modules/auth/userAuth/userAuth.model.js - Final Model Layer (Zero-Defect)
 * MANDATES: Pure SQL, uses 't' object, and syncs OTP column name: otp_code.
 */

const { db } = require("../../../../src/database/db");
const { APIError } = require("../../../utils/errorHandler");
const bcrypt = require("bcryptjs");

// --- Table Constants ---
const USER_TABLE = "master_users";
const ROLE_TABLE = "master_roles";
const OTP_TABLE = "user_otp";

// =========================================================================
// CUD Transaction Functions
// =========================================================================

/** 1. सुनिश्चित करता है कि रोल मौजूद है और उसका ID लौटाता है। */
const getOrCreateRole = async (t, roleName) => {
  await t.none(
    `INSERT INTO ${ROLE_TABLE} (role_name) VALUES ($1) ON CONFLICT (role_name) DO NOTHING`,
    [roleName]
  );
  return t.one(`SELECT role_id FROM ${ROLE_TABLE} WHERE role_name = $1`, [
    roleName,
  ]);
};

/** 2. नया यूजर बनाता है। */
const createUser = async (t, { email, full_name, role_id, password_hash }) => {
  const query = `
        INSERT INTO ${USER_TABLE} (email, full_name, role_id, password_hash, is_active, is_verified, created_at)
        VALUES ($1, $2, $3, $4, TRUE, FALSE, NOW())
        RETURNING user_id, email, full_name, role_id, is_active, is_verified
    `;
  return t.one(query, [email.trim(), full_name.trim(), role_id, password_hash]);
};

/** 3. OTP रिकॉर्ड बनाता है या अपडेट करता है। (FINAL FIX: uses otp_code) */
const createOtp = async (t, { user_id, otp_code, expires_at }) => {
  const context = t || db;
  const query = `
        INSERT INTO ${OTP_TABLE} (user_id, otp_code, expires_at, attempts) 
        VALUES ($1, $2, $3, 0)
        ON CONFLICT (user_id) DO UPDATE
        SET otp_code = EXCLUDED.otp_code, expires_at = EXCLUDED.expires_at, attempts = 0
        RETURNING *
    `;
  return context.one(query, [user_id, otp_code, expires_at]);
};

/** 4. पासवर्ड को HASH करता है और DB में अपडेट करता है। */
const updateUserPassword = async (t, user_id, newPassword) => {
  const context = t || db;
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(newPassword, salt);

  const query = `
        UPDATE ${USER_TABLE} SET password_hash = $2, updated_at = NOW() 
        WHERE user_id = $1
    `;
  const result = await context.result(query, [user_id, passwordHash]);

  if (result.rowCount === 0) {
    throw new APIError("User not found or no changes made to password.", 404);
  }
};

/** 5. यूजर के is_verified स्टेटस को अपडेट करता है। */
const updateUserVerificationStatus = async (t, user_id, status) => {
  const context = t || db;
  const result = await context.result(
    `
        UPDATE ${USER_TABLE} SET is_verified = $2, updated_at = NOW() 
        WHERE user_id = $1
    `,
    [user_id, status]
  );

  if (result.rowCount === 0) {
    throw new APIError("User not found during status update.", 404);
  }
};

/** 6. OTP रो को डिलीट करें। */
const deleteOtp = async (t, user_id) => {
  const context = t || db;
  return context.none(`DELETE FROM ${OTP_TABLE} WHERE user_id = $1`, [user_id]);
};

// =========================================================================
// Read/Fetch Functions
// =========================================================================

/** 7. ईमेल द्वारा यूजर को Fetch करता है। */
const getUserByEmail = async (t, email) => {
  const context = t || db;
  const query = `
        SELECT user_id, email, full_name, role_id, password_hash, is_active, is_verified
        FROM ${USER_TABLE} 
        WHERE email = $1
    `;
  return context.oneOrNone(query, [email.trim()]);
};

/** 8. यूजर ID द्वारा OTP रिकॉर्ड Fetch करता है। (FINAL FIX: SELECT otp_code AS otp_hash) */
const getOtpByUserId = async (t, user_id) => {
  const context = t || db;
  const query = `
        SELECT user_id, otp_code AS otp_hash, expires_at, attempts
        FROM ${OTP_TABLE}
        WHERE user_id = $1
    `;
  // AS otp_hash का उपयोग Service Layer के bcrypt.compare() के साथ संगतता के लिए किया जाता है।
  return context.oneOrNone(query, [user_id]);
};

/** 9. यूजर ID द्वारा पूरा प्रोफाइल डेटा (रोल और परमिशन के साथ) Fetch करता है। */
const getUserProfileData = async (t, user_id) => {
  const context = t || db;
  const query = `
        SELECT 
            u.user_id, u.email, u.full_name, r.role_name AS role, 
            u.is_verified, u.is_active,
            COALESCE(r.permissions, '{}') AS permissions
        FROM ${USER_TABLE} u
        JOIN ${ROLE_TABLE} r ON u.role_id = r.role_id
        WHERE u.user_id = $1 AND u.is_active = TRUE
    `;
  return context.oneOrNone(query, [user_id]);
};

module.exports = {
  getOrCreateRole,
  createUser,
  createOtp,
  updateUserVerificationStatus,
  updateUserPassword,
  deleteOtp,
  getUserByEmail,
  getOtpByUserId,
  getUserProfileData,
};
