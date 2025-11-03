// File: src/modules/auth/userAuth/userAuth.model.js

// IMPORTANT: The `db` object here is typically a dependency injection or a shared module.
// In a proper structure, this should be imported from the DB connection file.
const { db } = require("../../../database/db"); // Assuming db instance is exported from here

const userQueries = {
  // Basic SELECT by email
  findUserByEmail: `
        SELECT user_id, email, password, full_name, role_id, otp_code, otp_expiry
        FROM users.user_auth
        WHERE email = $1 AND is_active = TRUE;
    `,
  // Basic SELECT by ID
  findUserById: `
        SELECT au.user_id, au.email, au.password, au.full_name, au.role_id, au.otp_code, au.otp_expiry, r.role_name
        FROM users.user_auth au
        JOIN masters.roles r ON au.role_id = r.role_id
        WHERE au.user_id = $1 AND au.is_active = TRUE;
    `,
  // INSERT for new user
  createUser: `
        INSERT INTO users.user_auth (email, password, full_name, role_id, created_by_user_id)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING user_id, email, full_name, role_id;
    `,
  // UPDATE for OTP
  updateUserOtp: `
        UPDATE users.user_auth
        SET otp_code = $2, otp_expiry = $3, updated_at = NOW(), updated_by_user_id = $1
        WHERE user_id = $1
        RETURNING user_id;
    `,
  // CLEAR OTP
  clearUserOtp: `
        UPDATE users.user_auth
        SET otp_code = NULL, otp_expiry = NULL, updated_at = NOW(), updated_by_user_id = $1
        WHERE user_id = $1
        RETURNING user_id;
    `,
  // UPDATE Password and clear OTP
  updatePasswordAndClearOtp: `
        UPDATE users.user_auth
        SET password = $2, otp_code = NULL, otp_expiry = NULL, updated_at = NOW(), updated_by_user_id = $1
        WHERE user_id = $1
        RETURNING user_id;
    `,
  // Update Last Login
  updateLastLogin: `
        UPDATE users.user_auth
        SET last_login_at = NOW()
        WHERE user_id = $1;
    `,
  // Select all administrators for critical emails
  findAdminEmails: `
        SELECT email
        FROM users.user_auth
        WHERE role_id IN (
            SELECT role_id FROM masters.roles WHERE role_name IN ('SuperAdmin', 'Admin')
        ) AND is_active = TRUE;
    `,
};

class UserAuthModel {
  /**
   * Executes a `oneOrNone` query to find a user by email.
   * @param {string} email
   * @param {object} [executor=db] - pg-promise instance or transaction object (t)
   */
  static async findUserByEmail(email, executor = db) {
    return executor.oneOrNone(userQueries.findUserByEmail, [email]);
  }

  /**
   * Executes a `oneOrNone` query to find a user by ID.
   * @param {number} userId
   * @param {object} [executor=db] - pg-promise instance or transaction object (t)
   */
  static async findUserById(userId, executor = db) {
    return executor.oneOrNone(userQueries.findUserById, [userId]);
  }

  /**
   * Executes an `one` query to create a new user.
   * @param {object} data - { email, password, full_name, role_id, created_by_user_id }
   * @param {object} t - Transaction object (db.tx)
   */
  static async createUser(data, t) {
    const { email, password, full_name, role_id, created_by_user_id } = data;
    return t.one(userQueries.createUser, [
      email,
      password,
      full_name,
      role_id,
      created_by_user_id,
    ]);
  }

  /**
   * Executes a query to update OTP and expiry.
   * @param {number} userId
   * @param {string} otp
   * @param {Date} otpExpiry
   * @param {object} t - Transaction object (db.tx)
   */
  static async updateUserOtp(userId, otp, otpExpiry, t) {
    return t.one(userQueries.updateUserOtp, [userId, otp, otpExpiry]);
  }

  /**
   * Executes a query to clear OTP.
   * @param {number} userId
   * @param {object} t - Transaction object (db.tx)
   */
  static async clearUserOtp(userId, t) {
    return t.none(userQueries.clearUserOtp, [userId]);
  }

  /**
   * Executes a query to update password and clear OTP.
   * @param {number} userId
   * @param {string} newHashedPassword
   * @param {object} t - Transaction object (db.tx)
   */
  static async updatePasswordAndClearOtp(userId, newHashedPassword, t) {
    return t.none(userQueries.updatePasswordAndClearOtp, [
      userId,
      newHashedPassword,
    ]);
  }

  /**
   * Executes a query to update last login timestamp.
   * @param {number} userId
   * @param {object} t - Transaction object (db.tx)
   */
  static async updateLastLogin(userId, t) {
    return t.none(userQueries.updateLastLogin, [userId]);
  }

  /**
   * Executes a query to find all Admin and SuperAdmin emails.
   * @param {object} [executor=db] - pg-promise instance or transaction object (t)
   */
  static async findAdminEmails(executor = db) {
    return executor.map(userQueries.findAdminEmails, [], (row) => row.email);
  }
}

module.exports = UserAuthModel;
