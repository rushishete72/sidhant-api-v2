// File: src/modules/auth/userAuth/userAuth.controller.js

const asyncHandler = require("../../../utils/asyncHandler");
const UserAuthService = require("./userAuth.service");

// Controller for Registration Step 1: Create Account & Send OTP
const registerUser = asyncHandler(async (req, res) => {
  const newUser = await UserAuthService.registerUser_Step1_CreateAndSendOTP(
    req.body
  );

  // Send a 201 Created response
  res.status(201).json({
    success: true,
    status: "success",
    message: newUser.message,
    data: {
      user_id: newUser.user_id, // Return ID to facilitate Step 2
      email: newUser.email,
    },
  });
});

// Controller for Registration Step 2: Verify OTP and Activate User
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

// Existing Controller for Login Step 1: Password Check and Send Login OTP
const loginStep1_passwordCheck_OTPsend = asyncHandler(async (req, res) => {
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

// Existing Controller for Login Step 2: OTP Verification and Token Generation
const loginStep2_OTPverify_tokenGenerate = asyncHandler(async (req, res) => {
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
      token: result.token,
      user: result.user,
    },
  });
});

// Existing Controller for Forgot Password Step 1
const forgotPassword_sendOTP = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const result = await UserAuthService.forgotPassword_sendOTP(email);

  res.status(200).json({
    success: true,
    status: "success",
    message: result.message,
  });
});

// Existing Controller for Forgot Password Step 2
const resetPassword_verifyOTP_updatePassword = asyncHandler(
  async (req, res) => {
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
  }
);

module.exports = {
  registerUser,
  verifyRegistrationOTP,
  loginStep1_passwordCheck_OTPsend,
  loginStep2_OTPverify_tokenGenerate,
  forgotPassword_sendOTP,
  resetPassword_verifyOTP_updatePassword,
};
