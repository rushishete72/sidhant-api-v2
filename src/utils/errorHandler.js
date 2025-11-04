// File: src/utils/errorHandler.js

/**
 * Custom Error class for structured API errors.
 * It uses the 'isOperational' flag to distinguish between expected errors (4xx)
 * and unhandled programming errors (5xx).
 */
class CustomError extends Error {
  constructor(message, statusCode = 500, details = null) {
    // Call the parent constructor (Error)
    super(message);

    this.statusCode = statusCode;
    // 'fail' for operational errors (4xx), 'error' for server errors (5xx)
    this.status = statusCode >= 400 && statusCode < 500 ? "fail" : "error";
    // Operational errors are those we anticipate (e.g., Validation, Not Found, Auth failure)
    this.isOperational = true;
    this.details = details;

    // Capturing the stack trace helps in debugging where the error was instantiated.
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Global Error Handler Middleware.
 * This function is the final stop for all errors and formats the response.
 */
const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.statusCode = err.statusCode || 500;
  error.status =
    error.status ||
    (error.statusCode >= 400 && error.statusCode < 500 ? "fail" : "error");
  error.message = err.message || "A fatal server error occurred.";

  // --- 1. Joi Validation Error Handling (Standard 400 response) ---
  if (err.isJoi) {
    error.statusCode = 400;
    error.status = "fail";
    // We send a concise message to the client, but log the details internally.
    error.message = "Validation Failed: Please check your input fields.";
    error.details = err.details.map((d) => ({
      path: d.path.join("."),
      message: d.message.replace(/"/g, ""), // Remove double quotes for cleaner messages
    }));
  }

  // --- 2. PostgreSQL Specific Error Handling (Critical for Data Integrity) ---
  // PostgreSQL Error Code Mapping (codes start with '2' for integrity violations)
  if (err.code) {
    switch (err.code) {
      case "23505": // unique_violation (e.g., duplicate Part ID)
        error.statusCode = 409;
        error.message =
          "Resource Conflict: A record with this unique value already exists. Check key fields.";
        error.status = "fail";
        error.details = {
          dbCode: err.code,
          detail: err.detail,
          constraint: err.constraint,
        };
        break;
      case "23502": // not_null_violation (e.g., missing mandatory field)
        error.statusCode = 400;
        error.message = `Missing mandatory field: Column '${err.column}' cannot be null.`;
        error.status = "fail";
        error.details = { dbCode: err.code, column: err.column };
        break;
      case "23503": // foreign_key_violation (e.g., non-existent UOM or Part ID)
        error.statusCode = 400;
        error.message =
          "Data Dependency Error: One or more referenced IDs (e.g., Part, UOM, Location) do not exist.";
        error.status = "fail";
        error.details = {
          dbCode: err.code,
          detail: err.detail,
          constraint: err.constraint,
        };
        break;
      case "42P01": // undefined_table (shouldn't happen in production, but good for debugging)
      case "42601": // syntax_error
        error.statusCode = 500;
        error.message =
          "Internal Database Error: Contact system architect for investigation.";
        error.status = "error";
        break;
    }
  }

  // --- 3. Logging Strategy (Critical for Debugging Loop Failures) ---
  if (error.statusCode >= 500) {
    // Log fatal errors with full stack trace for internal debugging
    console.error("FATAL SERVER ERROR:", error.message);
    console.error("STACK TRACE:", err.stack); // Use original error stack
    if (error.details) console.error("INTERNAL DETAILS:", error.details);
  } else {
    // Log operational warnings for monitoring
    console.warn(
      `OPERATIONAL ERROR (${error.statusCode}): ${error.message}`,
      error.details
    );
  }

  // --- 4. Final Client Response (Production Safe) ---
  // In a production environment, we hide all stack traces and internal details.
  const isProduction = process.env.NODE_ENV === "production";

  res.status(error.statusCode).json({
    success: false,
    status: error.status,
    message: error.message,
    // Only send details to the client for expected (4xx) operational errors like Joi/DB conflicts
    // but NEVER send the raw stack trace.
    // For 5xx errors, we hide internal details in production (but log them above).
    ...(error.details && error.status === "fail" && { details: error.details }),
    // Optional: Only send the stack trace in development mode for 5xx errors
    ...(!isProduction && error.statusCode >= 500 && { stack: err.stack }),
  });
};

/**
 * 404 Not Found Handler Middleware (Must be defined last in Express chain).
 */
const notFound = (req, res, next) => {
  next(new CustomError(`Cannot find ${req.originalUrl} on this server!`, 404));
};

module.exports = CustomError;
module.exports.errorHandler = errorHandler;
module.exports.notFound = notFound;
