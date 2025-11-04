// File: src/modules/auth/userAuth/userAuth.validation.js
// FINAL VERSION: Includes register, login step 1, login step 2, and forgot password step 1 schemas.

const Joi = require("joi");

// Common password regex for security: Min 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special char
const passwordRegex =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

const registerSchema = Joi.object({
  email: Joi.string().email().required().lowercase().trim().messages({
    "string.email": "Email must be a valid email address.",
    "any.required": "Email is required.",
  }),
  password: Joi.string().pattern(passwordRegex).required().messages({
    "string.pattern.base":
      "Password must be at least 8 chars and include uppercase, lowercase, number, and special char.",
    "any.required": "Password is required.",
  }),
  full_name: Joi.string().min(3).max(100).required(),
});

const loginStep1Schema = Joi.object({
  email: Joi.string().email().required().lowercase().trim(),
  password: Joi.string().required(),
});

const loginStep2Schema = Joi.object({
  user_id: Joi.number().integer().positive().required().messages({
    "any.required": "User ID is required from the first login step.",
  }),
  otp: Joi.string()
    .length(6)
    .pattern(/^[0-9]+$/)
    .required()
    .messages({
      "string.length": "OTP must be 6 digits.",
      "string.pattern.base": "OTP must be numerical.",
    }),
});

const forgotPasswordStep1Schema = Joi.object({
  email: Joi.string().email().required().lowercase().trim(), // Only requires a valid email
});

const forgotPasswordStep2Schema = Joi.object({
  email: Joi.string().email().required().lowercase().trim(),
  otp: Joi.string()
    .length(6)
    .pattern(/^[0-9]+$/)
    .required(),
  new_password: Joi.string().pattern(passwordRegex).required(),
});

module.exports = {
  registerSchema,
  loginStep1Schema,
  loginStep2Schema,
  forgotPasswordStep1Schema,
  forgotPasswordStep2Schema,
};
