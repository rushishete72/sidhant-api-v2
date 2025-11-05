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

router.get("/", authorize(["read:roles", "admin"]), roleController.getAllRoles);
router.post(
  "/",
  authorize(["manage:roles", "admin"]),
  roleController.createRole
);

// 3. GET Role by ID (Detailed View)
// 4. PUT Update Role Name/Description
router.put(
  "/:roleId",
  authorize(["manage:roles", "admin"]),
  roleController.updateRole
);

// 5. GET All Available Permissions (List for UI)
// ✅ 7. POST Create New Permission
router
  .route("/permissions") // New route definition
  .get(
    authorize(["read:permissions", "admin"]),
    roleController.getAllPermissions
  )
  .post(
    authorize(["manage:permissions", "admin"]),
    roleController.createPermission
  ); // ✅ NEW ROUTE

// 6. PATCH Assign/Revoke Permissions for a Role
router.patch(
  "/permissions/:roleId",
  authorize(["manage:roles", "admin"]),
  roleController.updateRolePermissions
);

module.exports = router;
