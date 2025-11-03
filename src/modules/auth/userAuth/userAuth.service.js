// File: src/modules/auth/userAuth/userAuth.service.js
// FIXED: Hardcoded default role_id (2) for security.

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { db } = require("../../../database/db");
const UserAuthModel = require("./userAuth.model");
const CustomError = require("../../../utils/errorHandler");
const emailSender = require("../../../utils/emailSender"); // Assuming emailSender utility exists

// CRITICAL SECURITY FIX:
// Define a default role ID for self-registration.
// Based on '09_Initial_Master_Data.sql', 'Standard User' is Role ID 2.
const DEFAULT_USER_ROLE_ID = 2;

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
   * @param {object} userData - User registration data (now only email, password, full_name)
   * @returns {object} - Newly created user details
   */
  static async registerUser(userData) {
    // FIX: role_id is no longer taken from input
    const { email, password, full_name } = userData;

    // SECURITY FIX: Assign the default role ID here, not from user input.
    const role_id = DEFAULT_USER_ROLE_ID;

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
          role_id, // Use the hardcoded default role
          created_by_user_id: 1, // Assuming 1 is 'SYSTEM' or 'Self'
        },
        t
      );

      // 4. Send Welcome Email (Non-critical)
      // const emailOptions = {
      //     to: newUser.email,
      //     subject: 'Welcome to Sidhant API v2!',
      //     text: `Welcome, ${newUser.full_name}. Your account has been successfully registered.`,
      //     isCritical: false
      // };
      // await emailSender.sendEmail(emailOptions); // Uncomment when emailSender is configured

      return {
        user_id: newUser.user_id,
        email: newUser.email,
        full_name: newUser.full_name,
        role_id: newUser.role_id, // Return the assigned role_id
      };
    });
  }

  /**
   * Step 1 of Login (Password check and OTP send)
   * @param {string} email
   * @param {string} password
   * @returns {object} - Status message and user ID
   */
  static async loginStep1_passwordCheck_OTPsend(email, password) {
    return await db.tx("login-step1-transaction", async (t) => {
      const user = await UserAuthModel.findUserByEmail(email, t);

      if (!user) {
        // SECURITY: Generic error message to prevent user enumeration
        throw new CustomError("Invalid credentials.", 401);
      }

      const isMatch = await bcrypt.compare(password, user.password);

      if (!isMatch) {
        throw new CustomError("Invalid credentials.", 401);
      }

      const otp = generateOTP();
      const otpExpiry = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60000);

      await UserAuthModel.updateUserOtp(user.user_id, otp, otpExpiry, t);

      // 4. Send OTP Email
      // const emailOptions = {
      //     to: user.email,
      //     subject: 'Sidhant API v2: Your Login Verification Code',
      //     text: `Your One-Time Password (OTP) is: ${otp}. It is valid for ${OTP_EXPIRY_MINUTES} minutes.`,
      //     isCritical: false
      // };
      // await emailSender.sendEmail(emailOptions); // Uncomment when emailSender is configured
      console.log(
        `[Auth Service] OTP for ${user.email} (User ID ${user.user_id}): ${otp}`
      );

      return {
        user_id: user.user_id,
        message: `OTP sent to ${user.email}. Please complete Step 2.`,
      };
    });
  }

  /**
   * Step 2 of Login (OTP verification and JWT generation)
   * @param {number} user_id
   * @param {string} otp
   * @returns {object} - JWT Token and user details
   */
  static async loginStep2_OTPverify_tokenGenerate(user_id, otp) {
    return await db.tx("login-step2-transaction", async (t) => {
      const user = await UserAuthModel.findUserById(user_id, t);

      if (!user) {
        throw new CustomError("User not found.", 404);
      }

      if (!user.otp_code || user.otp_code !== otp) {
        throw new CustomError("Invalid OTP.", 401);
      }

      if (user.otp_expiry < new Date()) {
        await UserAuthModel.clearUserOtp(user.user_id, t);
        throw new CustomError(
          "OTP expired. Please restart the login process.",
          401
        );
      }

      await UserAuthModel.clearUserOtp(user.user_id, t);

      const tokenPayload = {
        user_id: user.user_id,
        email: user.email,
        role_id: user.role_id,
        role_name: user.role_name,
      };
      const token = generateToken(tokenPayload);

      await UserAuthModel.updateLastLogin(user.user_id, t);

      return {
        token,
        user: tokenPayload,
        message: "Login successful. JWT token generated.",
      };
    });
  }

  /**
   * Logout
   */
  static async logout(authPayload) {
    console.log(`User ID ${authPayload.user_id} logged out.`);
    return { message: "Logout successful." };
  }

  /**
   * Step 1 of Forgot Password (Send Reset OTP)
   */
  static async forgotPassword_sendOTP(email) {
    return await db.tx("forgot-password-step1-transaction", async (t) => {
      const user = await UserAuthModel.findUserByEmail(email, t);

      if (!user) {
        return {
          message:
            "If a matching account was found, a password reset code has been sent.",
        };
      }

      const otp = generateOTP();
      const otpExpiry = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60000);

      await UserAuthModel.updateUserOtp(user.user_id, otp, otpExpiry, t);

      // Send OTP Email
      // const emailOptions = { ... };
      // await emailSender.sendEmail(emailOptions); // Uncomment when emailSender is configured
      console.log(
        `[Auth Service] Forgot Password OTP for ${user.email}: ${otp}`
      );

      return {
        message:
          "If a matching account was found, a password reset code has been sent.",
      };
    });
  }

  /**
   * Step 2 of Forgot Password (OTP Verification and Password Reset)
   */
  static async resetPassword_verifyOTP_updatePassword(email, otp, newPassword) {
    return await db.tx("reset-password-step2-transaction", async (t) => {
      const user = await UserAuthModel.findUserByEmail(email, t);

      if (!user) {
        throw new CustomError("Invalid request details.", 400);
      }

      if (!user.otp_code || user.otp_code !== otp) {
        throw new CustomError("Invalid or expired reset code.", 401);
      }

      if (user.otp_expiry < new Date()) {
        await UserAuthModel.clearUserOtp(user.user_id, t);
        throw new CustomError("Reset code expired.", 401);
      }

      const newHashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);

      await UserAuthModel.updatePasswordAndClearOtp(
        user.user_id,
        newHashedPassword,
        t
      );

      // 4. Send Admin Critical Notification (Optional)
      // const adminEmailOptions = { ... isCritical: true };
      // await emailSender.sendEmail(adminEmailOptions);

      return { message: "Password successfully reset." };
    });
  }
}

module.exports = UserAuthService;
