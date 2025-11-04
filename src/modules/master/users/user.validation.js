// File: src/modules/master/users/user.validation.js

const Joi = require("joi");

// =========================================================================
// VALIDATION SCHEMAS
// =========================================================================

/**
 * 1. POST / (Create New User) के लिए Body Validation
 */
const createUserSchema = Joi.object({
  full_name: Joi.string().min(2).max(100).required().label("Full Name"),
  email: Joi.string().email().max(100).required().label("Email"),
  password: Joi.string().min(8).max(255).required().label("Password"),
  role_id: Joi.number() // Admin Panel द्वारा role_id असाइन करना आवश्यक है
    .integer()
    .positive()
    .required()
    .label("Role ID"),
});

/**
 * 2. PUT /:userId (Update User Details) के लिए Body Validation
 */
const updateUserSchema = Joi.object({
  full_name: Joi.string().min(2).max(100).optional().label("Full Name"),
  is_active: Joi.boolean().optional().label("Is Active Status"),
  is_verified: Joi.boolean().optional().label("Is Verified Status"),
})
  .min(1)
  .label("Update User Data");

/**
 * 3. PATCH /role/:userId (Change User Role) के लिए Body Validation
 */
const changeUserRoleSchema = Joi.object({
  role_id: Joi.number().integer().positive().required().label("Role ID"),
});

/**
 * 4. PATCH /password/:userId (Reset User Password) के लिए Body Validation
 */
const resetUserPasswordSchema = Joi.object({
  new_password: Joi.string().min(8).max(255).required().label("New Password"),
});

module.exports = {
  createUserSchema,
  updateUserSchema,
  changeUserRoleSchema,
  resetUserPasswordSchema,
};
