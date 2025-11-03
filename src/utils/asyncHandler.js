// File: src/utils/asyncHandler.js (Target: sidhant-api-v2)

/**
 * @function asyncHandler
 * @description
 * A high-order function (HOF) wrapper for Express route handlers (Controllers)
 * to automatically catch exceptions from asynchronous functions and pass them
 * to the global error handling middleware via next(err).
 * * This is CRITICAL for preventing unhandled promise rejections (500 errors)
 * and ensures all errors flow into our structured errorHandler.js for logging
 * and safe client response.
 * * @param {function} fn - The asynchronous Express controller function (req, res, next).
 * @returns {function} - The wrapped function ready for use in Express routes.
 */
const asyncHandler = (fn) => (req, res, next) => {
  // Execute the controller function (fn). Since it's often 'async', it returns a Promise.
  // We explicitly call .catch(next) on the promise chain.
  // If the promise rejects (due to 'throw' or a fatal error), 'next(err)' is called.
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;
