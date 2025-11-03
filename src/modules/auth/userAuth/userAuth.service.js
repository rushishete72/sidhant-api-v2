/**
 * src/modules/auth/userAuth/userAuth.service.js - Final Service Layer
 * MANDATES: db.tx for CUD operations, bcrypt, emailSender calls.
 * FIX: Implemented simple numeric OTP generation function.
 */

const bcrypt = require("bcryptjs");
const { db } = require("../../../../src/database/db");
const { APIError } = require("../../../utils/errorHandler");
const { sendVerificationEmail } = require("../../../utils/emailSender");
const userAuthModel = require("./userAuth.model");

// --- Helper Functions ---

// ✅ FIX: Simple numeric OTP generator (No external dependency like 'uuid')
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
  const otpExpiry = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes validity

  try {
    // START TRANSACTION: Ensure all DB operations succeed or fail together
    const { user } = await db.tx(async (t) => {
      const role = await userAuthModel.getOrCreateRole(t, defaultRoleName);

      const newUser = await userAuthModel.createUser(t, {
        email,
        full_name,
        role_id: role.role_id,
        password_hash: passwordHash,
      });

      await userAuthModel.createOtp(t, {
        user_id: newUser.user_id,
        otp_hash: otpHash,
        expires_at: otpExpiry,
      });

      return { user: newUser };
    });
    // END TRANSACTION (COMMIT)

    // Send verification email (Outside transaction)
    await sendVerificationEmail({
      to: user.email,
      name: user.full_name,
      otp: otpCode,
    });

    // Fetch full profile data before returning
    const profile = await userAuthModel.getUserProfileData(null, user.user_id);
    return { user: profile, otp: otpCode };
  } catch (err) {
    if (err && err.code === "23505") {
      // PostgreSQL unique constraint violation
      throw new APIError("Registration failed: Email already exists.", 409);
    }
    console.error("Registration error:", err);
    throw new APIError("User registration failed due to a server error.", 500);
  }
}

/** 2. VERIFY OTP: Checks OTP, updates user verification status, and deletes OTP in a transaction. */
async function verifyOtp({ email, otp }) {
  return db.tx(async (t) => {
    // 1. Fetch user by email
    const user = await userAuthModel.getUserByEmail(t, email);
    if (!user) {
      throw new APIError("Verification failed: User not found.", 404);
    }

    // 2. Fetch OTP hash
    const otpRecord = await userAuthModel.getOtpByUserId(t, user.user_id);
    if (!otpRecord) {
      throw new APIError(
        "Invalid or expired OTP. Please request a new one.",
        401
      );
    }

    // 3. Check expiry and hash
    const isOtpValid = await bcrypt.compare(otp, otpRecord.otp_hash);
    const isExpired = new Date() > otpRecord.expires_at;

    if (!isOtpValid || isExpired) {
      throw new APIError("Invalid OTP or OTP expired/attempts exceeded.", 401);
    }

    // 4. Atomically update user and delete OTP
    await userAuthModel.updateUserVerificationStatus(t, user.user_id, true);
    await userAuthModel.deleteOtp(t, user.user_id);

    // 5. Return updated user profile
    return userAuthModel.getUserProfileData(t, user.user_id);
  });
}

/** 3. LOGIN USER: Authenticates user by password and returns profile data. */
async function loginUser({ email, password }) {
  const user = await userAuthModel.getUserByEmail(null, email);
  if (!user || user.is_active === false) {
    throw new APIError("Invalid credentials.", 401);
  }

  // 1. Check if user is verified
  if (user.is_verified === false) {
    throw new APIError("Account not verified. Please verify your OTP.", 403);
  }

  // 2. Compare password hash
  const isMatch = await bcrypt.compare(password, user.password_hash);
  if (!isMatch) {
    throw new APIError("Invalid credentials.", 401);
  }

  // 3. Fetch canonical profile (role, permissions)
  const profile = await userAuthModel.getUserProfileData(null, user.user_id);

  return { user: profile, profile };
}

/** 4. FORGOT PASSWORD: Creates a new OTP for password reset. */
async function forgotPassword({ email }) {
  const user = await userAuthModel.getUserByEmail(null, email);
  if (!user) {
    // Security by obscurity: return success even if user not found
    return { message: "If account exists, OTP sent." };
  }

  const otpCode = generateOtp();
  const saltRounds = Number(process.env.PASSWORD_SALT_ROUNDS) || 10;
  const otpHash = await bcrypt.hash(otpCode, saltRounds);
  const otpExpiry = new Date(Date.now() + 5 * 60 * 1000);

  // Update/Insert OTP record
  await userAuthModel.createOtp(null, {
    user_id: user.user_id,
    otp_hash: otpHash,
    expires_at: otpExpiry,
  });

  // Send email
  await sendVerificationEmail({
    to: user.email,
    name: user.full_name,
    otp: otpCode,
  });

  return { otp: otpCode };
}

/** 5. RESET PASSWORD: Verifies OTP, hashes new password, and updates user in a transaction. */
async function resetPassword({ email, otp, newPassword }) {
  // Use db.tx for atomicity: verify OTP and update password
  return db.tx(async (t) => {
    // 1. Fetch user
    const user = await userAuthModel.getUserByEmail(t, email);
    if (!user) {
      throw new APIError("Password reset failed: User not found.", 404);
    }

    // 2. Check OTP hash and expiry
    const otpRecord = await userAuthModel.getOtpByUserId(t, user.user_id);
    if (!otpRecord) {
      throw new APIError("Invalid OTP or OTP expired.", 401);
    }

    const isOtpValid = await bcrypt.compare(otp, otpRecord.otp_hash);
    const isExpired = new Date() > otpRecord.expires_at;

    if (!isOtpValid || isExpired) {
      throw new APIError("Invalid OTP or OTP expired.", 401);
    }

    // 3. Hash new password and update user record (Model handles hashing)
    await userAuthModel.updateUserPassword(t, user.user_id, newPassword);

    // 4. Delete the used OTP record
    await userAuthModel.deleteOtp(t, user.user_id);

    // 5. Return updated profile
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
