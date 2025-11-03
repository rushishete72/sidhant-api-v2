const Joi = require("joi");

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
  password: Joi.string().min(6).max(128).required().messages({
    "any.required": "Password is required.",
    "string.min": "Password must be at least 6 characters.",
    "string.max": "Password must be at most 128 characters.",
  }),
  defaultRoleName: Joi.string().trim().optional(),
});

module.exports = {
  registerSchema,
};
