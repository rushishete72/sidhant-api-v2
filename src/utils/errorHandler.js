// File: src/utils/errorHandler.js

/**
 * Custom Error class for structured API errors.
 */
class CustomError extends Error {
  constructor(message, statusCode, details = null) {
    super(message);
    this.statusCode = statusCode || 500;
    this.status = statusCode >= 400 && statusCode < 500 ? "fail" : "error";
    this.isOperational = true;
    this.details = details;

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Global Error Handler Middleware.
 */
const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.statusCode = err.statusCode || 500;
  error.status =
    error.statusCode >= 400 && error.statusCode < 500 ? "fail" : "error";
  error.message = err.message || "Something went wrong on the server.";

  if (err.code === "23505") {
    error.statusCode = 409;
    error.message =
      "Resource Conflict: A record with this unique value already exists.";
    error.status = "fail";
  }

  if (error.statusCode >= 500) {
    console.error("FATAL SERVER ERROR:", err);
  } else {
    console.warn("Operational Error:", err.message, error.details);
  }

  res.status(error.statusCode).json({
    success: false,
    status: error.status,
    message: error.message,
    ...(error.details && { details: error.details }),
  });
};

/**
 * 404 Not Found Handler Middleware (MUST be a function).
 */
const notFound = (req, res, next) => {
  // Throws a 404 error using the CustomError class, which is then caught by errorHandler.
  next(new CustomError(`Cannot find ${req.originalUrl} on this server!`, 404));
};

module.exports = CustomError; // Default export
module.exports.errorHandler = errorHandler; // Named export for global error handling
module.exports.notFound = notFound; // NEW: Named export for 404 handling
