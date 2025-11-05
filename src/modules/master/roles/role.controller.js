// File: src/modules/master/roles/role.controller.js (FINAL AUDIT FIX)

const asyncHandler = require("../../../utils/asyncHandler");
const APIError = require("../../../utils/errorHandler"); // CustomError क्लास
const roleService = require("./role.service");
const {
  createRoleSchema,
  updateRoleSchema,
  updateRolePermissionsSchema,
  createPermissionSchema,
  updatePermissionSchema,
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

  // ✅ CRITICAL AUDIT FIX: Created By User ID Inject करें
  if (req.user && req.user.user_id) {
    data.created_by_user_id = req.user.user_id;
  }

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

  // ✅ CRITICAL AUDIT FIX: Updated By User ID Inject करें
  if (req.user && req.user.user_id) {
    data.updated_by_user_id = req.user.user_id;
  }

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

/** 7. POST /permissions: Create New Permission (Permission: 'manage:permissions') */
const createPermission = asyncHandler(async (req, res) => {
  // 1. Validation
  const data = syncValidateSchema(createPermissionSchema, req.body);

  // ✅ CRITICAL AUDIT FIX: Created By User ID Inject करें
  if (req.user && req.user.user_id) {
    data.created_by_user_id = req.user.user_id;
  }

  // 2. Service Call
  const newPermission = await roleService.createPermission(data);

  // 3. Response
  res.status(201).json({
    message: `Permission '${newPermission.permission_key}' created successfully.`,
    data: newPermission,
  });
});


/** 8. ✅ FINAL FIX: PUT /permissions/:permissionKey: अनुमति का विवरण/कुंजी अपडेट करें। */
const updatePermission = asyncHandler(async (req, res) => {
  const oldPermissionKey = req.params.permissionKey;

  // 1. Validation (Key और Description दोनों के लिए)
  const data = syncValidateSchema(updatePermissionSchema, req.body);
  
  if (Object.keys(data).length === 0) {
      return res.status(400).json({ message: "अपडेट के लिए कम से कम एक फ़ील्ड (Permission Key या Description) प्रदान करें।" });
  }

  // 2. CRITICAL AUDIT: Updated By User ID Inject करें
  if (req.user && req.user.user_id) {
    data.updated_by_user_id = req.user.user_id;
  }

  // 3. Service Call (oldPermissionKey का उपयोग WHERE condition के लिए किया जाता है)
  const updatedPermission = await roleService.updatePermission(oldPermissionKey, data);

  // 4. Response
  if (!updatedPermission) {
    return res.status(404).json({
      message: `Permission Key '${oldPermissionKey}' नहीं मिली या कोई अपडेट लागू नहीं हुआ।`,
    });
  }

  res.status(200).json({
    message: `Permission Key '${updatedPermission.permission_key}' सफलतापूर्वक अपडेट किया गया।`,
    data: updatedPermission,
  });
});

module.exports = {
  getAllRoles,
  getRoleById,
  createRole,
  updateRole,
  getAllPermissions,
  updateRolePermissions,
  createPermission,
  updatePermission,
};