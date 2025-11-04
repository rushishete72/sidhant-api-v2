// File: src/modules/master/roles/role.validation.js

const Joi = require("joi");

// =========================================================================
// VALIDATION SCHEMAS
// =========================================================================

/**
 * 1. POST / (Create New Role) के लिए Body Validation
 */
const createRoleSchema = Joi.object({
  role_name: Joi.string().min(2).max(50).required().label("Role Name"),
  description: Joi.string()
    .max(255)
    .optional()
    .allow(null, "")
    .label("Description"),
});

/**
 * 2. PUT /:roleId (Update Role Name/Description) के लिए Body Validation
 */
const updateRoleSchema = Joi.object({
  role_name: Joi.string().min(2).max(50).optional().label("Role Name"),
  description: Joi.string()
    .max(255)
    .optional()
    .allow(null, "")
    .label("Description"),
})
  .min(1) // सुनिश्चित करें कि अपडेट करने के लिए कम से कम एक फ़ील्ड प्रदान किया गया है।
  .label("Update Role Data");

/**
 * 3. PATCH /permissions/:roleId (Assign/Revoke Permissions) के लिए Body Validation
 */
const updateRolePermissionsSchema = Joi.object({
  permissionKeys: Joi.array()
    .items(Joi.string().min(3).max(50).label("Permission Key"))
    .min(0) // Empty array [] की अनुमति दें ताकि सभी permissions को हटाया जा सके (Revoke all)।
    .max(100)
    .unique()
    .required()
    .label("Permission Keys Array"),
});

module.exports = {
  createRoleSchema,
  updateRoleSchema,
  updateRolePermissionsSchema,
};
