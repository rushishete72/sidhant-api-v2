/*
 * Context Note: यह मिडलवेयर JWT टोकन को मान्य (validate) करता है
 * और उपयोगकर्ता की अनुमतियों (permissions) की जाँच करता है।
 */
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'your_default_secret_key'; // .env से लोड होगा

/**
 * 1. Authenticate: JWT टोकन को मान्य करता है।
 * टोकन से उपयोगकर्ता डेटा को req.user में संलग्न करता है।
 */
const authenticate = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            message: 'Authentication Failed. Bearer token की आवश्यकता है।',
            code: 'AUTH_001'
        });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, JWT_SECRET);

        // पेलोड से महत्वपूर्ण डेटा निकालें
        req.user = {
            user_id: decoded.user_id,
            email: decoded.email,
            role_name: decoded.role_name,
            // पुराने कोड से अपग्रेड: अनुमतियों के लिए Set का उपयोग करें (तेज़ जाँच के लिए)
            permissions: new Set(Array.isArray(decoded.permissions) ? decoded.permissions : [])
        };
        
        next(); // प्रमाणीकरण सफल

    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                message: 'Token Expired. कृपया दोबारा लॉग इन करें।',
                code: 'AUTH_002'
            });
        }
        return res.status(401).json({
            message: 'Authentication Failed. अमान्य (Invalid) टोकन।',
            code: 'AUTH_004'
        });
    }
};

/**
 * 2. Authorize: Permission-Based Access Control (PBAC) लागू करता है।
 * उपयोगकर्ता के पास आवश्यक अनुमतियों में से कम से कम एक होनी चाहिए।
 *
 * @param {string|Array<string>} requiredPermissions - आवश्यक परमिशन कुंजी (या कुंजियाँ)।
 */
const authorize = (requiredPermissions) => {
    // हमेशा एक ऐरे (array) सुनिश्चित करें
    const perms = Array.isArray(requiredPermissions) ? requiredPermissions : [requiredPermissions];

    return (req, res, next) => {
        // 1. सुनिश्चित करें कि उपयोगकर्ता authenticate मिडलवेयर से गुजरा है
        if (!req.user || !req.user.permissions) {
            return res.status(403).json({
                message: 'Authorization Check Failed. उपयोगकर्ता प्रोफ़ाइल या अनुमतियाँ गायब हैं।',
                code: 'AUTH_005'
            });
        }

        // 2. जाँच करें कि क्या उपयोगकर्ता के पास कोई आवश्यक अनुमति है
        const hasPermission = perms.some(
            permissionKey => req.user.permissions.has(permissionKey)
        );

        if (hasPermission) {
            next(); // अनुमति है
        } else {
            // 3. पहुँच निषेध (Access Denied)
            console.warn(`AUTH FAIL: User ${req.user.user_id} (Role: ${req.user.role_name}) denied access to ${req.originalUrl}. Missing: ${perms.join(', ')}`);
            
            return res.status(403).json({
                message: 'Authorization Failed. अपर्याप्त अनुमतियाँ।',
                required: perms,
                code: 'AUTH_006'
            });
        }
    };
};

module.exports = {
    authenticate,
    authorize,
    // पुराने कोड के साथ संगतता (compatibility) के लिए एक उपनाम (alias)
    requireAuth: authenticate 
};