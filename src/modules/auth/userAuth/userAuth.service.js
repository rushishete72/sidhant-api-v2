// File: src/modules/auth/userAuth/userAuth.service.js
// FINAL VERSION: Includes 2-Step Registration, 2-Step Login, and 2-Step Forgot Password.

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { db } = require("../../../database/db");
const UserAuthModel = require("./userAuth.model");
const CustomError = require("../../../utils/errorHandler");
const emailSender = require("../../../utils/emailSender");

// CRITICAL SECURITY FIX:
const DEFAULT_USER_ROLE_ID = 2; // 'Standard User'
const JWT_SECRET =
  process.env.JWT_SECRET || "your_super_secret_key_for_jwt_signing";
const JWT_EXPIRES_IN = "1d";
const OTP_EXPIRY_MINUTES = 10;
const SALT_ROUNDS = 10;
const ADMIN_EMAIL = process.env.ADMIN_CRITICAL_EMAIL; // Use the admin email from .env

// Helper to generate a 6-digit OTP
const generateOTP = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

const generateToken = (payload) => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

class UserAuthService {
  /**
   * User registration - Step 1: Create user, hash password, and send OTP.
   * CUD operation, requires mandatory db.tx for atomicity.
   */
  static async registerUser_Step1_CreateAndSendOTP(userData) {
    const { email, password, full_name } = userData;
    const role_id = DEFAULT_USER_ROLE_ID;

    return await db.tx("register-user-step1-transaction", async (t) => {
      // 1. Check for existing user (Security First)
      const existingUser = await UserAuthModel.findUserByEmail(email, t);
      if (existingUser) {
        throw new CustomError("User already exists.", 409); // Use 409 Conflict
      }

      // 2. Hash Password (Security First)
      const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

      // 3. Create User in master_users (is_verified: false by default)
      const newUser = await UserAuthModel.createUser(
        {
          email,
          password_hash: hashedPassword, // Match column name
          full_name,
          role_id,
        },
        t
      );

      // 4. Generate and Store OTP (Security/Verification Mandate)
      const otp = generateOTP();
      const otpExpiry = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60000); // 10 minutes expiry

      await UserAuthModel.updateUserOtp(newUser.user_id, otp, otpExpiry, t);

      // 5. Send OTP (REAL EMAIL SEND ACTIVATED)
      console.log(
        `[Auth Service] New Registration OTP for ${newUser.email} (User ID ${newUser.user_id}): ${otp}`
      );
      await emailSender.sendOtp(newUser.email, otp, "registration");

      // 6. Return response with user_id for Step 2
      return {
        user_id: newUser.user_id,
        email: newUser.email,
        full_name: newUser.full_name,
        message: `User created. OTP sent to ${newUser.email}. Please verify to complete registration.`,
      };
    });
  }

  /**
   * User registration - Step 2: Verify OTP and set is_verified = TRUE.
   * CUD operation, requires mandatory db.tx for atomicity.
   */
  static async registerUser_Step2_VerifyOTPAndActivate(user_id, otp) {
    return await db.tx("register-user-step2-transaction", async (t) => {
      const user = await UserAuthModel.findUserById(user_id, t);

      if (!user) {
        throw new CustomError("User not found.", 404);
      }

      if (user.is_verified) {
        throw new CustomError(
          "User is already verified and active. Please proceed to login.",
          409
        );
      }

      // 1. Check OTP and Expiry
      if (!user.otp_code || user.otp_code !== otp) {
        throw new CustomError("Invalid OTP.", 401);
      }

      if (user.otp_expiry < new Date()) {
        await UserAuthModel.clearUserOtp(user.user_id, t);
        throw new CustomError(
          "OTP expired. Please restart the registration process.",
          401
        );
      }

      // 2. Clear OTP and Verify User (Transactional Integrity)
      await UserAuthModel.clearUserOtp(user.user_id, t);
      await UserAuthModel.verifyUser(user.user_id, t); // Set is_verified = TRUE

      // 3. Send Admin Notification (MANDATED FOR ROLE ASSIGNMENT)
      console.log(
        `[Auth Service] Admin Alert: New User ${user.email} Verified. Role Assignment Required.`
      );

      if (ADMIN_EMAIL) {
        const subject = "NEW USER VERIFIED & PENDING ROLE ASSIGNMENT";
        const message = `A new user has successfully verified their account:\n\nUser ID: ${user.user_id}\nEmail: ${user.email}\nName: ${user.full_name}\nStatus: Verified, Role Pending.\n\nPlease log into the Admin panel to review and assign a specific role.`;

        // CRITICAL: Call the new Admin Notification function
        await emailSender.sendAdminNotification(subject, message);
      }

      return {
        user_id: user.user_id,
        email: user.email,
        message:
          "Registration successful. Your account is now verified. You may now login.",
      };
    });
  }

  /**
   * Step 1 of Login (Password check and OTP send)
   */
  static async loginStep1_passwordCheck_OTPsend(email, password) {
    return await db.tx("login-step1-transaction", async (t) => {
      const user = await UserAuthModel.findUserByEmail(email, t);

      if (!user) {
        throw new CustomError("Invalid credentials.", 401);
      }

      // CRITICAL SECURITY CHECK: Account must be verified
      if (!user.is_verified) {
        throw new CustomError(
          "Account is not yet verified. Please complete the registration verification step.",
          403
        );
      }

      const isMatch = await bcrypt.compare(password, user.password_hash);

      if (!isMatch) {
        throw new CustomError("Invalid credentials.", 401);
      }

      const otp = generateOTP();
      const otpExpiry = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60000);

      await UserAuthModel.updateUserOtp(user.user_id, otp, otpExpiry, t);

      console.log(
        `[Auth Service] Login OTP for ${user.email} (User ID ${user.user_id}): ${otp}`
      );

      await emailSender.sendOtp(user.email, otp, "login");

      return {
        user_id: user.user_id,
        message: `OTP sent to ${user.email}. Please complete Step 2.`,
      };
    });
  }

  /**
   * Step 2 of Login (OTP verification and JWT generation)
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

      // CRITICAL SECURITY CHECK: Account must be verified
      if (!user.is_verified) {
        throw new CustomError(
          "Account is not verified. Verification needed to login.",
          403
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
   * Logout (Future use for token/session management)
   */
  static async logout(authPayload) {
    console.log(`User ID ${authPayload.user_id} logged out.`);
    return { message: "Logout successful." };
  }

  /**
   * Step 1 of Forgot Password (Send Reset OTP)
   * **Mandatory db.tx**
   */
  static async forgotPassword_sendOTP(email) {
    return await db.tx("forgot-password-step1-transaction", async (t) => {
      const user = await UserAuthModel.findUserByEmail(email, t);

      if (!user) {
        // SECURITY FIX: Generic message to prevent email enumeration
        return {
          message:
            "If a matching account was found, a password reset code has been sent.",
        };
      }

      const otp = generateOTP();
      const otpExpiry = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60000);

      await UserAuthModel.updateUserOtp(user.user_id, otp, otpExpiry, t);

      // Send OTP Email (ACTIVATE REAL EMAIL SEND)
      console.log(
        `[Auth Service] Forgot Password OTP for ${user.email}: ${otp}`
      );

      await emailSender.sendOtp(user.email, otp, "reset");

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

      return { message: "Password successfully reset." };
    });
  }
}

module.exports = UserAuthService;
