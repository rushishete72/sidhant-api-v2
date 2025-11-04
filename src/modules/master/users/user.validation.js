/*
 * File: src/modules/master/users/user.validation.js
 * Module: Admin User Management (Validation Schemas)
 * Absolute Accountability: Defines schemas for Admin CRUD operations.
 */

const Joi = require("joi");

// Common password regex for security: Min 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special char
const passwordRegex =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

// =========================================================================
// 1. POST / Create New User (Admin Panel)
// =========================================================================

const createUserSchema = Joi.object({
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
  role_id: Joi.number().integer().positive().required().messages({
    "any.required": "Role ID is required for a new user.",
  }),
  // is_active/is_verified are handled by the service layer (default TRUE)
});

// =========================================================================
// 2. PUT/PATCH /:userId - General User Detail Update
// =========================================================================

const updateUserSchema = Joi.object({
  // Only non-auth details are allowed in this generic update route
  full_name: Joi.string().min(3).max(100).optional(),
  email: Joi.string().email().lowercase().trim().optional(),
})
  // CRITICAL: Ensure at least one field is provided
  .min(1)
  .messages({
    "object.min":
      "At least one field (full_name or email) must be provided for update.",
  });

// =========================================================================
// 3. PATCH /role/:userId - Change Role
// =========================================================================

const changeRoleSchema = Joi.object({
  role_id: Joi.number().integer().positive().required().messages({
    "any.required": "Role ID is required to change user role.",
    "number.positive": "Role ID must be positive.",
  }),
});

// =========================================================================
// 4. PATCH /password/reset/:userId - Reset Password
// =========================================================================

const resetPasswordSchema = Joi.object({
  newPassword: Joi.string().pattern(passwordRegex).required().messages({
    "string.pattern.base":
      "New password must be at least 8 chars and include uppercase, lowercase, number, and special char.",
    "any.required": "New password is required.",
  }),
});

// =========================================================================
// 5. Parameter Validation (For :userId in routes)
// =========================================================================

const userIdSchema = Joi.object({
  userId: Joi.number().integer().positive().required(),
});

module.exports = {
  createUserSchema,
  updateUserSchema,
  changeRoleSchema,
  resetPasswordSchema,
  userIdSchema,
};
