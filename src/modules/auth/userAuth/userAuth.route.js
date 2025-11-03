// File: src/modules/auth/userAuth/userAuth.route.js

const express = require("express");
const router = express.Router();

const {
  register,
  loginStep1,
  loginStep2,
  logout,
  forgotPasswordStep1,
  forgotPasswordStep2,
} = require("./userAuth.controller");

// CRITICAL FIX: Ensure the middleware is imported as 'validate', not 'validation'.
// The utils file exports it as 'validate'.
const { validate } = require("../../../utils/validation");
const { authenticate } = require("../../../middleware/auth");

const {
  registerSchema,
  loginStep1Schema,
  loginStep2Schema,
  forgotPasswordStep1Schema,
  forgotPasswordStep2Schema,
} = require("./userAuth.validation");

// --- Public Routes ---
// CORRECT USAGE: validate(schema) is a function call returning the middleware.
router.post("/register", validate(registerSchema), register);
router.post("/login/step1", validate(loginStep1Schema), loginStep1);
router.post("/login/step2", validate(loginStep2Schema), loginStep2);
router.post(
  "/forgot-password/step1",
  validate(forgotPasswordStep1Schema),
  forgotPasswordStep1
);
router.post(
  "/forgot-password/step2",
  validate(forgotPasswordStep2Schema),
  forgotPasswordStep2
);

// --- Protected Routes ---
router.post("/logout", authenticate, logout);

module.exports = router;
