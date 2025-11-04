// File: src/modules/master/users/user.route.js

const express = require("express");
const router = express.Router();
// मिडलवेयर इम्पोर्ट करें
const { authenticate, authorize } = require("../../../middleware/auth");
const userController = require("./user.controller");

// =========================================================================
// Routes Definition
// =========================================================================

// इस मॉड्यूल के सभी रूट्स के लिए प्रमाणीकरण (Authentication) की आवश्यकता है।
router.use(authenticate);

// 1. GET /: Get All Users
// 2. POST /: Create New User
router
  .route("/")
  .get(authorize(["read:users", "admin"]), userController.getAllUsers)
  .post(authorize(["manage:users", "admin"]), userController.createUser);

// 3. GET /:userId: Get User by ID
// 4. PUT /:userId: Update User Details (Name/Status)
router
  .route("/:userId")
  .get(authorize(["read:users", "admin"]), userController.getUserById)
  .put(authorize(["manage:users", "admin"]), userController.updateUser);

// 5. PATCH /role/:userId: Change User Role (ACS CRITICAL)
router.patch(
  "/role/:userId",
  authorize(["manage:users", "admin"]),
  userController.changeUserRole
);

// 6. PATCH /password/:userId: Reset User Password (ACS CRITICAL)
router.patch(
  "/password/:userId",
  authorize(["manage:users", "admin"]),
  userController.resetUserPassword
);

// 7. PATCH /deactivate/:userId: Deactivate User (Soft Delete)
router.patch(
  "/deactivate/:userId",
  authorize(["manage:users", "admin"]),
  userController.deactivateUser
);

// 8. PATCH /activate/:userId: Activate User
router.patch(
  "/activate/:userId",
  authorize(["manage:users", "admin"]),
  userController.activateUser
);

module.exports = router;
