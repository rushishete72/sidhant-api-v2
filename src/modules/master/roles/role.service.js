// File: src/modules/master/roles/role.service.js

const roleModel = require("./role.model");

// =========================================================================
// SERVICE LAYER: Business Logic Abstraction
// =========================================================================

/** 1. सभी भूमिकाओं और उनके अनुमतियों को प्राप्त करता है। */
const getAllRoles = async ({ page, limit }) => {
  // Controller से प्राप्त pagination parameters को Model के लिए तैयार करें
  const offset = (page - 1) * limit;
  return roleModel.getAllRoles({ limit, offset });
};

/** 2. ID द्वारा भूमिका को प्राप्त करता है। */
const getRoleById = async (roleId) => {
  return roleModel.getRoleById(roleId);
};

/** 3. एक नई भूमिका बनाता है। */
const createRole = async (data) => {
  return roleModel.createRole(data);
};

/** 4. भूमिका का नाम/विवरण अपडेट करता है। */
const updateRole = async (roleId, data) => {
  return roleModel.updateRole(roleId, data);
};

/** 5. सभी उपलब्ध अनुमतियों को प्राप्त करता है। */
const getAllPermissions = async () => {
  return roleModel.getAllPermissions();
};

/** 6. भूमिका के लिए अनुमतियों को असाइन/रद्द करता है। (ACS CRITICAL) */
const updateRolePermissions = async (roleId, permissionKeys) => {
  return roleModel.updateRolePermissions(roleId, permissionKeys);
};

module.exports = {
  getAllRoles,
  getRoleById,
  createRole,
  updateRole,
  getAllPermissions,
  updateRolePermissions,
};
