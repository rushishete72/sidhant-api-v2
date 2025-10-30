/*
 * Context Note: यह 'users' टेबल के लिए डेटाबेस तर्क (logic) को संभालता है।
 * यह Admin Panel से उपयोगकर्ता CRUD (Create, Read, Update, Delete) के लिए है।
 * (पुराने /src/modules/master/users/user.model.js से लिया गया)
 */

// निर्भरताएँ (Dependencies)
// (पाथ फिक्स: 4 लेवल ऊपर)
const { db, pgp } = require('../../../../src/database/db'); 
const { APIError } = require('../../../utils/errorHandler'); 
const TABLE_NAME = 'users'; 

// =========================================================================
// A. CORE CRUD FUNCTIONS
// =========================================================================

/** 1. नया उपयोगकर्ता (User) बनाता है। */
const createUser = async (data) => {
    const { 
        email, full_name, password_hash, role_id, 
        is_active = true, is_verified = true, created_by 
    } = data;
    
    // केवल वे कॉलम शामिल करें जो DB में मौजूद हैं
    const columns = new pgp.helpers.ColumnSet([
        'email', 
        'full_name', 
        'password_hash', 
        'role_id',
        'is_active', 
        'is_verified',
        { name: 'created_by', init: () => created_by || 1 } // created_by को 1 पर डिफ़ॉल्ट करें यदि यह अनुपस्थित है
    ], { table: TABLE_NAME });
    
    // INSERT के लिए डेटा
    const insertData = {
        email: email.trim(), 
        full_name: full_name.trim(), 
        password_hash,
        role_id: role_id,
        is_active: is_active, 
        is_verified: is_verified,
    };
    
    // (पुराने कोड के समान: रोल नाम के साथ पूरा डेटा वापस करें)
    const insertQuery = pgp.helpers.insert(insertData, columns, TABLE_NAME) 
                        + ` RETURNING user_id, email, full_name, role_id;`;

    try {
        const result = await db.one(insertQuery);
        
        // परिणाम (Result) में रोल नाम (Role Name) को जोड़ने के लिए पुनः क्वेरी करें
        return getUserById(result.user_id);
        
    } catch (error) {
        if (error.code === '23505') { // Unique constraint violation (Email)
            throw new APIError('यह ईमेल पहले से मौजूद है।', 409);
        }
        if (error.code === '23503') { // Foreign key violation (Role ID)
            throw new APIError('अमान्य भूमिका ID (Role ID) प्रदान की गई है।', 400);
        }
        console.error('Database Error in createUser:', error);
        throw new APIError('Database insertion failed.', 500); 
    }
};

/** 2. ID द्वारा उपयोगकर्ता को प्राप्त करता है। */
const getUserById = async (userId) => {
    // Note: SELECT क्वेरी में role_name और password_hash को शामिल करें।
    const query = `
        SELECT u.*, r.role_name 
        FROM ${TABLE_NAME} u
        JOIN roles r ON u.role_id = r.role_id
        WHERE u.user_id = $1
    `;
    return db.oneOrNone(query, [userId]);
};

/** 3. सभी उपयोगकर्ताओं को फ़िल्टर, सर्च और पेजिंग के साथ प्राप्त करता है। */
const getAllUsers = async ({ limit, offset, search, isActive }) => {
    const params = {};
    let whereConditions = '';
    
    if (isActive !== null) {
        whereConditions += ' AND u."is_active" = $<isActive>';
        params.isActive = isActive;
    }

    if (search) {
        // (ईमेल या नाम द्वारा खोजें)
        whereConditions += ' AND (u."email" ILIKE $<searchPattern> OR u."full_name" ILIKE $<searchPattern>)';
        params.searchPattern = `%${search}%`;
    }

    const baseQuery = `
        FROM ${TABLE_NAME} u
        JOIN roles r ON u.role_id = r.role_id
        WHERE 1=1 ${whereConditions}
    `;
    
    const countQuery = `SELECT COUNT(*) ${baseQuery}`;
    
    const dataQuery = `
        SELECT u.user_id, u.email, u.full_name, u.is_active, r.role_name, u.created_at
        ${baseQuery}
        ORDER BY u.created_at DESC
        LIMIT $<limit> OFFSET $<offset>
    `;

    params.limit = limit;
    params.offset = offset;

    const [dataResult, countResult] = await db.tx(t => {
        return Promise.all([
            t.any(dataQuery, params),
            t.one(countQuery, params)
        ]);
    });

    return {
        data: dataResult,
        total_count: parseInt(countResult.count, 10),
    };
};

/** 4. उपयोगकर्ता डेटा को अपडेट करता है। (Role, Password, Name, etc.) */
const updateUser = async (userId, data) => {
    if (Object.keys(data).length === 0) {
        return getUserById(userId); 
    }
    
    data.updated_at = new Date(); 
    
    // pgp.helpers.update केवल भेजे गए फ़ील्ड्स को अपडेट करेगा
    const updateQuery = pgp.helpers.update(data, null, TABLE_NAME) 
                        + ` WHERE user_id = ${userId} RETURNING user_id, email`; // केवल आवश्यक फ़ील्ड्स लौटाएँ
    
    try {
        const result = await db.one(updateQuery);
        // अपडेट के बाद पूरा प्रोफ़ाइल वापस करें
        return getUserById(result.user_id);
        
    } catch (error) {
        if (error.code === '23505') { // Unique constraint violation (Email)
            throw new APIError('अपडेट विफल: यह ईमेल पहले से मौजूद है।', 409);
        }
        if (error.code === '23503') { // Foreign key violation (Role ID)
            throw new APIError('अमान्य भूमिका ID (Role ID) प्रदान की गई है।', 400);
        }
        console.error('DB Error in updateUser:', error);
        throw new APIError('Database update failed.', 500);
    }
};

/** 5. उपयोगकर्ता को निष्क्रिय (Deactivate) करता है। */
const deactivateUser = async (userId) => {
    const query = pgp.as.format('UPDATE $1^ SET is_active = FALSE, updated_at = NOW() WHERE user_id = $2 AND is_active = TRUE RETURNING user_id, email, is_active;', [TABLE_NAME, userId]);
    return db.oneOrNone(query);
};

/** 6. उपयोगकर्ता को पुनः सक्रिय (Activate) करता है। */
const activateUser = async (userId) => {
    const query = pgp.as.format('UPDATE $1^ SET is_active = TRUE, updated_at = NOW() WHERE user_id = $2 AND is_active = FALSE RETURNING user_id, email, is_active;', [TABLE_NAME, userId]);
    return db.oneOrNone(query);
};


// =========================================================================
// FINAL EXPORTS
// =========================================================================

module.exports = {
    createUser,
    getUserById,
    getAllUsers,
    updateUser,
    deactivateUser,
    activateUser,
};