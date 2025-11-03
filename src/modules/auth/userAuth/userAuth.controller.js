/*
 * Minimal controller: delegates registration to service layer.
 */

const { APIError } = require("../../../utils/errorHandler");
const { registerUser: registerUserService } = require("./userAuth.service");

// --- FIX 1: Add emailSender import at the top ---
const emailSender = require("../../../utils/emailSender");
// ------------------------------------------------

const userAuthModel = require("./userAuth.model"); // retained for other controller actions
const {
  generateOtp,
  handleEmailValidation,
} = require("../../../utils/validation");
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "your_default_secret_key";
const JWT_EXPIRY = process.env.JWT_EXPIRY || "7d";

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

const registerUser = async (req, res, next) => {
  try {
    const payload = {
      email: req.body.email,
      full_name: req.body.full_name,
      password: req.body.password,
      defaultRoleName: req.body.defaultRoleName,
    };

    const user = await registerUserService(payload);

    return res.status(201).json({
      message:
        "User registered successfully. Verification email sent if configured.",
      data: user,
    });
  } catch (err) {
    return next(err);
  }
};

const loginUser = async (req, res, next) => {
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
};

const verifyOtp = async (req, res, next) => {
  const { email, otp: inputOtpCode = "123456" } = req.body;

  if (!email || !inputOtpCode) {
    return next(
      new APIError("Email and OTP are required for verification.", 400)
    );
  }

  try {
    const user = await userAuthModel.getUserByEmail(email);

    if (!user) {
      return next(new APIError("User not found or is inactive.", 404));
    }

    const verificationResult = await userAuthModel.validateOtp(
      user.user_id,
      inputOtpCode
    );

    if (!verificationResult) {
      return next(
        new APIError("Invalid OTP or OTP expired/attempts exceeded.", 401)
      );
    }

    const profile = await userAuthModel.getUserProfileData(user.user_id);

    if (!profile) {
      return next(
        new APIError("Failed to load user profile after verification.", 500)
      );
    }

    const token = createAuthToken(profile);

    res.status(200).json({
      message: "OTP verified. Login successful.",
      token: token,
      data: {
        user_id: profile.user_id,
        email: profile.email,
        role: profile.role,
        permissions: profile.permissions,
      },
    });
  } catch (error) {
    next(error);
  }
};

const resetPassword = async (req, res, next) => {
  const { email, newPassword, otp: inputOtpCode = "123456" } = req.body;

  if (!email || !newPassword || !inputOtpCode) {
    return next(
      new APIError("Email, OTP, and new password are required.", 400)
    );
  }

  try {
    const user = await userAuthModel.getUserByEmail(email);

    if (!user) {
      return next(new APIError("User not found or is inactive.", 404));
    }

    const verificationResult = await userAuthModel.validateOtp(
      user.user_id,
      inputOtpCode
    );

    if (!verificationResult) {
      return next(
        new APIError("Invalid OTP or OTP expired/attempts exceeded.", 401)
      );
    }

    await userAuthModel.updateUserPassword(user.user_id, newPassword);

    res.status(200).json({
      message:
        "Password successfully reset. You can now login (if password login is enabled).",
      data: {
        user_id: user.user_id,
      },
    });
  } catch (error) {
    next(error);
  }
};

const logoutUser = (req, res) => {
  res.status(200).json({
    message: "Logout successful. कृपया क्लाइंट-साइड पर टोकन हटाएँ।",
  });
};

module.exports = {
  registerUser,
  loginUser,
  verifyOtp,
  logoutUser,
  resetPassword,
};
