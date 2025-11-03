// File: src/utils/asyncHandler.js

/**
 * A wrapper for Express async route handlers to automatically catch errors
 * and pass them to the Express error handling middleware (next(err)).
 * @param {function} fn - The asynchronous function (controller method) to wrap.
 * @returns {function} - The wrapped function suitable for Express routes.
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;
