/*
 * Context Note: यह कंट्रोलर HTTP अनुरोधों (requests) को संभालता है।
 * यह business logic को मॉडल (database logic) से जोड़ता है।
 * (UPGRADED: अब असली (real) model और utils का उपयोग कर रहा है)
 */

// निर्भरताएँ (Dependencies) - अब असली फ़ाइलों को इम्पोर्ट करें
const userAuthModel = require('./userAuth.model');
const { APIError } = require('../../../utils/errorHandler'); 
const { generateOtp, handleEmailValidation } = require('../../../utils/validation'); 
const jwt = require('jsonwebtoken');

// .env से कॉन्फ़िग लोड करें
const JWT_SECRET = process.env.JWT_SECRET || 'your_default_secret_key';
const JWT_EXPIRY = process.env.JWT_EXPIRY || '7d'; 

// =========================================================================
// A. UTILITY FUNCTION (Helper)
// =========================================================================

/**
 * JWT टोकन बनाने के लिए सहायक फ़ंक्शन।
 * (पुराने कोडबेस /src/modules/auth/userAuth/userAuth.controller.js से लिया गया)
 * @param {object} profile - उपयोगकर्ता प्रोफ़ाइल (model से)
 * @returns {string} JWT टोकन।
 */
const createAuthToken = (profile) => {
    const payload = {
        user_id: profile.user_id,
        email: profile.email,
        role_name: profile.role, // 'role' को 'role_name' के रूप में मानकीकृत करें
        permissions: profile.permissions, 
    };
    if (!JWT_SECRET) {
        // APIError का उपयोग करें
        throw new APIError("JWT_SECRET is not configured. Critical server error.", 500);
    }
    return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY });
};

// =========================================================================
// B. AUTHENTICATION HANDLERS (अब असली लॉजिक के साथ)
// =========================================================================

/**
 * 1. /register: नया उपयोगकर्ता बनाता है और OTP भेजता है।
 * (पुराने /src/modules/auth/userAuth/userAuth.controller.js से तर्क)
 */
const registerUser = async (req, res, next) => {
    const { email, full_name, defaultRoleName } = req.body; 
    
    // वैलिडेशन
    const emailError = handleEmailValidation(email);
    if (emailError) {
        return next(new APIError(emailError, 400));
    }
    if (!full_name) {
        return next(new APIError('Full Name is required for registration.', 400));
    }

    try {
        // 1. उपयोगकर्ता रजिस्टर करें
        const user = await userAuthModel.registerUser(email, full_name, defaultRoleName);

        // 2. OTP जेनरेट करें
        const otpCode = generateOtp();
        
        // 3. OTP बनाएँ (मॉडल इसे hash करके DB में सेव करेगा)
        await userAuthModel.createOtp(user.user_id, otpCode);

        // 4. (भविष्य का चरण: यहाँ ईमेल भेजने का लॉजिक जोड़ा जाएगा)
        console.log(`[Email Mock] OTP for ${email} is: ${otpCode}`);

        // 201 Created के साथ सफल प्रतिक्रिया
        res.status(201).json({
            message: 'User registered successfully. OTP sent to email (check console for mock OTP).',
            data: { 
                user_id: user.user_id, 
                email: user.email,
                // (Development HINT: Test OTP)
                test_otp: process.env.NODE_ENV !== 'production' ? otpCode : undefined
            }
        });

    } catch (error) {
        next(error); // एरर को ग्लोबल errorHandler को भेजें
    }
};

/**
 * 2. /login: मौजूदा उपयोगकर्ता के लिए OTP भेजता है।
 * (पुराने /src/modules/auth/userAuth/userAuth.controller.js से तर्क)
 */
const loginUser = async (req, res, next) => {
    const { email } = req.body;

    const emailError = handleEmailValidation(email);
    if (emailError) {
        return next(new APIError(emailError, 400));
    }
    
    try {
        const user = await userAuthModel.getUserByEmail(email);

        if (!user) {
            return next(new APIError('User not found or is inactive.', 404));
        }

        // 1. OTP जेनरेट करें
        const otpCode = generateOtp();
        // 2. OTP बनाएँ (DB में)
        await userAuthModel.createOtp(user.user_id, otpCode);
        
        // 3. (भविष्य का चरण: ईमेल भेजें)
        console.log(`[Email Mock] OTP for ${email} is: ${otpCode}`);
        
        res.status(200).json({
            message: 'OTP sent to your email for login (check console for mock OTP).',
            data: {
                user_id: user.user_id,
                email: user.email,
                test_otp: process.env.NODE_ENV !== 'production' ? otpCode : undefined
            }
        });

    } catch (error) {
        next(error);
    }
};

