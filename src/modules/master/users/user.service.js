// File: src/modules/master/users/user.service.js (AUDIT FIX)

const bcrypt = require("bcryptjs"); // Hashing library
const userModel = require("./user.model");
const APIError = require("../../../utils/errorHandler");

const SALT_ROUNDS = 10;

// =========================================================================
// SERVICE LAYER: Business Logic & Hashing
// =========================================================================

/** 1. एक नया उपयोगकर्ता (User) बनाता है। */
const createUser = async (data) => {
  // 1. Password Hash करें (Security Mandate)
  const hashedPassword = await bcrypt.hash(data.password, SALT_ROUNDS);

  // 2. Data तैयार करें (created_by_user_id अब data object से सीधे पास हो जाएगा)
  const userData = {
    full_name: data.full_name,
    email: data.email,
    password_hash: hashedPassword,
    role_id: data.role_id,
    created_by_user_id: data.created_by_user_id, // ✅ AUDIT FIELD PASSED
  };

  // 3. Model में डालें
  return userModel.createUser(userData);
};

/** 2. ID द्वारा उपयोगकर्ता प्राप्त करें। */
const getUserById = async (userId) => {
  return userModel.getUserById(userId);
};

/** 3. सभी उपयोगकर्ताओं को प्राप्त करता है। */
const getAllUsers = async ({ page, limit }) => {
  const offset = (page - 1) * limit;
  return userModel.getAllUsers({ limit, offset });
};

/** 4. उपयोगकर्ता का नाम/status अपडेट करें। */
const updateUser = async (userId, data) => {
  // Model layer अपडेट को संभालता है
  return userModel.updateUser(userId, data);
};

/** 5. उपयोगकर्ता की भूमिका (Role) बदलें। (changeUserRole) */
const changeUserRole = async (userId, roleId, updated_by_user_id) => { // ✅ updated_by_user_id प्राप्त करें
  const data = { role_id: roleId, updated_by_user_id: updated_by_user_id }; // ✅ AUDIT FIELD PASSED
  const updatedUser = await userModel.updateUser(userId, data);

  if (!updatedUser) { return null; }
  return updatedUser;
};

/** 6. उपयोगकर्ता पासवर्ड रीसेट करें। */
const resetUserPassword = async (userId, newPassword, updated_by_user_id) => { // ✅ updated_by_user_id प्राप्त करें
  // 1. Password Hash करें (Security Mandate)
  const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);

  // 2. Model को अपडेट के लिए कॉल करें
  const updatedUser = await userModel.updateUser(userId, {
    password_hash: hashedPassword,
    updated_by_user_id: updated_by_user_id // ✅ AUDIT FIELD PASSED
  });

  if (!updatedUser) { return null; }

  delete updatedUser.password_hash;
  return updatedUser;
};

/** 7. उपयोगकर्ता को निष्क्रिय (deactivate) करें। */
const deactivateUser = async (userId, updated_by_user_id) => { // ✅ updated_by_user_id प्राप्त करें
  return userModel.updateUser(userId, { is_active: false, updated_by_user_id: updated_by_user_id }); // ✅ AUDIT FIELD PASSED
};

/** 8. उपयोगकर्ता को सक्रिय (activate) करें। */
const activateUser = async (userId, updated_by_user_id) => { // ✅ updated_by_user_id प्राप्त करें
  return userModel.updateUser(userId, { is_active: true, updated_by_user_id: updated_by_user_id }); // ✅ AUDIT FIELD PASSED
};

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