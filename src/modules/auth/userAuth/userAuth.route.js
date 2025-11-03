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

// Note: Assuming these routes are mounted under /api/v2/auth (as per server.js)

// POST /api/v2/auth/register
router.post("/register", register);

// POST /api/v2/auth/login
router.post("/login", login);

// POST /api/v2/auth/verify-otp
router.post("/verify-otp", verifyOtp);

// POST /api/v2/auth/forgot-password (Initiates OTP send)
router.post("/forgot-password", forgotPassword);

// POST /api/v2/auth/reset-password
router.post("/reset-password", resetPassword);

// GET /api/v2/auth/logout
router.get("/logout", logout);

module.exports = router;