/**
 * 3. /verify-otp: OTP को मान्य करता है और JWT जारी करता है।
 * (पुराने /src/modules/auth/userAuth/userAuth.controller.js से तर्क)
 */
const verifyOtp = async (req, res, next) => {
    // (हमारे नकली DB के लिए, हम OTP '123456' का उपयोग करेंगे)
    const { email, otp: inputOtpCode = '123456' } = req.body;

    if (!email || !inputOtpCode) {
        return next(new APIError('Email and OTP are required for verification.', 400));
    }
    
    try {
        const user = await userAuthModel.getUserByEmail(email);
        
        if (!user) {
            return next(new APIError('User not found or is inactive.', 404));
        }

        // 1. OTP को मान्य करें (Model इसे DB में जाँचेगा)
        const verificationResult = await userAuthModel.validateOtp(user.user_id, inputOtpCode);

        if (!verificationResult) {
            // (validateOtp खुद एरर फेंक सकता है, लेकिन यह एक फॉलबैक है)
            return next(new APIError('Invalid OTP or OTP expired/attempts exceeded.', 401));
        }
        
        // 2. JWT के लिए प्रोफ़ाइल डेटा (permissions के साथ) प्राप्त करें
        const profile = await userAuthModel.getUserProfileData(user.user_id);
        
        if (!profile) {
            return next(new APIError('Failed to load user profile after verification.', 500));
        }

        // 3. टोकन बनाएँ
        const token = createAuthToken(profile);
        
        res.status(200).json({
            message: 'OTP verified. Login successful.',
            token: token,
            data: {
                user_id: profile.user_id,
                email: profile.email,
                role: profile.role,
                permissions: profile.permissions // (Array)
            }
        });
        
    } catch (error) {
        next(error);
    }
};

/**
 * 4. /reset-password: नया पासवर्ड सेट करता है।
 * (पुराने /src/modules/auth/userAuth/userAuth.controller.js से तर्क)
 */
const resetPassword = async (req, res, next) => {
    const { email, newPassword, otp: inputOtpCode = '123456' } = req.body;

    if (!email || !newPassword || !inputOtpCode) {
        return next(new APIError('Email, OTP, and new password are required.', 400));
    }
    
    try {
        const user = await userAuthModel.getUserByEmail(email);
        
        if (!user) {
            return next(new APIError('User not found or is inactive.', 404));
        }
        
        // 1. OTP को मान्य करें
        const verificationResult = await userAuthModel.validateOtp(user.user_id, inputOtpCode);
        
        if (!verificationResult) {
            return next(new APIError('Invalid OTP or OTP expired/attempts exceeded.', 401));
        }
        
        // 2. पासवर्ड अपडेट करें (Model इसे hash करेगा)
        await userAuthModel.updateUserPassword(user.user_id, newPassword);
        
        // 3. (मॉडल ने OTP हटा दिया है, लेकिन यदि नहीं हटाया होता, तो हम यहाँ deleteOtp कॉल करते)
        // await userAuthModel.deleteOtp(user.user_id);

        res.status(200).json({
            message: 'Password successfully reset. You can now login (if password login is enabled).',
            data: {
                user_id: user.user_id
            }
        });

    } catch (error) {
        next(error);
    }
};

/**
 * 5. /logout: (क्लाइंट-साइड टोकन हटाने का संकेत)
 */
const logoutUser = (req, res) => {
    res.status(200).json({ 
        message: 'Logout successful. कृपया क्लाइंट-साइड पर टोकन हटाएँ।'
    });
};

// =========================================================================
// C. FINAL EXPORTS
// =========================================================================

module.exports = {
    registerUser,
    loginUser,
    verifyOtp,
    logoutUser,
    resetPassword,
};