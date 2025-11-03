// File: src/modules/auth/userAuth/userAuth.service.js

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { db } = require("../../../database/db"); // Assuming db instance is exported from here
const UserAuthModel = require("./userAuth.model");
const CustomError = require("../../../utils/errorHandler");
const emailSender = require("../../../utils/emailSender");

// Constants
const JWT_SECRET =
  process.env.JWT_SECRET || "your_secret_key_change_in_production";
const JWT_EXPIRES_IN = "1d";
const OTP_EXPIRY_MINUTES = 10;
const SALT_ROUNDS = 10;

// Helper to generate a 6-digit OTP
const generateOTP = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

const generateToken = (payload) => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

class UserAuthService {
  /**
   * User registration (CUD operation, requires db.tx)
   * @param {object} userData - User registration data
   * @returns {object} - Newly created user details (excluding password/sensitive info)
   */
  static async registerUser(userData) {
    const { email, password, full_name, role_id } = userData;

    return await db.tx("register-user-transaction", async (t) => {
      // 1. Check if user already exists
      const existingUser = await UserAuthModel.findUserByEmail(email, t);
      if (existingUser) {
        throw new CustomError("User already exists.", 409);
      }

      // 2. Hash Password
      const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

      // 3. Create User in DB
      const newUser = await UserAuthModel.createUser(
        {
          email,
          password: hashedPassword,
          full_name,
          role_id,
          created_by_user_id: 1, // Assuming a system/admin user for creation context
        },
        t
      );

      // 4. Send Welcome Email (Non-critical notification)
      const emailOptions = {
        to: newUser.email,
        subject: "Welcome to Sidhant API v2!",
        text: `Welcome, ${newUser.full_name}. Your account has been successfully registered.`,
        isCritical: false,
      };
      await emailSender.sendEmail(emailOptions);

      return {
        user_id: newUser.user_id,
        email: newUser.email,
        full_name: newUser.full_name,
        role_id: newUser.role_id,
      };
    });
  }

