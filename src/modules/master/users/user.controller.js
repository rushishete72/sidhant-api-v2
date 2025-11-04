// File: src/modules/master/users/user.controller.js

const asyncHandler = require("../../../utils/asyncHandler");
const APIError = require("../../../utils/errorHandler");
const userService = require("./user.service");
const {
  createUserSchema,
  updateUserSchema,
  changeUserRoleSchema,
  resetUserPasswordSchema,
} = require("./user.validation");

// [NOTE]: Reusing the syncValidateSchema helper defined in role.controller.js
const syncValidateSchema = (schema, data) => {
  if (!schema || typeof schema.validate !== "function") {
    throw new APIError("Internal Validation Schema Missing.", 500);
  }
  const options = { abortEarly: false, allowUnknown: true, stripUnknown: true };
  const { error, value } = schema.validate(data, options);
  if (error) {
    const errors = error.details.map((detail) => detail.message);
    throw new APIError("Validation Failed", 400, errors);
  }
  return value;
};

// =========================================================================
// CONTROLLER FUNCTIONS
// =========================================================================

/** 1. POST /: Create New User (Permission: 'manage:users') */
const createUser = asyncHandler(async (req, res) => {
  const data = syncValidateSchema(createUserSchema, req.body);
  const newUser = await userService.createUser(data);

  // Security: Response से password hash हटाएँ
  delete newUser.password_hash;

  res.status(201).json({
    message: `User '${newUser.email}' created and role assigned successfully.`,
    data: newUser,
  });
});

/** 2. GET /: Get All Users (Permission: 'read:users') */
const getAllUsers = asyncHandler(async (req, res) => {
  const { limit = 10, page = 1 } = req.query;
  const result = await userService.getAllUsers({
    limit: parseInt(limit),
    page: parseInt(page),
  });
  res.status(200).json({
    message: "Users fetched successfully.",
    data: result.data,
    total_count: result.total_count,
  });
});

/** 3. GET /:userId: Get User by ID (Permission: 'read:users') */
const getUserById = asyncHandler(async (req, res) => {
  const userId = parseInt(req.params.userId);
  const user = await userService.getUserById(userId);

  if (!user) {
    return res
      .status(404)
      .json({ message: `User with ID ${userId} not found.` });
  }
  delete user.password_hash;
  res
    .status(200)
    .json({ message: "User details fetched successfully.", data: user });
});

/** 4. PUT /:userId: Update User Details (Name/Status) (Permission: 'manage:users') */
const updateUser = asyncHandler(async (req, res) => {
  const userId = parseInt(req.params.userId);
  const data = syncValidateSchema(updateUserSchema, req.body);

  const updatedUser = await userService.updateUser(userId, data);

  if (!updatedUser) {
    return res
      .status(404)
      .json({ message: `User with ID ${userId} not found.` });
  }
  delete updatedUser.password_hash;
  res
    .status(200)
    .json({ message: "User updated successfully.", data: updatedUser });
});

/** 5. PATCH /role/:userId: Change User Role (Permission: 'manage:users') */
const changeUserRole = asyncHandler(async (req, res) => {
  const userId = parseInt(req.params.userId);
  const { role_id } = syncValidateSchema(changeUserRoleSchema, req.body);

  const updatedUser = await userService.changeUserRole(userId, role_id);

  if (!updatedUser) {
    return res
      .status(404)
      .json({ message: `User ID ${userId} या Role ID ${role_id} नहीं मिला।` });
  }
  delete updatedUser.password_hash;
  res
    .status(200)
    .json({
      message: `Role ID ${role_id} successfully assigned to User ID ${userId}.`,
      data: updatedUser,
    });
});

/** 6. PATCH /password/:userId: Reset User Password (Permission: 'manage:users') */
const resetUserPassword = asyncHandler(async (req, res) => {
  const userId = parseInt(req.params.userId);
  const { new_password } = syncValidateSchema(
    resetUserPasswordSchema,
    req.body
  );

  const updatedUser = await userService.resetUserPassword(userId, new_password);

  if (!updatedUser) {
    return res
      .status(404)
      .json({ message: `User with ID ${userId} not found.` });
  }

  res
    .status(200)
    .json({
      message: `Password successfully reset for User ID ${userId}.`,
      data: updatedUser,
    });
});

/** 7. PATCH /deactivate/:userId: Deactivate User (Permission: 'manage:users') */
const deactivateUser = asyncHandler(async (req, res) => {
  const userId = parseInt(req.params.userId);
  const updatedUser = await userService.deactivateUser(userId);

  if (!updatedUser) {
    return res
      .status(404)
      .json({ message: `User with ID ${userId} not found.` });
  }
  delete updatedUser.password_hash;
  res
    .status(200)
    .json({
      message: `User ID ${userId} deactivated successfully.`,
      data: updatedUser,
    });
});

/** 8. PATCH /activate/:userId: Activate User (Permission: 'manage:users') */
const activateUser = asyncHandler(async (req, res) => {
  const userId = parseInt(req.params.userId);
  const updatedUser = await userService.activateUser(userId);

  if (!updatedUser) {
    return res
      .status(404)
      .json({ message: `User with ID ${userId} not found.` });
  }
  delete updatedUser.password_hash;
  res
    .status(200)
    .json({
      message: `User ID ${userId} activated successfully.`,
      data: updatedUser,
    });
});

module.exports = {
  createUser,
  getAllUsers,
  getUserById,
  updateUser,
  changeUserRole,
  resetUserPassword,
  deactivateUser,
  activateUser,
};
