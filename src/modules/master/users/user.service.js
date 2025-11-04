/*
 * File: src/modules/master/users/user.service.js
 * Module: Admin User Management (Business Logic)
 * Absolute Accountability: Ensures all CUD operations are transactional (db.tx).
 */

const { db } = require("../../../database/db");
const UserModel = require("./user.model");
const CustomError = require("../../../utils/errorHandler");
const bcrypt = require("bcryptjs");
const SALT_ROUNDS = 10;

class UserService {
  /**
   * 1. Fetches users list for the admin dashboard (READ operation).
   */
  static async fetchAllUsers(filters) {
    return UserModel.getAllUsers(filters);
  }

  /**
   * 2. Gets a single user (READ operation).
   */
  static async fetchUserById(userId) {
    const user = await UserModel.getUserById(userId);
    if (!user) {
      throw new CustomError(`उपयोगकर्ता ID ${userId} नहीं मिला।`, 404);
    }
    delete user.password_hash; // Security: Ensure hash is removed
    return user;
  }

  /**
   * 3. Creates a new user by Admin (CUD - Requires db.tx).
   */
  static async createUserByAdmin(data, creatorId) {
    const { password, ...userData } = data;

    return await db.tx("create-user-admin-transaction", async (t) => {
      // Hash Password
      const salt = await bcrypt.genSalt(SALT_ROUNDS);
      const password_hash = await bcrypt.hash(password, salt);

      const newUser = await UserModel.createUser(
        {
          ...userData,
          password_hash,
          created_by: creatorId,
          is_active: true,
          is_verified: true, // Admin created means verified
        },
        t
      );

      console.log(
        `[Admin] New User ${newUser.email} created by Admin ID ${creatorId}.`
      );
      return newUser;
    });
  }

  /**
   * 4. Updates core user data (Name, Email) (CUD - Requires db.tx).
   */
  static async updateCoreUserDetails(userId, updateData) {
    return await db.tx("update-user-core-transaction", async (t) => {
      const updatedUser = await UserModel.updateUser(userId, updateData, t);

      if (!updatedUser) {
        throw new CustomError(`उपयोगकर्ता ID ${userId} नहीं मिला।`, 404);
      }
      delete updatedUser.password_hash;
      console.log(`[Admin] User ID ${userId} core details updated.`);
      return updatedUser;
    });
  }

  /**
   * 5. Changes user role (CUD - Requires db.tx).
   */
  static async changeUserRole(userId, roleId) {
    return await db.tx("change-user-role-transaction", async (t) => {
      const updatedUser = await UserModel.updateUser(
        userId,
        { role_id: roleId },
        t
      );

      if (!updatedUser) {
        throw new CustomError(`उपयोगकर्ता ID ${userId} नहीं मिला।`, 404);
      }
      delete updatedUser.password_hash;
      console.log(`[Admin] User ID ${userId} role changed to ${roleId}.`);
      return updatedUser;
    });
  }

  /**
   * 6. Resets user password (CUD - Requires db.tx).
   */
  static async resetUserPassword(userId, newPassword) {
    return await db.tx("reset-user-password-transaction", async (t) => {
      const salt = await bcrypt.genSalt(SALT_ROUNDS);
      const password_hash = await bcrypt.hash(newPassword, salt);

      const updatedUser = await UserModel.updateUser(
        userId,
        { password_hash },
        t
      );

      if (!updatedUser) {
        throw new CustomError(`उपयोगकर्ता ID ${userId} नहीं मिला।`, 404);
      }
      console.log(`[Admin] User ID ${userId} password reset by Admin.`);
      return { user_id: updatedUser.user_id, email: updatedUser.email };
    });
  }

  /**
   * 7. Deactivates/Activates user (CUD - Requires db.tx).
   */
  static async updateStatus(userId, isActive) {
    return await db.tx("update-user-status-transaction", async (t) => {
      let updatedUser;
      if (isActive) {
        updatedUser = await UserModel.activateUser(userId, t);
      } else {
        updatedUser = await UserModel.deactivateUser(userId, t);
      }

      if (!updatedUser) {
        const user = await UserModel.getUserById(userId, t);
        if (!user)
          throw new CustomError(`उपयोगकर्ता ID ${userId} नहीं मिला।`, 404);

        throw new CustomError(
          `उपयोगकर्ता पहले से ही ${isActive ? "सक्रिय" : "निष्क्रिय"} है।`,
          400
        );
      }

      console.log(`[Admin] User ID ${userId} status set to ${isActive}.`);
      return updatedUser;
    });
  }
}

module.exports = UserService;