  /**
   * Step 1 of Login (Password check and OTP send - Transactional for OTP update)
   * @param {string} email
   * @param {string} password
   * @returns {object} - Status message and user ID (no token yet)
   */
  static async loginStep1_passwordCheck_OTPsend(email, password) {
    // Use db.tx to ensure OTP update is atomic with any future transaction logic
    return await db.tx("login-step1-transaction", async (t) => {
      // 1. Find User
      const user = await UserAuthModel.findUserByEmail(email, t);

      // SECURITY: Generic error message to prevent user enumeration
      if (!user) {
        // Log the failed attempt, but return generic error
        console.warn(`Login attempt for non-existent user: ${email}`);
        throw new CustomError("Invalid credentials.", 401);
      }

      // 2. Compare Password
      const isMatch = await bcrypt.compare(password, user.password);

      // SECURITY: Generic error message
      if (!isMatch) {
        // Log the failed attempt, but return generic error
        console.warn(`Password mismatch for user: ${email}`);
        throw new CustomError("Invalid credentials.", 401);
      }

      // 3. Generate and Save OTP
      const otp = generateOTP();
      const otpExpiry = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60000); // 10 minutes from now

      await UserAuthModel.updateUserOtp(user.user_id, otp, otpExpiry, t);

      // 4. Send OTP Email
      const emailOptions = {
        to: user.email,
        subject: "Sidhant API v2: Your Login Verification Code",
        text: `Your One-Time Password (OTP) is: ${otp}. It is valid for ${OTP_EXPIRY_MINUTES} minutes.`,
        isCritical: false,
      };
      await emailSender.sendEmail(emailOptions);

      // Return user_id to be used in step 2 (OTP verification)
      return {
        user_id: user.user_id,
        message: `OTP sent to ${user.email}. Please complete Step 2.`,
      };
    });
  }

  /**
   * Step 2 of Login (OTP verification and JWT generation - Transactional for OTP clearance)
   * @param {number} user_id
   * @param {string} otp
   * @returns {object} - JWT Token and user details
   */
  static async loginStep2_OTPverify_tokenGenerate(user_id, otp) {
    // Use db.tx to ensure OTP clearance is atomic
    return await db.tx("login-step2-transaction", async (t) => {
      // 1. Fetch user data (including saved OTP and expiry)
      const user = await UserAuthModel.findUserById(user_id, t);

      if (!user) {
        throw new CustomError("User not found.", 404);
      }

      // 2. Check OTP and Expiry
      if (!user.otp_code || user.otp_code !== otp) {
        throw new CustomError("Invalid OTP.", 401);
      }

      if (user.otp_expiry < new Date()) {
        // Clear OTP after expiry check (optional: for cleanup)
        await UserAuthModel.clearUserOtp(user.user_id, t);
        throw new CustomError(
          "OTP expired. Please restart the login process.",
          401
        );
      }

      // 3. Clear OTP after successful verification (CRITICAL transaction part)
      await UserAuthModel.clearUserOtp(user.user_id, t);

      // 4. Generate JWT Token
      const tokenPayload = {
        user_id: user.user_id,
        email: user.email,
        role_id: user.role_id,
        role_name: user.role_name, // Assuming model fetches role_name
      };
      const token = generateToken(tokenPayload);

      // 5. Update last_login (non-critical, but good practice in the same transaction)
      await UserAuthModel.updateLastLogin(user.user_id, t);

      return {
        token,
        user: tokenPayload,
        message: "Login successful. JWT token generated.",
      };
    });
  }

  /**
   * Logout - Clear client-side token (implicitly handled by client) and perform server-side cleanup (e.g., token invalidation or session management if used).
   * Since we are using stateless JWT, server-side logout typically involves blacklisting the token or simply returning success.
   * For a simple implementation, we'll just acknowledge the request. If using refresh tokens, this is where it would be blacklisted.
   * @param {object} authPayload - Decoded JWT payload from the `auth` middleware (not used for logic here, but included for completeness).
   * @returns {object} - Success message.
   */
  static async logout(authPayload) {
    // In a true high-security system, this would:
    // 1. Blacklist the current JWT (e.g., in Redis)
    // 2. Revoke the associated Refresh Token
    // For this architecture, we simulate token revocation by logging.
    console.log(
      `User ID ${authPayload.user_id} logged out. Token needs to be invalidated by client or blacklisted server-side.`
    );

    return {
      message: "Logout successful. Please ensure client-side token deletion.",
    };
  }

  /**
   * Step 1 of Forgot Password (Send Reset OTP - Transactional for OTP update)
   * @param {string} email
   * @returns {object} - Status message.
   */
  static async forgotPassword_sendOTP(email) {
    return await db.tx("forgot-password-step1-transaction", async (t) => {
      const user = await UserAuthModel.findUserByEmail(email, t);

      // SECURITY: Generic error message to prevent user enumeration
      if (!user) {
        console.warn(`Forgot Password attempt for non-existent user: ${email}`);
        // Return success message even if user doesn't exist to prevent enumeration
        return {
          message:
            "If a matching account was found, a password reset code has been sent to the email.",
        };
      }

      // Generate and Save OTP
      const otp = generateOTP();
      const otpExpiry = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60000);

      await UserAuthModel.updateUserOtp(user.user_id, otp, otpExpiry, t);

      // Send OTP Email (Non-critical notification)
      const emailOptions = {
        to: user.email,
        subject: "Sidhant API v2: Password Reset Verification Code",
        text: `Your Password Reset Code is: ${otp}. It is valid for ${OTP_EXPIRY_MINUTES} minutes.`,
        isCritical: false,
      };
      await emailSender.sendEmail(emailOptions);

      return {
        message:
          "If a matching account was found, a password reset code has been sent to the email.",
      };
    });
  }

  /**
   * Step 2 of Forgot Password (OTP Verification and Password Reset - Transactional)
   * @param {string} email
   * @param {string} otp
   * @param {string} newPassword
   * @returns {object} - Success message.
   */
  static async resetPassword_verifyOTP_updatePassword(email, otp, newPassword) {
    return await db.tx("reset-password-step2-transaction", async (t) => {
      const user = await UserAuthModel.findUserByEmail(email, t);

      if (!user) {
        throw new CustomError("Invalid request details.", 400); // Generic error
      }

      // 1. Check OTP and Expiry
      if (!user.otp_code || user.otp_code !== otp) {
        throw new CustomError("Invalid or expired reset code.", 401);
      }

      if (user.otp_expiry < new Date()) {
        await UserAuthModel.clearUserOtp(user.user_id, t);
        throw new CustomError(
          "Reset code expired. Please restart the forgot password process.",
          401
        );
      }

      // 2. Hash new password
      const newHashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);

      // 3. Update password and clear OTP (CRITICAL transaction part)
      await UserAuthModel.updatePasswordAndClearOtp(
        user.user_id,
        newHashedPassword,
        t
      );

      // 4. Send Admin Critical Notification
      const adminEmailOptions = {
        to: "admin_list_lookup_is_internal",
        subject: "CRITICAL: User Password Reset",
        text: `User ${
          user.email
        } successfully reset their password at ${new Date().toISOString()}.`,
        isCritical: true, // Critical flag triggers admin lookup and special handling
      };
      await emailSender.sendEmail(adminEmailOptions);

      return { message: "Password successfully reset." };
    });
  }
}

module.exports = UserAuthService;
