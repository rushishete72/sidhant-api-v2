/*
 * Context Note: यह मॉडल डेटाबेस (PostgreSQL) से सीधे संपर्क करता है।
 * (UPGRADED: अब असली database/db.js और utils/errorHandler.js का उपयोग कर रहा है)
 */

// निर्भरताएँ - असली (real) फ़ाइलों को इम्पोर्ट करें
// (पथ फिक्स: 4 लेवल ऊपर)
const { db, pgp } = require('../../../../src/database/db'); 
const { APIError } = require('../../../utils/errorHandler');
const bcrypt = require('bcryptjs'); 

const OTP_SALT_ROUNDS = 10; 

// =========================================================================
// (नकली (Mock) DB और Error को यहाँ से हटा दिया गया है)
// =========================================================================

// =========================================================================
// B. USER & OTP MANAGEMENT (पुराने मॉडल से तर्क)
// =========================================================================

/** 1. डिफ़ॉल्ट 'Client' रोल सुनिश्चित करता है (पुराने कोड से फिक्स) */
const ensureDefaultRoleExists = async (roleName) => {
    try {
        const query = `
            INSERT INTO roles (role_name) VALUES ($1)
            ON CONFLICT (role_name) DO NOTHING;
        `;
        await db.none(query, [roleName]);
        // console.log(`[DB Setup] Ensured default role '${roleName}' exists.`);
    } catch (error) {
        console.error("CRITICAL SQL ERROR during ensureDefaultRoleExists:", error.message || error); 
        // यदि DB कनेक्ट नहीं है तो यह विफल हो सकता है
        throw new APIError(`Database setup failed for role '${roleName}'. DB connection error?`, 500);
    }
}

/** 2. उपयोगकर्ता को ईमेल द्वारा ढूंढता है। */
const getUserByEmail = async (email) => {
    const query = `
        SELECT u.user_id, u.email, u.full_name, r.role_name AS role, u.is_active, u.is_verified
        FROM users u
        JOIN roles r ON u.role_id = r.role_id
        WHERE u.email = $1 AND u.is_active = TRUE
    `;
    return db.oneOrNone(query, [email]);
};

/** 3. एक नया उपयोगकर्ता रजिस्टर करता है। */
const registerUser = async (email, fullName, defaultRoleName = 'Client') => {
    try {
        await ensureDefaultRoleExists(defaultRoleName);

        const query = `
            WITH RoleID AS (SELECT role_id FROM roles WHERE role_name = $3)
            INSERT INTO users (email, full_name, role_id, is_active, is_verified)
            SELECT $1, $2, RoleID.role_id, TRUE, FALSE
            FROM RoleID
            RETURNING user_id, email, full_name, role_id
        `;
        const newUser = await db.one(query, [email, fullName || email.split('@')[0], defaultRoleName]); 
        return getUserByEmail(newUser.email);
        
    } catch (e) {
        // असली (Real) DB एरर हैंडलिंग
        if (e.code === '23505') { 
            throw new APIError("Registration failed: यह ईमेल पहले से मौजूद है।", 409);
        }
        console.error("ACTUAL DATABASE ERROR during registerUser:", e.message || e);
        throw new APIError("User registration failed at database level.", 500);
    }
};

/** 4. एक नया OTP बनाता है (Hash के साथ)। */
const createOtp = async (userId, otpCode) => {
    const expirationTime = new Date(Date.now() + 5 * 60000); // 5 मिनट
    const hashedOtp = await bcrypt.hash(otpCode, OTP_SALT_ROUNDS);

    const query = `
        INSERT INTO user_otp (user_id, otp_code, expires_at, attempts)
        VALUES ($1, $2, $3, 0) 
        ON CONFLICT (user_id) DO UPDATE
        SET otp_code = EXCLUDED.otp_code, expires_at = EXCLUDED.expires_at, attempts = 0
        RETURNING *
    `;
    return db.one(query, [userId, hashedOtp, expirationTime]);
};

