// File: src/modules/auth/userAuth/userAuth.route.js

const express = require("express");
const router = express.Router();
const validate = require("../../../utils/validation"); // assuming validate is exported directly
const authController = require("./userAuth.controller");
const {
  registerSchema, // CRITICAL: This MUST be correctly imported from validation.js
  registrationOtpSchema,
  loginStep1Schema,
  loginStep2Schema,
  forgotPasswordStep1Schema,
  forgotPasswordStep2Schema,
} = require("./userAuth.validation");
// const { protect } = require("../../../middleware/auth"); // Assuming middleware/auth.js exists

// --- PUBLIC ROUTES (No Auth Required) ---

// 1. User Registration - Step 1: Create Account and Send OTP
router.post("/register", validate(registerSchema), authController.registerUser);

// 2. User Registration - Step 2: Verify OTP and Activate User (Completes Registration)
router.post(
  "/verify-registration-otp",
  validate(registrationOtpSchema),
  authController.verifyRegistrationOTP
);

// 3. User Login - Step 1: Password Check and Send Login OTP
router.post(
  "/login/step1",
  validate(loginStep1Schema),
  authController.loginStep1_passwordCheck_OTPsend
);

// 4. User Login - Step 2: OTP Verification and Token Generation
router.post(
  "/login/step2",
  validate(loginStep2Schema),
  authController.loginStep2_OTPverify_tokenGenerate
);

// 5. Forgot Password - Step 1: Send Reset OTP
router.post(
  "/forgot-password/step1",
  validate(forgotPasswordStep1Schema),
  authController.forgotPassword_sendOTP
);

// 6. Forgot Password - Step 2: Verify OTP and Reset Password
router.post(
  "/forgot-password/step2",
  validate(forgotPasswordStep2Schema),
  authController.resetPassword_verifyOTP_updatePassword
);

// --- AUTH REQUIRED ROUTES (Placeholder) ---
router.get("/logout", protect, authController.logout);

module.exports = router;
