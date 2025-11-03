// File: src/utils/validation.js

const CustomError = require("./errorHandler");

/**
 * Generic validation middleware for Joi schemas.
 * Uses options to allow unknown fields (req.user, req.query, etc.)
 * @param {Joi.ObjectSchema} schema - The Joi schema to validate against.
 * @param {string} source - The source of data to validate ('body', 'query', 'params').
 */
const validate =
  (schema, source = "body") =>
  (req, res, next) => {
    // We allow unknown fields in the object being validated, which is useful
    // for fields like 'req.user' or extra query/header parameters.
    const options = {
      abortEarly: false, // Include all errors
      allowUnknown: true,
      stripUnknown: true, // Remove unknown properties
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

module.exports = { validate };