/** 5. OTP को मान्य (Validate) करता है। (असली लॉजिक के साथ) */
const validateOtp = async (userId, inputOtpCode) => { 
    const MAX_OTP_ATTEMPTS = 5; 

    return db.tx(async t => { // ट्रांजैक्शन (Transaction)
        const otpRecord = await t.oneOrNone('SELECT attempts, expires_at, otp_code AS stored_otp_hash FROM user_otp WHERE user_id = $1', [userId]);

        if (!otpRecord) {
             // OTP नहीं मिला (या पहले ही उपयोग हो चुका है)
            return null;
        }
        
        if (otpRecord.attempts >= MAX_OTP_ATTEMPTS) {
            await t.none('DELETE FROM user_otp WHERE user_id = $1', [userId]); // पुराने OTP को हटा दें
            throw new APIError('OTP प्रयास सीमा पार हो गई। नया OTP जेनरेट करें।', 401);
        }

        if (otpRecord.expires_at < new Date()) {
            await t.none('UPDATE user_otp SET attempts = attempts + 1 WHERE user_id = $1', [userId]);
            throw new APIError('OTP समाप्त हो गया है। कृपया नया अनुरोध करें।', 401);
        }
        
        // ✅ असली (Real) bcrypt जाँच
        const isMatch = await bcrypt.compare(inputOtpCode, otpRecord.stored_otp_hash);

        if (!isMatch) {
            await t.none('UPDATE user_otp SET attempts = attempts + 1 WHERE user_id = $1', [userId]);
            return null; // अमान्य OTP
        }
        
        // OTP सही है, उपयोगकर्ता को सत्यापित करें और OTP हटा दें
        await t.none('UPDATE users SET is_verified = TRUE WHERE user_id = $1', [userId]);
        await t.none('DELETE FROM user_otp WHERE user_id = $1', [userId]);

        return t.oneOrNone('SELECT user_id FROM users WHERE user_id = $1', [userId]);
    });
};

/** 6. JWT Payload के लिए प्रोफ़ाइल डेटा प्राप्त करें। (असली लॉजिक के साथ) */
const getUserProfileData = async (userId) => {
    const query = `
        SELECT 
            u.user_id, u.email, u.full_name, r.role_name AS role, u.is_verified, 
            COALESCE(ARRAY_AGG(p.permission_key) FILTER (WHERE p.permission_key IS NOT NULL), '{}') AS permissions
        FROM users u
        JOIN roles r ON u.role_id = r.role_id
        LEFT JOIN role_permissions rp ON r.role_id = rp.role_id
        LEFT JOIN permissions p ON rp.permission_id = p.permission_id
        WHERE u.user_id = $1 AND u.is_active = TRUE
        GROUP BY u.user_id, u.email, u.full_name, r.role_name, u.is_verified
    `;
    // (नकली .then() ब्लॉक हटा दिया गया है)
    return db.oneOrNone(query, [userId]);
};

/** 7. पासवर्ड को HASH करता है और DB में अपडेट करता है। */
const updateUserPassword = async (userId, newPassword) => {
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    const query = `
        UPDATE users SET password_hash = $2, updated_at = NOW() 
        WHERE user_id = $1
        RETURNING user_id
    `;
    const result = await db.result(query, [userId, passwordHash]);

    if (result.rowCount === 0) {
        throw new APIError('User not found or no changes made to password.', 404);
    }
};

/** 8. OTP रो को डिलीट करें। */
const deleteOtp = async (userId) => {
    return db.none('DELETE FROM user_otp WHERE user_id = $1', [userId]);
};


// =========================================================================
// FINAL EXPORTS 
// =========================================================================

module.exports = {
    getUserByEmail,
    registerUser,
    createOtp,
    validateOtp, 
    deleteOtp, 
    getUserProfileData,
    updateUserPassword,
};