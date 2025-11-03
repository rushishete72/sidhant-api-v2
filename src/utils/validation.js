// File: src/utils/validation.js (Target: sidhant-api-v2)

// CustomError is still imported for conceptual completeness,
// but is not used in the final throw to allow the raw Joi error to pass.
const CustomError = require("./errorHandler");

/**
 * @function validate
 * @description
 * Generic validation middleware for Joi schemas. Throws the raw Joi error
 * object, allowing the global errorHandler to process and format it.
 * @param {Joi.ObjectSchema} schema - The Joi schema to validate against.
 * @param {string} source - The source of data to validate ('body', 'query', 'params').
 * @returns {function} - Express middleware function.
 */
const validate =
  (schema, source = "body") =>
  (req, res, next) => {
    // This uses Joi's standard options for robust validation in CSM architecture.
    const options = {
      abortEarly: false, // Include all errors (CRITICAL for good UX)
      allowUnknown: true, // Allow fields not in the schema (e.g., req.user, req.token)
      stripUnknown: true, // Remove unknown properties to keep the request body clean (CRITICAL for security)
    };

    const { error, value } = schema.validate(req[source], options);

    if (error) {
      // BREAKING THE ERROR LOOP:
      // We throw the original Joi error object directly, not a wrapped CustomError.
      // This allows the global errorHandler.js (which checks for err.isJoi) to
      // extract path and clean messages, preventing recurring vague 400 errors.
      throw error;
    }

    // Replace the request object data with the validated and stripped value
    req[source] = value;
    next();
  };

module.exports = { validate };
