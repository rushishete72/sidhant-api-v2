// File: src/modules/auth/userAuth/userAuth.controller.js
// FINAL VERSION: Synchronized for 2-Step Registration, 2-Step Login, and Stateful Logout.

const asyncHandler = require("../../../utils/asyncHandler");
const UserAuthService = require("./userAuth.service");
const CustomError = require("../../../utils/errorHandler"); // Ensure CustomError is available

/**
 * Register a new user - Step 1: Create Account & Send OTP
 * Maps to POST /api/v1/auth/register
 */
const register = asyncHandler(async (req, res) => {
  const newUser = await UserAuthService.registerUser_Step1_CreateAndSendOTP(
    req.body
  );

  res.status(201).json({
    success: true,
    status: "success",
    message: newUser.message,
    data: {
      user_id: newUser.user_id,
      email: newUser.email,
    },
  });
});

/**
 * Register a new user - Step 2: Verify OTP and Activate User
 * Maps to POST /api/v1/auth/verify-registration-otp
 */
const verifyRegistrationOTP = asyncHandler(async (req, res) => {
  const { user_id, otp } = req.body;

  const result = await UserAuthService.registerUser_Step2_VerifyOTPAndActivate(
    user_id,
    otp
  );

  res.status(200).json({
    success: true,
    status: "success",
    message: result.message,
    data: {
      user_id: result.user_id,
      email: result.email,
    },
  });
});

/**
 * Step 1: Login - Password Check and OTP Send
 * Maps to POST /api/v1/auth/login/step1
 */
const loginStep1 = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const result = await UserAuthService.loginStep1_passwordCheck_OTPsend(
    email,
    password
  );

  res.status(200).json({
    success: true,
    status: "success",
    message: result.message,
    data: { user_id: result.user_id },
  });
});

/**
 * Step 2: Login - OTP Verify and Access/Refresh Token Generate
 * Maps to POST /api/v1/auth/login/step2
 */
const loginStep2 = asyncHandler(async (req, res) => {
  const { user_id, otp } = req.body;

  const result = await UserAuthService.loginStep2_OTPverify_tokenGenerate(
    user_id,
    otp
  );

  res.status(200).json({
    success: true,
    status: "success",
    message: result.message,
    data: {
      token: result.token, // Access Token
      refreshToken: result.refreshToken, // Refresh Token
      user: result.user,
    },
  });
});

/**
 * Logout (CRITICAL: Invalidates Refresh Token in DB)
 * Maps to POST /api/v1/auth/logout
 */
const logout = asyncHandler(async (req, res) => {
  // We read the Refresh Token from the request body for deletion.
  const { refreshToken } = req.body;

  if (!refreshToken) {
    throw new CustomError(
      "Refresh token is required for secure session invalidation.",
      400
    );
  }

  // The service deletes the Refresh Token from the user_sessions table atomically.
  const result = await UserAuthService.logout(refreshToken);

  res.status(200).json({
    success: true,
    status: "success",
    message: result.message,
  });
});

/**
 * Forgot Password - Step 1: Send OTP
 * Maps to POST /api/v1/auth/forgot-password/step1
 */
const forgotPasswordStep1 = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const result = await UserAuthService.forgotPassword_sendOTP(email);

  res.status(200).json({
    success: true,
    status: "success",
    message: result.message,
  });
});

/**
 * Reset Password - Step 2: Verify OTP and Update Password
 * Maps to POST /api/v1/auth/forgot-password/step2
 */
const forgotPasswordStep2 = asyncHandler(async (req, res) => {
  const { email, otp, new_password } = req.body;
  const result = await UserAuthService.resetPassword_verifyOTP_updatePassword(
    email,
    otp,
    new_password
  );

  res.status(200).json({
    success: true,
    status: "success",
    message: result.message,
  });
});

module.exports = {
  register,
  verifyRegistrationOTP,
  loginStep1,
  loginStep2,
  logout,
  forgotPasswordStep1,
  forgotPasswordStep2,
};
