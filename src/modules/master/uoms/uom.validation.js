// File: src/modules/master/uoms/uom.validation.js

const Joi = require("joi");

// =========================================================================
// VALIDATION SCHEMAS
// =========================================================================

/**
 * 1. POST / (Create New UOM) के लिए Body Validation
 */
const createUOMSchema = Joi.object({
  uom_code: Joi.string()
    .uppercase()
    .alphanum()
    .min(1)
    .max(10)
    .required()
    .label("UOM Code"),
  uom_name: Joi.string().min(2).max(50).required().label("UOM Name"),
});

/**
 * 2. PUT /:uomId (Update UOM) के लिए Body Validation
 */
const updateUOMSchema = Joi.object({
  uom_code: Joi.string()
    .uppercase()
    .alphanum()
    .min(1)
    .max(10)
    .optional()
    .label("UOM Code"),
  uom_name: Joi.string().min(2).max(50).optional().label("UOM Name"),
  is_active: Joi.boolean().optional().label("Is Active Status"),
})
  .min(1)
  .label("Update UOM Data");

module.exports = {
  createUOMSchema,
  updateUOMSchema,
};
