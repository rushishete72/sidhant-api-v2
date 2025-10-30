/*
 * Context Note: यह auth मॉड्यूल के लिए API endpoints (routes) को परिभाषित करता है।
 * (UPGRADED: अब असली (real) कंट्रोलर फ़ंक्शंस का उपयोग कर रहा है)
 */
const express = require('express');
const router = express.Router();

// ✅ असली कंट्रोलर फ़ंक्शंस को इम्पोर्ट करें
const { 
    registerUser,
    loginUser, 
    verifyOtp,
    logoutUser,
    resetPassword
} = require('./userAuth.controller'); 

// -------------------------------------------------------------------------
// Routes Definition
// (पुराने कोडबेस /src/modules/auth/userAuth/userAuth.route.js के आधार पर)
// -------------------------------------------------------------------------

// POST /api/v2/auth/register
router.post('/register', registerUser);

// POST /api/v2/auth/login
router.post('/login', loginUser);

// POST /api/v2/auth/verify-otp
router.post('/verify-otp', verifyOtp);

// POST /api/v2/auth/reset-password
router.post('/reset-password', resetPassword);

// GET /api/v2/auth/logout 
router.get('/logout', logoutUser); 

module.exports = router;