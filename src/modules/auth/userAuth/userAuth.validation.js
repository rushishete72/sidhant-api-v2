const Joi = require("joi");

const email = Joi.string().email().lowercase().required();
const password = Joi.string().min(8).max(128).required();
const otp = Joi.string().pattern(/^\d{6}$/).required(); // 6-digit OTP

const registerSchema = Joi.object({
  email,
  password,
  name: Joi.string().max(100).allow(null, "").optional(),
});

const loginSchema = Joi.object({
  email,
  password,
});

const verifyOtpSchema = Joi.object({
  email,
  otp,
});

const forgotPasswordSchema = Joi.object({
  email,
});

const resetPasswordSchema = Joi.object({
  email,
  otp,
  newPassword: Joi.string().min(8).max(128).required(),
});

module.exports = {
  registerSchema,
  loginSchema,
  verifyOtpSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
};
