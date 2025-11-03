/**
 * src/modules/auth/userAuth/userAuth.route.js - Final Route Layer
 * MANDATES: Defines all API endpoints for the Auth module.
 */

const express = require("express");
const router = express.Router();

// Import the final, fixed controller functions
const {
  register,
  login,
  verifyOtp,
  forgotPassword,
  resetPassword,
  logout,
} = require("./userAuth.controller");

// Note: Assuming these routes are mounted under /api/v1/auth

// POST /api/v1/auth/register
router.post("/register", register);

// POST /api/v1/auth/login
router.post("/login", login);

// POST /api/v1/auth/verify-otp
router.post("/verify-otp", verifyOtp);

// POST /api/v1/auth/forgot-password (Initiates OTP send)
router.post("/forgot-password", forgotPassword);

// POST /api/v1/auth/reset-password
router.post("/reset-password", resetPassword);

// GET /api/v1/auth/logout
router.get("/logout", logout);

module.exports = router;
