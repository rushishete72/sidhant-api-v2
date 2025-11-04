// File: src/modules/auth/userAuth/userAuth.route.js
// FIX: Ensures all handlers (register, verifyRegistrationOTP, etc.) are correctly imported and mapped.

const express = require("express");
const router = express.Router();
const validate = require("../../../utils/validation");
const authController = require("./userAuth.controller");
const {
  registerSchema,
  registrationOtpSchema, // This was likely the missing schema in the crash context
  loginStep1Schema,
  loginStep2Schema,
  forgotPasswordStep1Schema,
  forgotPasswordStep2Schema,
} = require("./userAuth.validation");
const { authenticate } = require("../../../middleware/auth"); // Required for logout protection

// --- PUBLIC ROUTES (No Auth Required) ---

// 1. User Registration - Step 1: Create Account and Send OTP (Likely crashed here)
router.post(
  "/register",
  validate(registerSchema),
  authController.register // This handler MUST be a function.
); // This line or near it was the source of the crash (Line 20)

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
  authController.loginStep1
);

// 4. User Login - Step 2: OTP Verification and Token Generation
router.post(
  "/login/step2",
  validate(loginStep2Schema),
  authController.loginStep2
);

// 5. Forgot Password - Step 1: Send Reset OTP
router.post(
  "/forgot-password/step1",
  validate(forgotPasswordStep1Schema),
  authController.forgotPasswordStep1
);

// 6. Forgot Password - Step 2: Verify OTP and Reset Password
router.post(
  "/forgot-password/step2",
  validate(forgotPasswordStep2Schema),
  authController.forgotPasswordStep2
);

// --- AUTH REQUIRED ROUTES ---
// Logout requires the Access Token in the Header AND the Refresh Token in the Body (CUD operation)
router.post("/logout", authenticate, authController.logout);

module.exports = router;
