// File: src/utils/validation.js
// CRITICAL FIX: Changed to direct/default export to resolve 'validate is not a function' error.

const CustomError = require("./errorHandler");

/**
 * Generic validation middleware for Joi schemas.
 * @param {Joi.ObjectSchema} schema - The Joi schema to validate against.
 * @param {string} source - The source of data to validate ('body', 'query', 'params').
 */
const validate =
  (schema, source = "body") =>
  (req, res, next) => {
    const options = {
      abortEarly: false,
      allowUnknown: true,
      stripUnknown: true,
    };

    const { error, value } = schema.validate(req[source], options);

    if (error) {
      const errors = error.details.map((detail) => detail.message);
      // Throw a 400 Bad Request error with validation details
      throw new CustomError("Validation Failed", 400, errors);
    }

    // Replace the request object data with the validated and stripped value
    req[source] = value;
    next();
  };

module.exports = validate; // <-- FIX: Export the function directly (default export)
