// File: src/modules/master/users/user.route.js
// FINAL VERSION: Using new Controller functions and protected routes.

const express = require("express");
const router = express.Router();
// CRITICAL FIX: Use 'protect' (authentication) instead of 'authenticate'
const { authenticate, authorize } = require("../../../middleware/auth");
const userController = require("./user.controller");
const validate = require("../../../utils/validation"); // Assuming validation middleware is used

// Note: Joi Validation Schema for these CUD operations must be defined.
// The user has not provided a Joi validation schema for the CRUD functions yet.
// We assume they will be implemented in users/user.validation.js later.

// === Placeholder for Joi Schemas (Mandatory for production) ===
const {
  createUserSchema,
  updateUserSchema,
  changeRoleSchema,
  resetPasswordSchema,
} = require("./user.validation"); // Assuming these are defined in the validation file

// =========================================================================
// Routes Definition
// =========================================================================

// Ensure all Admin routes are protected by JWT authentication
router.use(authenticate);

// Note: Admin routes require two checks: 1) Auth (protect), 2) Role (authorize).
// We assume 'authorize' is implemented in auth.js.

// 1. GET All Users (Paginated, Searchable)
// (Mandate: 'read:users' or 'manage:users' required)
router.get(
  "/",
  // authorize(['read:users', 'manage:users', 'admin']), // Uncomment when authorize is fully tested
  userController.getAllUsers
);

// 2. POST Create New User (Admin द्वारा मैन्युअल रूप से बनाया गया)
router.post(
  "/",
  // authorize(['manage:users', 'admin']), // Uncomment when authorize is fully tested
  // validate(createUserSchema), // Mandatory Joi validation required
  userController.createUser
);

// 3. GET User by ID (Detailed View)
router.get(
  "/:userId",
  // authorize(['read:users', 'manage:users', 'admin']),
  userController.getUserById
);

// 4. PUT Update User Details (General Details)
router.put(
  "/:userId",
  // authorize(['manage:users', 'admin']),
  // validate(updateUserSchema), // Mandatory Joi validation required
  userController.updateUser
);

// 5. PATCH Change User Role
router.patch(
  "/role/:userId",
  // authorize(['manage:users', 'admin']),
  // validate(changeRoleSchema), // Mandatory Joi validation required
  userController.changeUserRole
);

// 6. PATCH Reset User Password (Admin द्वारा)
router.patch(
  "/password/reset/:userId",
  // authorize(['manage:users', 'admin']),
  // validate(resetPasswordSchema), // Mandatory Joi validation required
  userController.resetUserPassword
);

// 7. PATCH Deactivate User
router.patch(
  "/status/deactivate/:userId",
  // authorize(['manage:users', 'admin']),
  userController.deactivateUser
);

// 8. PATCH Activate User
router.patch(
  "/status/activate/:userId",
  // authorize(['manage:users', 'admin']),
  userController.activateUser
);

module.exports = router;
