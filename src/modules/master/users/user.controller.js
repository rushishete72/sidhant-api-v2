// File: src/modules/master/users/user.controller.js
// FINAL VERSION: Rewritten to use asyncHandler and UserService.

const asyncHandler = require("../../../utils/asyncHandler");
const UserService = require("./user.service");
const CustomError = require("../../../utils/errorHandler");

// Helper function to simplify ID validation and ensure integer type
const handleIdValidation = (id, paramName = "ID") => {
  const parsedId = parseInt(id, 10);
  if (isNaN(parsedId) || parsedId <= 0) {
    throw new CustomError(
      `अमान्य (Invalid) ${paramName} URL में प्रदान किया गया है।`,
      400
    );
  }
  return parsedId;
};

// =========================================================================
// A. CORE CRUD & STATUS MANAGEMENT CONTROLLERS
// =========================================================================

/** 1. POST / Create New User (Admin Panel के लिए) */
const createUser = asyncHandler(async (req, res) => {
  const { email, full_name, password, role_id } = req.body;
  const creatorId = req.user.user_id;

  // Validation is done by Joi, but we keep the logic clean
  const newUser = await UserService.createUserByAdmin(req.body, creatorId);

  return res.status(201).json({
    message: `उपयोगकर्ता '${newUser.email}' सफलतापूर्वक बन गया।`,
    data: newUser,
  });
});

/** 2. GET /:userId - ID द्वारा उपयोगकर्ता को प्राप्त करता है। */
const getUserById = asyncHandler(async (req, res) => {
  const userId = handleIdValidation(req.params.userId, "User ID");

  const user = await UserService.fetchUserById(userId);

  return res.status(200).json({ data: user });
});

/** 3. GET / - सभी उपयोगकर्ताओं को प्राप्त करता है (Paginated)। */
const getAllUsers = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 25;
  const search = req.query.search;
  const isActive =
    req.query.isActive === "false"
      ? false
      : req.query.isActive === "true"
      ? true
      : undefined;
  const isVerified =
    req.query.isVerified === "false"
      ? false
      : req.query.isVerified === "true"
      ? true
      : undefined;
  const offset = (page - 1) * limit;

  const { data: users, total_count } = await UserService.fetchAllUsers({
    limit,
    offset,
    search,
    is_active: isActive,
    is_verified: isVerified,
  });

  const totalPages = Math.ceil(total_count / limit);

  return res.status(200).json({
    message: "Master Users retrieved successfully.",
    pagination: {
      total_records: total_count,
      total_pages: totalPages,
      current_page: page,
      limit: limit,
    },
    data: users,
  });
});

/** 4. PUT /:userId - उपयोगकर्ता डेटा को अपडेट करता है (General). */
const updateUser = asyncHandler(async (req, res) => {
  const userId = handleIdValidation(req.params.userId, "User ID");

  // Joi validation handles data cleansing; we just use the body.
  const updatedUser = await UserService.updateCoreUserDetails(userId, req.body);

  return res.status(200).json({
    message: `उपयोगकर्ता '${updatedUser.email}' सफलतापूर्वक अपडेट हुआ।`,
    data: updatedUser,
  });
});

/** 5. PATCH /role/:userId - उपयोगकर्ता की भूमिका (Role) बदलता है। */
const changeUserRole = asyncHandler(async (req, res) => {
  const userId = handleIdValidation(req.params.userId, "User ID");
  const { role_id } = req.body;

  const updatedUser = await UserService.changeUserRole(userId, Number(role_id));

  return res.status(200).json({
    message: `उपयोगकर्ता '${updatedUser.email}' की भूमिका सफलतापूर्वक अपडेट हुई।`,
    data: updatedUser,
  });
});

/** 6. PATCH /password/reset/:userId - उपयोगकर्ता का पासवर्ड रीसेट करता है। (Admin द्वारा) */
const resetUserPassword = asyncHandler(async (req, res) => {
  const userId = handleIdValidation(req.params.userId, "User ID");
  const { newPassword } = req.body;

  const result = await UserService.resetUserPassword(userId, newPassword);

  return res.status(200).json({
    message: `उपयोगकर्ता (ID: ${result.user_id}) का पासवर्ड सफलतापूर्वक रीसेट किया गया।`,
    data: result,
  });
});

/** 7. PATCH /status/deactivate/:userId - उपयोगकर्ता को निष्क्रिय (Deactivate) करता है। */
const deactivateUser = asyncHandler(async (req, res) => {
  const userId = handleIdValidation(req.params.userId, "User ID");

  const deactivated = await UserService.updateStatus(userId, false);

  return res.status(200).json({
    message: `उपयोगकर्ता (ID: ${userId}) सफलतापूर्वक निष्क्रिय किया गया।`,
    data: {
      user_id: deactivated.user_id,
      email: deactivated.email,
      is_active: deactivated.is_active,
    },
  });
});

/** 8. PATCH /status/activate/:userId - उपयोगकर्ता को पुनः सक्रिय (Activate) करता है। */
const activateUser = asyncHandler(async (req, res) => {
  const userId = handleIdValidation(req.params.userId, "User ID");

  const activated = await UserService.updateStatus(userId, true);

  return res.status(200).json({
    message: `उपयोगकर्ता (ID: ${userId}) सफलतापूर्वक सक्रिय किया गया।`,
    data: {
      user_id: activated.user_id,
      email: activated.email,
      is_active: activated.is_active,
    },
  });
});

module.exports = {
  createUser,
  getUserById,
  getAllUsers,
  updateUser,
  changeUserRole,
  resetUserPassword,
  deactivateUser,
  activateUser,
};
