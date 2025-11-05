// File: src/modules/master/uoms/uom.controller.js (FINAL FIX: Audit Field Injection)

const asyncHandler = require("../../../utils/asyncHandler");
const APIError = require("../../../utils/errorHandler");
const uomService = require("./uom.service");
const { createUOMSchema, updateUOMSchema } = require("./uom.validation");

// [NOTE]: syncValidateSchema helper
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

/** 1. GET /: Get All UOMs (Permission: 'read:master') */
const getAllUOMs = asyncHandler(async (req, res) => {
  const { limit = 10, page = 1 } = req.query;
  const result = await uomService.getAllUOMs({
    limit: parseInt(limit),
    page: parseInt(page),
  });
  res.status(200).json({
    message: "UOMs fetched successfully.",
    data: result.data,
    total_count: result.total_count,
  });
});

/** 2. GET /:uomId: Get UOM by ID (Permission: 'read:master') */
const getUOMById = asyncHandler(async (req, res) => {
  const uomId = parseInt(req.params.uomId);
 
  
  if (isNaN(uomId) || uomId <= 0) {
    return res.status(400).json({ message: "Invalid UOM ID provided." });
  }

  const uom = await uomService.getUOMById(uomId);
  if (!uom) {
    return res.status(404).json({ message: `UOM with ID ${uomId} not found.` });
  }
  res.status(200).json({
    message: "UOM details fetched successfully.",
    data: uom,
  });
});

/** 3. POST /: Create New UOM (Permission: 'manage:master') */
const createUOM = asyncHandler(async (req, res) => {
  // 1. Validation
  const data = syncValidateSchema(createUOMSchema, req.body);

  // ✅ CRITICAL AUDIT FIX: Created By User ID Inject करें
  if (req.user && req.user.user_id) {
    data.created_by_user_id = req.user.user_id;
  }

  // 2. Service Call
  const newUOM = await uomService.createUOM(data);

  // 3. Response
  res.status(201).json({
    message: `UOM '${newUOM.uom_code}' created successfully.`,
    data: newUOM,
  });
});

/** 4. PUT /:uomId: Update UOM (Permission: 'manage:master') */
const updateUOM = asyncHandler(async (req, res) => {
  const uomId = parseInt(req.params.uomId);
  if (isNaN(uomId) || uomId <= 0) {
    return res.status(400).json({ message: "Invalid UOM ID provided." });
  }

  // 1. Validation
  const data = syncValidateSchema(updateUOMSchema, req.body);

  // ✅ CRITICAL AUDIT FIX: Updated By User ID Inject करें
  if (req.user && req.user.user_id) {
    data.updated_by_user_id = req.user.user_id;
  }

  // 2. Service Call
  const updatedUOM = await uomService.updateUOM(uomId, data);

  // 3. Response
  if (!updatedUOM) {
    return res
      .status(404)
      .json({
        message: `UOM with ID ${uomId} not found or no change applied.`,
      });
  }
  res.status(200).json({
    message: "UOM updated successfully.",
    data: updatedUOM,
  });
});

module.exports = {
  getAllUOMs,
  getUOMById,
  createUOM,
  updateUOM,
};
