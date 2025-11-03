/*
 * Minimal controller: delegates registration to service layer.
 */

const { APIError } = require("../../../utils/errorHandler");
const emailSender = require("../../../utils/emailSender");
const userAuthModel = require("./userAuth.model"); // retained for other controller actions
const {
  generateOtp,
  handleEmailValidation,
} = require("../../../utils/validation");
const jwt = require("jsonwebtoken");
const service = require("./userAuth.service");
const validators = require("./userAuth.validation");

const JWT_SECRET = process.env.JWT_SECRET || "replace-me";
const JWT_COOKIE_NAME = process.env.JWT_COOKIE_NAME || "token";
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
};

function mapJoiError(err) {
  const error = new Error("Validation error");
  error.status = 400;
  error.details = err && err.details ? err.details.map((d) => d.message) : [err.message];
  return error;
}

const createAuthToken = (profile) => {
  const payload = {
    user_id: profile.user_id,
    email: profile.email,
    role_name: profile.role,
    permissions: profile.permissions,
  };
  if (!JWT_SECRET) {
    throw new APIError(
      "JWT_SECRET is not configured. Critical server error.",
      500
    );
  }
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY });
};

async function registerUser(req, res, next) {
  try {
    const payload = {
      email: req.body.email,
      full_name: req.body.full_name,
      password: req.body.password,
      defaultRoleName: req.body.defaultRoleName,
    };

    const validated = await validators.register.validateAsync(req.body, {
      stripUnknown: true,
    });
    const result = await service.registerUser(validated);
    res.status(201).json({
      message: "User registered successfully. Verification email sent if configured.",
      data: result.user,
      // OTP returned for dev/testing only; remove in production
      otp: result.otp,
    });
  } catch (err) {
    if (err.isJoi) return next(mapJoiError(err));
    next(err);
  }
}

async function loginUser(req, res, next) {
  const { email } = req.body;

  const emailError = handleEmailValidation(email);
  if (emailError) {
    return next(new APIError(emailError, 400));
  }

  try {
    const user = await userAuthModel.getUserByEmail(email);

    if (!user) {
      return next(new APIError("User not found or is inactive.", 404));
    }

    const otpCode = generateOtp();
    await userAuthModel.createOtp(user.user_id, otpCode); // --- FIX 2: Email Sending Logic ---

    try {
      // We use sendVerificationEmail which was added to emailSender.js
      const sendResult = await emailSender.sendVerificationEmail({
        to: user.email,
        name: user.full_name, // Full name from database
        otp: otpCode,
      });

      if (sendResult.skipped) {
        console.warn(
          `[Login] Email skipped for ${user.email}. Check SMTP config.`
        );
      }
    } catch (emailError) {
      // Continue login process even if email fails, but log the error
      console.error(
        `[Login] Failed to send OTP email to ${user.email}:`,
        emailError.message
      );
    } // ------------------------------------
    res.status(200).json({
      message: "OTP sent to your email for login.",
      data: {
        user_id: user.user_id,
        email: user.email, // Show OTP in development only
        test_otp: process.env.NODE_ENV !== "production" ? otpCode : undefined,
      },
    });
  } catch (error) {
    next(error);
  }
}

async function verifyOtp(req, res, next) {
  try {
    const validated = await validators.verifyOtp.validateAsync(req.body, {
      stripUnknown: true,
    });
    const updated = await service.verifyOtp(validated);
    res.status(200).json({ message: "OTP verified. Account activated.", user: updated });
  } catch (err) {
    if (err.isJoi) return next(mapJoiError(err));
    next(err);
  }
}

async function resetPassword(req, res, next) {
  try {
    const validated = await validators.resetPassword.validateAsync(req.body, {
      stripUnknown: true,
    });
    const updated = await service.resetPassword({
      email: validated.email,
      otp: validated.otp,
      newPassword: validated.newPassword,
    });
    res.status(200).json({ message: "Password reset successful.", user: updated });
  } catch (err) {
    if (err.isJoi) return next(mapJoiError(err));
    next(err);
  }
}

async function logoutUser(req, res, next) {
  try {
    // token may be in Authorization header or cookie
    let token = null;
    const auth = req.headers.authorization;
    if (auth && auth.startsWith("Bearer ")) token = auth.slice(7);
    else if (req.cookies && req.cookies[JWT_COOKIE_NAME])
      token = req.cookies[JWT_COOKIE_NAME];

    if (!token) {
      const err = new Error("No token provided for logout");
      err.status = 400;
      throw err;
    }

    await service.logoutUser({ token });

    res.clearCookie(JWT_COOKIE_NAME, COOKIE_OPTIONS);
    res.status(200).json({ message: "Logged out" });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  registerUser,
  loginUser,
  verifyOtp,
  logoutUser,
  resetPassword,
};
