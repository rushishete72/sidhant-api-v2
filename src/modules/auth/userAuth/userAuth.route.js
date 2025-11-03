/*
 * Context Note: यह auth मॉड्यूल के लिए API endpoints (routes) को परिभाषित करता है।
 * (UPGRADED: अब असली (real) कंट्रोलर फ़ंक्शंस का उपयोग कर रहा है)
 */
const express = require('express');
const router = express.Router();
const controller = require('./userAuth.controller');

// -------------------------------------------------------------------------
// Routes Definition
// (पुराने कोडबेस /src/modules/auth/userAuth/userAuth.route.js के आधार पर)
// -------------------------------------------------------------------------

// POST /api/v2/auth/register
router.post('/register', controller.register);

// POST /api/v2/auth/verify-otp
router.post('/verify-otp', controller.verifyOtp);

// POST /api/v2/auth/login
router.post('/login', controller.login);

// POST /api/v2/auth/forgot-password
router.post('/forgot-password', controller.forgotPassword);

// POST /api/v2/auth/reset-password
router.post('/reset-password', controller.resetPassword);

// POST /api/v2/auth/logout
router.post('/logout', controller.logout);

module.exports = router;