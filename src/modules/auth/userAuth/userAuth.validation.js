/**
 * src/modules/auth/userAuth/userAuth.validation.js - Final Joi Schemas
 * MANDATE: All validation schemas defined here for Controller layer usage.
 */

const Joi = require("joi");

// --- Reusable Schemas ---

// OTP must be a 6-digit number string
const otpSchema = Joi.string()
  .pattern(/^\d{6}$/)
  .required()
  .messages({
    "any.required": "OTP is required.",
    "string.pattern.base": "OTP must be a 6-digit number.",
  });

const emailSchema = Joi.string()
  .trim()
  .email({ tlds: { allow: false } })
  .max(100)
  .required()
  .messages({
    "any.required": "Email is required.",
    "string.email": "Invalid email format.",
  });

const passwordSchema = Joi.string().min(6).max(128).required().messages({
  "any.required": "Password is required.",
  "string.min": "Password must be at least 6 characters.",
});

// 1. REGISTER SCHEMA
const registerSchema = Joi.object({
  full_name: Joi.string().trim().min(2).max(100).required(),
  email: emailSchema,
  password: passwordSchema,
  defaultRoleName: Joi.string().trim().optional(),
});

// 2. LOGIN SCHEMA
const loginSchema = Joi.object({
  email: emailSchema,
  password: passwordSchema,
});

// 3. VERIFY OTP SCHEMA
const verifyOtpSchema = Joi.object({
  email: emailSchema,
  otp: otpSchema,
});

// 4. FORGOT PASSWORD (Initiate reset) SCHEMA
const forgotPasswordSchema = Joi.object({
  email: emailSchema,
});

// 5. RESET PASSWORD SCHEMA
const resetPasswordSchema = Joi.object({
  email: emailSchema,
  otp: otpSchema,
  newPassword: passwordSchema,
});

module.exports = {
  registerSchema,
  loginSchema,
  verifyOtpSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
};
