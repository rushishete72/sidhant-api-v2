// File: src/modules/master/roles/role.route.js

/*
 * Context Note: यह 'roles' और 'permissions' टेबल के लिए API routes को परिभाषित करता है।
 */
const express = require("express");
const router = express.Router();
// मिडलवेयर इम्पोर्ट करें
const { authenticate, authorize } = require("../../../middleware/auth");
const roleController = require("./role.controller");

// =========================================================================
// Routes Definition
// =========================================================================

// इस मॉड्यूल के सभी रूट्स के लिए प्रमाणीकरण (Authentication) की आवश्यकता है।
router.use(authenticate);

// 1. GET All Roles and their Permissions (Detailed List)
// (अनुमति: 'read:roles' की आवश्यकता है)
router.get("/", authorize(["read:roles", "admin"]), roleController.getAllRoles);

// 2. POST Create New Role
// (अनुमति: 'manage:roles' की आवश्यकता है)
router.post(
  "/",
  authorize(["manage:roles", "admin"]),
  roleController.createRole
);

// 3. GET Role by ID (Detailed View)
// (अनुमति: 'read:roles' की आवश्यकता है)
router.get(
  "/:roleId",
  authorize(["read:roles", "admin"]),
  roleController.getRoleById
);

// 4. PUT Update Role Name/Description
// (अनुमति: 'manage:roles' की आवश्यकता है)
router.put(
  "/:roleId",
  authorize(["manage:roles", "admin"]),
  roleController.updateRole
);

// 5. GET All Available Permissions (List for UI)
// (अनुमति: 'read:permissions' की आवश्यकता है)
router.get(
  "/permissions/all",
  authorize(["read:permissions", "admin"]),
  roleController.getAllPermissions
);

// 6. PATCH Assign/Revoke Permissions for a Role
// (अनुमति: 'manage:roles' की आवश्यकता है)
router.patch(
  "/permissions/:roleId",
  authorize(["manage:roles", "admin"]),
  roleController.updateRolePermissions
);

module.exports = router;
