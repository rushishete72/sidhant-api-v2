// File: src/utils/asyncHandler.js
// CRITICAL FIX: Ensures async controllers handle errors and resolve to standard Express handlers.

/**
 * Global wrapper for async express route handlers.
 * Catches errors and passes them to Express error middleware (errorHandler).
 * @param {function} fn - The async function (controller) to wrap.
 */
const asyncHandler = (fn) => (req, res, next) => {
  // Use Promise.resolve().catch(next) to safely wrap the async function
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;
