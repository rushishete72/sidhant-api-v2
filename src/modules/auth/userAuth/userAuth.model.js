/*
 * Context Note: यह मॉडल डेटाबेस (PostgreSQL) से सीधे संपर्क करता है।
 * (FIXED: सभी टेबल नाम और अनुपस्थित (missing) कॉलम 'is_verified' को हटा दिया गया है।)
 */

// निर्भरताएँ - असली (real) फ़ाइलों को इम्पोर्ट करें
const { db, pgp } = require('../../../../src/database/db'); 
const { APIError } = require('../../../utils/errorHandler');
const bcrypt = require('bcryptjs'); 

const OTP_SALT_ROUNDS = 10; 

// =========================================================================
// ✅ फिक्स: सही टेबल नाम कॉन्सटेंट्स
// =========================================================================
const USER_TABLE = 'master_users'; 
const ROLE_TABLE = 'master_roles'; 
const OTP_TABLE = 'user_otp'; // NOTE: यह टेबल आपकी स्कीमा में मौजूद होनी चाहिए।


// =========================================================================
// B. USER & OTP MANAGEMENT
// =========================================================================

/** 1. डिफ़ॉल्ट 'Client' रोल सुनिश्चित करता है (पुराने कोड से फिक्स) */
const ensureDefaultRoleExists = async (roleName) => {
    try {
        const query = `
            INSERT INTO ${ROLE_TABLE} (role_name) VALUES ($1)
            ON CONFLICT (role_name) DO NOTHING;
        `;
        await db.none(query, [roleName]);
    } catch (error) {
        console.error("CRITICAL SQL ERROR during ensureDefaultRoleExists:", error.message || error); 
        throw new APIError(`Database setup failed for role '${roleName}'. DB connection error?`, 500);
    }
}

/** 2. उपयोगकर्ता को ईमेल द्वारा ढूंढता है। (लॉगिन/प्रोफ़ाइल लुकअप के लिए उपयोग किया जाता है) */
const getUserByEmail = async (email) => {
    const query = `
        SELECT u.user_id, u.email, u.full_name, r.role_name AS role, u.is_active, u.password_hash 
        FROM ${USER_TABLE} u
        JOIN ${ROLE_TABLE} r ON u.role_id = r.role_id
        WHERE u.email = $1 AND u.is_active = TRUE
    `;
    return db.oneOrNone(query, [email]);
};

/** 3. एक नया उपयोगकर्ता रजिस्टर करता है। (is_verified हटा दिया गया है) */
const registerUser = async (email, fullName, defaultRoleName = 'Client') => {
    try {
        await ensureDefaultRoleExists(defaultRoleName);

        const query = `
            WITH RoleID AS (SELECT role_id FROM ${ROLE_TABLE} WHERE role_name = $3)
            INSERT INTO ${USER_TABLE} (email, full_name, role_id, is_active)
            SELECT $1, $2, RoleID.role_id, TRUE
            FROM RoleID
            RETURNING user_id, email, full_name, role_id
        `;
        const newUser = await db.one(query, [email, fullName || email.split('@')[0], defaultRoleName]); 
        return getUserByEmail(newUser.email);
        
    } catch (e) {
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
        INSERT INTO ${OTP_TABLE} (user_id, otp_code, expires_at, attempts)
        VALUES ($1, $2, $3, 0) 
        ON CONFLICT (user_id) DO UPDATE
        SET otp_code = EXCLUDED.otp_code, expires_at = EXCLUDED.expires_at, attempts = 0
        RETURNING *
    `;
    return db.one(query, [userId, hashedOtp, expirationTime]);
};

/** 5. OTP को मान्य (Validate) करता है। (is_verified अपडेट हटा दिया गया है) */
const validateOtp = async (userId, inputOtpCode) => { 
    const MAX_OTP_ATTEMPTS = 5; 

    return db.tx(async t => { // ट्रांजैक्शन (Transaction)
        const otpRecord = await t.oneOrNone(`SELECT attempts, expires_at, otp_code AS stored_otp_hash FROM ${OTP_TABLE} WHERE user_id = $1`, [userId]);

        if (!otpRecord) {
             return null;
        }
        
        if (otpRecord.attempts >= MAX_OTP_ATTEMPTS) {
            await t.none(`DELETE FROM ${OTP_TABLE} WHERE user_id = $1`, [userId]); 
            throw new APIError('OTP प्रयास सीमा सीमा पार हो गई। नया OTP जेनरेट करें।', 401);
        }

        if (otpRecord.expires_at < new Date()) {
            await t.none(`UPDATE ${OTP_TABLE} SET attempts = attempts + 1 WHERE user_id = $1`, [userId]);
            throw new APIError('OTP समाप्त हो गया है। कृपया नया अनुरोध करें।', 401);
        }
        
        const isMatch = await bcrypt.compare(inputOtpCode, otpRecord.stored_otp_hash);

        if (!isMatch) {
            await t.none(`UPDATE ${OTP_TABLE} SET attempts = attempts + 1 WHERE user_id = $1`, [userId]);
            return null; // अमान्य OTP
        }
        
        // ✅ फिक्स: is_verified UPDATE हटा दिया गया है।
        await t.none(`DELETE FROM ${OTP_TABLE} WHERE user_id = $1`, [userId]);

        return t.oneOrNone(`SELECT user_id FROM ${USER_TABLE} WHERE user_id = $1`, [userId]);
    });
};

/** 6. JWT Payload के लिए प्रोफ़ाइल डेटा प्राप्त करें। (is_verified हटा दिया गया है) */
const getUserProfileData = async (userId) => {
    const query = `
        SELECT 
            u.user_id, u.email, u.full_name, r.role_name AS role, 
            u.role_id,
            COALESCE(r.permissions, '{}') AS permissions
        FROM ${USER_TABLE} u
        JOIN ${ROLE_TABLE} r ON u.role_id = r.role_id
        WHERE u.user_id = $1 AND u.is_active = TRUE
    `;
    return db.oneOrNone(query, [userId]);
};

/** 7. पासवर्ड को HASH करता है और DB में अपडेट करता है। */
const updateUserPassword = async (userId, newPassword) => {
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    const query = `
        UPDATE ${USER_TABLE} SET password_hash = $2, updated_at = NOW() 
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
    return db.none(`DELETE FROM ${OTP_TABLE} WHERE user_id = $1`, [userId]);
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