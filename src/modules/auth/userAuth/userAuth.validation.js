const Joi = require("joi");

const passwordPattern = new RegExp("^(?=.{8,}$)(?=.*[A-Z])(?=.*[a-z])(?=.*[0-9]).*$");
// Password: min 8 chars, at least one uppercase, one lowercase, one digit

const registerSchema = Joi.object({
  full_name: Joi.string().trim().min(2).max(100).required().messages({
    "any.required": "Full name is required.",
    "string.empty": "Full name is required.",
    "string.min": "Full name must be at least 2 characters.",
    "string.max": "Full name must be at most 100 characters.",
  }),
  email: Joi.string()
    .trim()
    .email({ tlds: false })
    .max(100)
    .required()
    .messages({
      "any.required": "Email is required.",
      "string.email": "Invalid email format.",
      "string.max": "Email must be at most 100 characters.",
    }),
  password: Joi.string()
    .pattern(passwordPattern)
    .required()
    .messages({
      "any.required": "Password is required.",
      "string.pattern.base":
        "Password must be at least 8 characters and include upper/lowercase letters and numbers",
    }),
  defaultRoleName: Joi.string().trim().optional(),
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

const verifyOtpSchema = Joi.object({
  email: Joi.string().email().required(),
  otp: Joi.string().length(6).pattern(/^\d{6}$/).required(),
});

const forgotPasswordSchema = Joi.object({
  email: Joi.string().email().required(),
});

const resetPasswordSchema = Joi.object({
  email: Joi.string().email().required(),
  otp: Joi.string().length(6).pattern(/^\d{6}$/).required(),
  newPassword: Joi.string()
    .pattern(passwordPattern)
    .required()
    .messages({
      "string.pattern.base":
        "Password must be at least 8 characters and include upper/lowercase letters and numbers",
    }),
});

module.exports = {
  registerSchema,
  loginSchema,
  verifyOtpSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
};
