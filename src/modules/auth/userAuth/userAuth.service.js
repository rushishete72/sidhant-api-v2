/**
 * src/modules/auth/userAuth/userAuth.service.js - Final Service Layer
 * MANDATE: Pass HASHED OTP using the correct parameter name 'otp_code'.
 */

const bcrypt = require("bcryptjs");
const { db } = require("../../../../src/database/db");
const { APIError } = require("../../../utils/errorHandler");
const { sendVerificationEmail } = require("../../../utils/emailSender");
const userAuthModel = require("./userAuth.model");

// --- Helper Functions ---

// ✅ FIX: Simple numeric OTP generator (No external dependency)
const generateOtp = () => {
  return Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit number
};

// --- Core Service Functions ---

/** 1. REGISTER USER: Creates user and initial OTP record in a transaction (db.tx). */
async function registerUser({
  email,
  full_name,
  password,
  defaultRoleName = "Client",
}) {
  const saltRounds = Number(process.env.PASSWORD_SALT_ROUNDS) || 10;
  const passwordHash = await bcrypt.hash(password, saltRounds);
  const otpCode = generateOtp();
  const otpHash = await bcrypt.hash(otpCode, saltRounds);
  const otpExpiry = new Date(Date.now() + 5 * 60 * 1000);

  try {
    const { user } = await db.tx(async (t) => {
      const role = await userAuthModel.getOrCreateRole(t, defaultRoleName);

      const newUser = await userAuthModel.createUser(t, {
        email,
        full_name,
        role_id: role.role_id,
        password_hash: passwordHash,
      });

      // ✅ FIX: HASHED OTP को Model में 'otp_code' के रूप में पास करें
      await userAuthModel.createOtp(t, {
        user_id: newUser.user_id,
        otp_code: otpHash, // HASHED VALUE GOES HERE
        expires_at: otpExpiry,
      });

      return { user: newUser };
    });

    await sendVerificationEmail({
      to: user.email,
      name: user.full_name,
      otp: otpCode,
    });

    const profile = await userAuthModel.getUserProfileData(null, user.user_id);
    return { user: profile, otp: otpCode };
  } catch (err) {
    if (err && err.code === "23505") {
      throw new APIError("Registration failed: Email already exists.", 409);
    }
    console.error("Registration error:", err);
    throw new APIError("User registration failed due to a server error.", 500);
  }
}

/** 2. VERIFY OTP: Checks OTP, updates user verification status, and deletes OTP in a transaction. */
async function verifyOtp({ email, otp }) {
  return db.tx(async (t) => {
    const user = await userAuthModel.getUserByEmail(t, email);
    if (!user) {
      throw new APIError("Verification failed: User not found.", 404);
    }

    // Model selects otp_code AS otp_hash, so we can use otp_hash here
    const otpRecord = await userAuthModel.getOtpByUserId(t, user.user_id);
    if (!otpRecord) {
      throw new APIError(
        "Invalid or expired OTP. Please request a new one.",
        401
      );
    }

    const isOtpValid = await bcrypt.compare(otp, otpRecord.otp_hash);
    const isExpired = new Date() > otpRecord.expires_at;

    if (!isOtpValid || isExpired) {
      throw new APIError("Invalid OTP or OTP expired/attempts exceeded.", 401);
    }

    await userAuthModel.updateUserVerificationStatus(t, user.user_id, true);
    await userAuthModel.deleteOtp(t, user.user_id);

    return userAuthModel.getUserProfileData(t, user.user_id);
  });
}

/** 3. LOGIN USER: Authenticates user by password and returns profile data. */
/** 3. LOGIN USER: Authenticates user by password and returns profile data. (FIXED: OTP logic removed) */
async function loginUser({ email, password }) {
  const user = await userAuthModel.getUserByEmail(null, email);
  if (!user || user.is_active === false) {
    throw new APIError("Invalid credentials.", 401);
  }

  // 1. Check if user is verified (Required for login)
  if (user.is_verified === false) {
    throw new APIError("Account not verified. Please verify your OTP.", 403);
  }

  // 2. Compare password hash
  const isMatch = await bcrypt.compare(password, user.password_hash);
  if (!isMatch) {
    throw new APIError("Invalid credentials.", 401);
  }
  // ✅ OTP SENDING LOGIC REMOVED FROM HERE. OTP is only sent during Registration or Forgot Password.

  // 3. Fetch canonical profile (role, permissions)
  const profile = await userAuthModel.getUserProfileData(null, user.user_id);

  return { user: profile, profile };
}

/** 4. FORGOT PASSWORD: Creates a new OTP for password reset. */
async function forgotPassword({ email }) {
  const user = await userAuthModel.getUserByEmail(null, email);
  if (!user) {
    return { message: "If account exists, OTP sent." };
  }

  const otpCode = generateOtp();
  const saltRounds = Number(process.env.PASSWORD_SALT_ROUNDS) || 10;
  const otpHash = await bcrypt.hash(otpCode, saltRounds);
  const otpExpiry = new Date(Date.now() + 5 * 60 * 1000);

  // ✅ FIX: HASHED OTP को Model में 'otp_code' के रूप में पास करें
  await userAuthModel.createOtp(null, {
    user_id: user.user_id,
    otp_code: otpHash,
    expires_at: otpExpiry,
  });

  await sendVerificationEmail({
    to: user.email,
    name: user.full_name,
    otp: otpCode,
  });
  return { otp: otpCode };
}

/** 5. RESET PASSWORD: Verifies OTP, hashes new password, and updates user in a transaction. */
async function resetPassword({ email, otp, newPassword }) {
  return db.tx(async (t) => {
    const user = await userAuthModel.getUserByEmail(t, email);
    if (!user) {
      throw new APIError("Password reset failed: User not found.", 404);
    }

    const otpRecord = await userAuthModel.getOtpByUserId(t, user.user_id);
    if (!otpRecord) {
      throw new APIError("Invalid OTP or OTP expired.", 401);
    }

    const isOtpValid = await bcrypt.compare(otp, otpRecord.otp_hash);
    const isExpired = new Date() > otpRecord.expires_at;

    if (!isOtpValid || isExpired) {
      throw new APIError("Invalid OTP or OTP expired.", 401);
    }

    await userAuthModel.updateUserPassword(t, user.user_id, newPassword);
    await userAuthModel.deleteOtp(t, user.user_id);

    return userAuthModel.getUserProfileData(t, user.user_id);
  });
}

/** 6. LOGOUT USER: No DB operation needed for JWT/Cookie based logout. */
async function logoutUser({ token }) {
  return { message: "Token implicitly invalidated." };
}

module.exports = {
  registerUser,
  verifyOtp,
  loginUser,
  forgotPassword,
  resetPassword,
  logoutUser,
};
