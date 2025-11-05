// File: src/modules/master/uoms/uom.service.js

const uomModel = require("./uom.model");

// =========================================================================
// SERVICE LAYER
// =========================================================================

/** 1. सभी UOMs को प्राप्त करता है। */
const getAllUOMs = async ({ page, limit }) => {
  const offset = (page - 1) * limit;
  return uomModel.getAllUOMs({ limit, offset });
};

/** 2. ID द्वारा UOM प्राप्त करता है। */
const getUOMById = async (uomId) => {
  return uomModel.getUOMById(uomId);
};

/** 3. एक नया UOM बनाता है। (इसमें अब created_by_user_id शामिल है) */
const createUOM = async (data) => {
  return uomModel.createUOM(data);
};

/** 4. UOM अपडेट करता है। (इसमें अब updated_by_user_id शामिल है) */
const updateUOM = async (uomId, data) => {
  return uomModel.updateUOM(uomId, data);
};

module.exports = {
  getAllUOMs,
  getUOMById,
  createUOM,
  updateUOM,
};
