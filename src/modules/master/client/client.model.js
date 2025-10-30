/*
 * Context Note: यह 'master_clients' टेबल के लिए डेटाबेस तर्क (logic) को संभालता है।
 * यह db.js, errorHandler.js, और pg-promise helpers पर निर्भर करता है।
 * (पुराने /src/modules/master/client/client.model.js से लिया गया)
 */

// निर्भरताएँ (Dependencies)
const { db, pgp } = require('../../../../src/database/db'); 
const { APIError } = require('../../../utils/errorHandler'); 
const TABLE_NAME = 'master_clients'; 

// =========================================================================
// A. CORE CRUD FUNCTIONS
// =========================================================================

/** 1. नया क्लाइंट बनाता है। */
const createClient = async (data) => {
    const { 
        client_name, email, phone, is_active = true,
        // (created_by DB स्कीमा में नहीं है)
    } = data;
    
    // (पुराने कोड से फिक्स: केवल वे कॉलम शामिल करें जो DB में मौजूद हैं)
    const columns = new pgp.helpers.ColumnSet([
        'client_name', 
        'email',
        'phone',
        'is_active', 
    ], { table: TABLE_NAME });
    
    // INSERT के लिए डेटा
    const insertData = {
        client_name: client_name.trim(), 
        email: email ? email.trim() : null,
        phone: phone ? phone.trim() : null,
        is_active: is_active, 
    };
    
    const insertQuery = pgp.helpers.insert(insertData, columns, TABLE_NAME) 
                        + ' RETURNING client_id, client_name, email, is_active;';

    try {
        const result = await db.one(insertQuery);
        return result;
        
    } catch (error) {
        if (error.code === '23505') { // Unique constraint violation
            throw new APIError('क्लाइंट का नाम (Name) या ईमेल (Email) पहले से मौजूद है।', 409);
        }
        console.error('Database Error in createClient:', error);
        throw new APIError('Database insertion failed.', 500); 
    }
};

/** 2. ID द्वारा क्लाइंट को प्राप्त करता है। */
const getClientById = async (clientId) => {
    const query = pgp.as.format('SELECT client_id, client_name, email, phone, is_active, created_at FROM $1^ WHERE client_id = $2', [TABLE_NAME, clientId]);
    return db.oneOrNone(query);
};

/** 3. सभी क्लाइंट्स को फ़िल्टर, सर्च और पेजिंग के साथ प्राप्त करता है। */
const getAllClients = async ({ limit, offset, search, isActive }) => {
    const params = {};
    let whereConditions = '';
    
    if (isActive !== null) {
        whereConditions += ' AND "is_active" = $<isActive>';
        params.isActive = isActive;
    }

    if (search) {
        // (नाम, ईमेल, या फ़ोन द्वारा खोजें)
        whereConditions += ' AND ("client_name" ILIKE $<searchPattern> OR "email" ILIKE $<searchPattern> OR "phone" ILIKE $<searchPattern>)';
        params.searchPattern = `%${search}%`;
    }

    const baseQuery = `
        FROM ${TABLE_NAME}
        WHERE 1=1 ${whereConditions}
    `;
    
    const countQuery = `SELECT COUNT(*) ${baseQuery}`;
    
    const dataQuery = `
        SELECT client_id, client_name, email, phone, is_active, created_at, updated_at 
        ${baseQuery}
        ORDER BY created_at DESC
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

/** 4. क्लाइंट डेटा को अपडेट करता है। */
const updateClient = async (clientId, data) => {
    if (Object.keys(data).length === 0) {
        return getClientById(clientId); 
    }
    
    data.updated_at = new Date(); 
    
    const updateQuery = pgp.helpers.update(data, null, TABLE_NAME) + ` WHERE client_id = ${clientId} RETURNING client_id, client_name, email, is_active`;
    
    try {
        const result = await db.one(updateQuery);
        return result;
    } catch (error) {
        if (error.code === '23505') {
            throw new APIError('Update failed: क्लाइंट का नाम (Name) या ईमेल (Email) पहले से मौजूद है।', 409);
        }
        console.error('DB Error in updateClient:', error);
        throw new APIError('Database update failed.', 500);
    }
};

/** 5. क्लाइंट को निष्क्रिय (Deactivate) करता है। */
const deactivateClient = async (clientId) => {
    const query = pgp.as.format('UPDATE $1^ SET is_active = FALSE, updated_at = NOW() WHERE client_id = $2 AND is_active = TRUE RETURNING client_id, client_name, is_active;', [TABLE_NAME, clientId]);
    return db.oneOrNone(query);
};

/** 6. क्लाइंट को पुनः सक्रिय (Activate) करता है। */
const activateClient = async (clientId) => {
    const query = pgp.as.format('UPDATE $1^ SET is_active = TRUE, updated_at = NOW() WHERE client_id = $2 AND is_active = FALSE RETURNING client_id, client_name, is_active;', [TABLE_NAME, clientId]);
    return db.oneOrNone(query);
};

// =========================================================================
// FINAL EXPORTS
// =========================================================================

module.exports = {
    createClient,
    getClientById,
    getAllClients,
    updateClient,
    deactivateClient,
    activateClient,
};