// File: src/modules/master/roles/role.controller.js

const asyncHandler = require("../../../utils/asyncHandler");
const APIError = require("../../../utils/errorHandler"); // CustomError क्लास
const roleService = require("./role.service");
const {
  createRoleSchema,
  updateRoleSchema,
  updateRolePermissionsSchema,
} = require("./role.validation");

// =========================================================================
// SYNCHRONOUS VALIDATION UTILITY (Controller Logic)
// =========================================================================
const syncValidateSchema = (schema, data) => {
  if (!schema || typeof schema.validate !== "function") {
    throw new APIError("Internal Validation Schema Missing.", 500, [
      "Developer Error: Validation schema not passed or is invalid.",
    ]);
  }

  const options = {
    abortEarly: false,
    allowUnknown: true,
    stripUnknown: true,
  };

  const { error, value } = schema.validate(data, options);

  if (error) {
    const errors = error.details.map((detail) => detail.message);
    throw new APIError("Validation Failed", 400, errors);
  }
  return value; // Validated data return करें
};

// =========================================================================
// CONTROLLER FUNCTIONS
// =========================================================================

/** 1. GET /: Get All Roles and their Permissions */
const getAllRoles = asyncHandler(async (req, res) => {
  const { limit = 10, page = 1 } = req.query;
  const result = await roleService.getAllRoles({
    limit: parseInt(limit),
    page: parseInt(page),
  });
  res.status(200).json({
    message: "Roles fetched successfully.",
    data: result.data,
    total_count: result.total_count,
  });
});

/** 2. POST /: Create New Role */
const createRole = asyncHandler(async (req, res) => {
  // 1. Validation
  const data = syncValidateSchema(createRoleSchema, req.body);

  // 2. Service Call
  const newRole = await roleService.createRole(data);

  // 3. Response
  res.status(201).json({
    message: `Role '${newRole.role_name}' created successfully.`,
    data: newRole,
  });
});

/** 3. GET /:roleId: Get Role by ID */
const getRoleById = asyncHandler(async (req, res) => {
  const roleId = parseInt(req.params.roleId);
  if (isNaN(roleId) || roleId <= 0) {
    return res.status(400).json({ message: "Invalid Role ID provided." });
  }

  const role = await roleService.getRoleById(roleId);
  if (!role) {
    return res
      .status(404)
      .json({ message: `Role with ID ${roleId} not found.` });
  }
  res.status(200).json({
    message: "Role details fetched successfully.",
    data: role,
  });
});

/** 4. PUT /:roleId: Update Role Name/Description */
const updateRole = asyncHandler(async (req, res) => {
  const roleId = parseInt(req.params.roleId);
  if (isNaN(roleId) || roleId <= 0) {
    return res.status(400).json({ message: "Invalid Role ID provided." });
  }

  // 1. Validation
  const data = syncValidateSchema(updateRoleSchema, req.body);

  // 2. Service Call
  const updatedRole = await roleService.updateRole(roleId, data);

  // 3. Response
  if (!updatedRole) {
    return res.status(404).json({
      message: `Role with ID ${roleId} not found or no change applied.`,
    });
  }
  res.status(200).json({
    message: "Role updated successfully.",
    data: updatedRole,
  });
});

/** 5. GET /permissions/all: Get All Available Permissions */
const getAllPermissions = asyncHandler(async (req, res) => {
  const permissions = await roleService.getAllPermissions();
  res.status(200).json({
    message: "All available permissions fetched successfully.",
    data: permissions,
  });
});

/** 6. PATCH /permissions/:roleId: Assign/Revoke Permissions */
const updateRolePermissions = asyncHandler(async (req, res) => {
  const roleId = parseInt(req.params.roleId);
  if (isNaN(roleId) || roleId <= 0) {
    return res.status(400).json({ message: "Invalid Role ID provided." });
  }

  // 1. Validation
  const { permissionKeys } = syncValidateSchema(
    updateRolePermissionsSchema,
    req.body
  );

  // 2. Service Call
  const updatedRole = await roleService.updateRolePermissions(
    roleId,
    permissionKeys
  );

  // 3. Response
  if (!updatedRole) {
    return res.status(404).json({
      message: `Role with ID ${roleId} not found for permission assignment.`,
    });
  }

  res.status(200).json({
    message: `Permissions successfully assigned/updated for role ID ${roleId}.`,
    data: updatedRole,
  });
});

module.exports = {
  getAllRoles,
  getRoleById,
  createRole,
  updateRole,
  getAllPermissions,
  updateRolePermissions,
};
