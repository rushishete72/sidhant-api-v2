// File: src/modules/auth/userAuth/userAuth.model.js
// FIXED: Table/Column names, parameter synchronization, and implemented atomic UPSERT for OTP.

const { db } = require("../../../database/db");

const userQueries = {
  // 🎯 FIX: Table changed to master_users. password -> password_hash. OTP columns fetched from user_otp via LEFT JOIN.
  findUserByEmail: `
        SELECT 
            mu.user_id, mu.email, mu.password_hash, mu.full_name, mu.role_id, mu.is_verified,
            uo.otp_code, uo.expires_at AS otp_expiry
        FROM master_users mu
        LEFT JOIN user_otp uo ON mu.user_id = uo.user_id
        WHERE mu.email = $1 AND mu.is_active = TRUE;
    `,
  // 🎯 FIX: Table changed to master_users and master_roles. OTP joined from user_otp.
  findUserById: `
        SELECT 
            mu.user_id, mu.email, mu.password_hash, mu.full_name, mu.role_id, mu.is_verified,
            mr.role_name, 
            uo.otp_code, uo.expires_at AS otp_expiry
        FROM master_users mu
        JOIN master_roles mr ON mu.role_id = mr.role_id
        LEFT JOIN user_otp uo ON mu.user_id = uo.user_id
        WHERE mu.user_id = $1 AND mu.is_active = TRUE;
    `,
  // 🎯 CRITICAL FIX: This query explicitly uses only 4 placeholders ($1 - $4)
  createUser: `
        INSERT INTO master_users (email, password_hash, full_name, role_id)
        VALUES ($1, $2, $3, $4) 
        RETURNING user_id, email, full_name, role_id;
    `,
  // 🎯 CRITICAL FIX: Uses user_otp table with INSERT ON CONFLICT UPDATE for atomic OTP creation/update.
  updateUserOtp: `
        INSERT INTO user_otp (user_id, otp_code, expires_at, attempts)
        VALUES ($1, $2, $3, 1) 
        ON CONFLICT (user_id) DO UPDATE
        SET 
            otp_code = EXCLUDED.otp_code, 
            expires_at = EXCLUDED.expires_at,
            attempts = user_otp.attempts + 1, 
            created_at = NOW()
        RETURNING user_id;
    `,
  // 🎯 FIX: Uses DELETE on the separate user_otp table for clean-up.
  clearUserOtp: `
        DELETE FROM user_otp
        WHERE user_id = $1
        RETURNING user_id;
    `,
  // 🎯 FIX: Renamed query and updated table/column to only update password_hash on master_users table.
  updatePassword: `
        UPDATE master_users
        SET password_hash = $2, updated_at = NOW()
        WHERE user_id = $1
        RETURNING user_id;
    `,
  // 🎯 FIX: Table changed to master_users. last_login_at -> last_login.
  updateLastLogin: `
        UPDATE master_users
        SET last_login = NOW()
        WHERE user_id = $1;
    `,
  // 🎯 FIX: Table changed to master_users and master_roles.
  findAdminEmails: `
        SELECT email
        FROM master_users
        WHERE role_id IN (
            SELECT role_id FROM master_roles WHERE role_name IN ('SuperAdmin', 'Admin')
        ) AND is_active = TRUE;
    `,
};

class UserAuthModel {
  /**
   * Executes a `oneOrNone` query to find a user by email.
   */
  static async findUserByEmail(email, executor = db) {
    return executor.oneOrNone(userQueries.findUserByEmail, [email]);
  }

  /**
   * Executes a `oneOrNone` query to find a user by ID.
   */
  static async findUserById(userId, executor = db) {
    return executor.oneOrNone(userQueries.findUserById, [userId]);
  }

  /**
   * Executes an `one` query to create a new user.
   */
  static async createUser(data, t) {
    const { email, password_hash, full_name, role_id } = data;
    return t.one(userQueries.createUser, [
      email,
      password_hash,
      full_name,
      role_id,
    ]);
  }

  /**
   * Executes a query to update/insert OTP and expiry using UPSERT.
   */
  static async updateUserOtp(userId, otp, otpExpiry, t) {
    return t.one(userQueries.updateUserOtp, [userId, otp, otpExpiry]);
  }

  /**
   * Executes a query to clear OTP by deleting the record.
   */
  static async clearUserOtp(userId, t) {
    return t.one(userQueries.clearUserOtp, [userId]);
  }

  /**
   * Executes a query to update only the password_hash.
   */
  static async updatePassword(userId, newHashedPassword, t) {
    return t.none(userQueries.updatePassword, [userId, newHashedPassword]);
  }

  /**
   * Executes a query to update last login timestamp.
   */
  static async updateLastLogin(userId, executor = db) {
    return executor.none(userQueries.updateLastLogin, [userId]);
  }

  /**
   * Executes a query to find all Admin and SuperAdmin emails.
   */
  static async findAdminEmails(executor = db) {
    return executor.map(userQueries.findAdminEmails, [], (row) => row.email);
  }
}

module.exports = UserAuthModel;
