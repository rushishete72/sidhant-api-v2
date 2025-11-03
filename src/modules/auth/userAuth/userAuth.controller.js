/**
 * src/modules/auth/userAuth/userAuth.controller.js - Final Controller
 * MANDATES: Handles Joi Validation, JWT Token Management, and delegates all DB/Business Logic to Service.
 * FIX: No duplicated imports, correctly maps Joi errors.
 */

const jwt = require("jsonwebtoken");
const { APIError } = require("../../../utils/errorHandler");
const validation = require("./userAuth.validation");
const service = require("./userAuth.service");

// --- Global Configuration ---
const JWT_SECRET =
  process.env.JWT_SECRET || "your_super_secret_key_for_jwt_signing";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "1h";
const JWT_COOKIE_NAME = process.env.JWT_COOKIE_NAME || "auth_token";

// Helper function for consistent cookie options
function createTokenCookieOptions() {
  const isProd = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: "Strict",
    maxAge: parseInt(process.env.COOKIE_MAX_AGE_MS || `${60 * 60 * 1000}`, 10),
  };
}

// Helper function to map Joi validation errors to a standard APIError (400)
function mapJoiError(err) {
  const message = err.details.map((d) => d.message).join("; ");
  return new APIError(`Validation failed: ${message}`, 400);
}

// =========================================================================
// 1. REGISTER USER
// =========================================================================

async function register(req, res, next) {
  try {
    const payload = await validation.registerSchema.validateAsync(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    // Service handles user creation, OTP generation, and email sending (db.tx)
    const { user, otp } = await service.registerUser(payload);

    return res.status(201).json({
      user,
      message: "User registered successfully. Verification OTP sent via email.",
      test_otp: process.env.NODE_ENV !== "production" ? otp : undefined,
    });
  } catch (err) {
    if (err.isJoi) return next(mapJoiError(err));
    return next(err);
  }
}

// =========================================================================
// 2. VERIFY OTP
// =========================================================================

async function verifyOtp(req, res, next) {
  try {
    const payload = await validation.verifyOtpSchema.validateAsync(req.body, {
      stripUnknown: true,
    });

    // Service handles OTP verification, user update, and OTP delete (db.tx)
    const updatedUser = await service.verifyOtp(payload);

    return res
      .status(200)
      .json({ user: updatedUser, message: "Account verified and activated." });
  } catch (err) {
    if (err.isJoi) return next(mapJoiError(err));
    return next(err);
  }
}

// =========================================================================
// 3. LOGIN USER
// =========================================================================

async function login(req, res, next) {
  try {
    // ✅ FIX: req.body को सुरक्षित रूप से हैंडल करें।
    // यदि req.body undefined है (body-parser विफल हुआ), तो Joi को एक खाली ऑब्जेक्ट {} दें।
    const body = req.body || {};

    // Joi Validation (अब body ऑब्जेक्ट पर चलता है, undefined पर नहीं)
    const payload = await validation.loginSchema.validateAsync(body, {
      stripUnknown: true,
    });

    const { user, profile } = await service.loginUser(payload);

    // JWT Creation (Controller's job)
    const token = jwt.sign(profile, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    // Set HTTP-Only Cookie
    const cookieOptions = createTokenCookieOptions();
    res.cookie(JWT_COOKIE_NAME, token, cookieOptions);

    return res.status(200).json({
      user,
      token,
      message: "Login successful.",
    });
  } catch (err) {
    if (err.isJoi) return next(mapJoiError(err));
    return next(err);
  }
}

// =========================================================================
// 4. FORGOT PASSWORD (Initiates password reset via OTP)
// =========================================================================

async function forgotPassword(req, res, next) {
  try {
    const payload = await validation.forgotPasswordSchema.validateAsync(
      req.body,
      { stripUnknown: true }
    );

    const { otp } = await service.forgotPassword(payload);

    return res.status(200).json({
      message:
        "If account exists, a password reset OTP has been sent to the email.",
      test_otp: process.env.NODE_ENV !== "production" ? otp : undefined,
    });
  } catch (err) {
    if (err.isJoi) return next(mapJoiError(err));
    return next(err);
  }
}

// =========================================================================
// 5. RESET PASSWORD (Verify OTP and update password)
// =========================================================================

async function resetPassword(req, res, next) {
  try {
    const payload = await validation.resetPasswordSchema.validateAsync(
      req.body,
      { stripUnknown: true }
    );

    // Service handles OTP verification, password hashing, user update, and OTP delete (db.tx)
    const updatedUser = await service.resetPassword(payload);

    return res
      .status(200)
      .json({ user: updatedUser, message: "Password reset successful." });
  } catch (err) {
    if (err.isJoi) return next(mapJoiError(err));
    return next(err);
  }
}

// =========================================================================
// 6. LOGOUT USER (Clear JWT from client)
// =========================================================================

async function logout(req, res, next) {
  try {
    // Clear the HTTP-Only Cookie (Controller's responsibility)
    res.clearCookie(JWT_COOKIE_NAME, createTokenCookieOptions());

    return res.status(200).json({ message: "Logged out successfully." });
  } catch (err) {
    return next(err);
  }
}

// =========================================================================
// FINAL EXPORTS
// =========================================================================

module.exports = {
  register,
  verifyOtp,
  login,
  forgotPassword,
  resetPassword,
  logout,
};
