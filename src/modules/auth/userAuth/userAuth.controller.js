// File: src/modules/auth/userAuth/userAuth.controller.js
// FIXED: Controller now only passes fields defined in the updated Joi schema.

const UserAuthService = require("./userAuth.service");
const asyncHandler = require("../../../utils/asyncHandler");

/**
 * Register a new user
 * POST /api/v2/auth/register
 */
const register = asyncHandler(async (req, res) => {
  // CRITICAL FIX: Only destructure fields that are in the Joi schema.
  const { email, password, full_name } = req.body;

  // Pass only the validated fields to the service.
  const newUser = await UserAuthService.registerUser({
    email,
    password,
    full_name,
  });

  res.status(201).json({
    success: true,
    message: "User registered successfully. Welcome!",
    data: newUser,
  });
});

/**
 * Step 1: Login - Password Check and OTP Send
 * POST /api/v2/auth/login/step1
 */
const loginStep1 = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const result = await UserAuthService.loginStep1_passwordCheck_OTPsend(
    email,
    password
  );

  res.status(200).json({
    success: true,
    message: result.message,
    user_id: result.user_id,
  });
});

/**
 * Step 2: Login - OTP Verify and JWT Token Generate
 * POST /api/v2/auth/login/step2
 */
const loginStep2 = asyncHandler(async (req, res) => {
  const { user_id, otp } = req.body;
  const result = await UserAuthService.loginStep2_OTPverify_tokenGenerate(
    user_id,
    otp
  );

  res.status(200).json({
    success: true,
    message: result.message,
    token: result.token,
    user: result.user,
  });
});

/**
 * Logout
 * POST /api/v2/auth/logout
 */
const logout = asyncHandler(async (req, res) => {
  // req.user contains the decoded JWT payload from the auth middleware
  const result = await UserAuthService.logout(req.user);

  res.status(200).json({
    success: true,
    message: result.message,
  });
});

/**
 * Forgot Password - Step 1: Send OTP
 * POST /api/v2/auth/forgot-password/step1
 */
const forgotPasswordStep1 = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const result = await UserAuthService.forgotPassword_sendOTP(email);

  res.status(200).json({
    success: true,
    message: result.message,
  });
});

/**
 * Reset Password - Step 2: Verify OTP and Update Password
 * POST /api/v2/auth/forgot-password/step2
 */
const forgotPasswordStep2 = asyncHandler(async (req, res) => {
  // CRITICAL FIX: Ensure req.body field matches the Service function signature (newPassword was used previously)
  const { email, otp, newPassword } = req.body;
  const result = await UserAuthService.resetPassword_verifyOTP_updatePassword(
    email,
    otp,
    newPassword
  );

  res.status(200).json({
    success: true,
    message: result.message,
  });
});

module.exports = {
  register,
  loginStep1,
  loginStep2,
  logout,
  forgotPasswordStep1,
  forgotPasswordStep2,
};
