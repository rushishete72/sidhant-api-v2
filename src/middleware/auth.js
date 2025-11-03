// File: src/middleware/auth.js

const jwt = require("jsonwebtoken");
const CustomError = require("../utils/errorHandler"); // assuming you created this utility
// If you are not using CustomError utility, change all 'new CustomError' to 'new Error'
// The structure you gave implies it should be handled via next(new Error(...))

const JWT_SECRET = process.env.JWT_SECRET || "your_default_secret_key";

/**
 * 1. Authenticate: JWT टोकन को मान्य करता है।
 * टोकन से उपयोगकर्ता डेटा को req.user में संलग्न करता है।
 */
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    // Using next() to pass error to central error handler (better practice)
    return next(
      new CustomError(
        "Authentication Failed. Bearer token की आवश्यकता है।",
        401
      )
    );
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    // पेलोड से महत्वपूर्ण डेटा निकालें
    req.user = {
      user_id: decoded.user_id,
      email: decoded.email,
      role_name: decoded.role_name,
      // पुराने कोड से अपग्रेड: अनुमतियों के लिए Set का उपयोग करें (तेज़ जाँच के लिए)
      permissions: new Set(
        Array.isArray(decoded.permissions) ? decoded.permissions : []
      ),
    };

    next(); // प्रमाणीकरण सफल
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return next(
        new CustomError("Token Expired. कृपया दोबारा लॉग इन करें।", 401)
      );
    }
    return next(
      new CustomError("Authentication Failed. अमान्य (Invalid) टोकन।", 401)
    );
  }
};

/**
 * 2. Authorize: Permission-Based Access Control (PBAC) लागू करता है।
 * @param {string|Array<string>} requiredPermissions - आवश्यक परमिशन कुंजी (या कुंजियाँ)।
 */
const authorize = (requiredPermissions) => {
  const perms = Array.isArray(requiredPermissions)
    ? requiredPermissions
    : [requiredPermissions];

  return (req, res, next) => {
    if (!req.user || !req.user.permissions) {
      return next(
        new CustomError(
          "Authorization Check Failed. उपयोगकर्ता प्रोफ़ाइल या अनुमतियाँ गायब हैं।",
          403
        )
      );
    }

    const hasPermission = perms.some((permissionKey) =>
      req.user.permissions.has(permissionKey)
    );

    if (hasPermission) {
      next(); // अनुमति है
    } else {
      console.warn(
        `AUTH FAIL: User ${req.user.user_id} (Role: ${
          req.user.role_name
        }) denied access to ${req.originalUrl}. Missing: ${perms.join(", ")}`
      );

      // Using CustomError for structured response
      return next(
        new CustomError("Authorization Failed. अपर्याप्त अनुमतियाँ।", 403)
      );
    }
  };
};

module.exports = {
  authenticate,
  authorize,
  // पुराने कोड के साथ संगतता (compatibility) के लिए एक उपनाम (alias)
  requireAuth: authenticate,
};
