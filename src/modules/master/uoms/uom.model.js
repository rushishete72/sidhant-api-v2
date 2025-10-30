/*
 * Context Note: यह 'master_uoms' (Unit of Measurement) टेबल के लिए डेटाबेस तर्क (logic) को संभालता है।
 * यह db.js, errorHandler.js, और pg-promise helpers पर निर्भर करता है।
 * (पुराने /src/modules/masterData/uom/uom.model.js से लिया गया)
 */

// निर्भरताएँ (Dependencies)
// (पाथ फिक्स: 4 लेवल ऊपर)
const { db, pgp } = require('../../../../src/database/db'); 
const { APIError } = require('../../../utils/errorHandler'); 
const TABLE_NAME = 'master_uoms'; 

// =========================================================================
// A. CORE CRUD FUNCTIONS
// =========================================================================

/** 1. नया UOM बनाता है। */
const createUom = async (data) => {
    const { 
        uom_code, uom_name, is_active = true,
    } = data;
    
    // केवल वे कॉलम शामिल करें जो DB में मौजूद हैं
    const columns = new pgp.helpers.ColumnSet([
        'uom_code', 
        'uom_name', 
        'is_active', 
    ], { table: TABLE_NAME });
    
    // INSERT के लिए डेटा
    const insertData = {
        uom_code: uom_code.trim().toUpperCase(), // कोड को UPPERCASE में रखें
        uom_name: uom_name.trim(),
        is_active: is_active, 
    };
    
    const insertQuery = pgp.helpers.insert(insertData, columns, TABLE_NAME) 
                        + ' RETURNING uom_id, uom_code, uom_name, is_active;';

    try {
        const result = await db.one(insertQuery);
        return result;
        
    } catch (error) {
        if (error.code === '23505') { // Unique constraint violation (uom_code या uom_name पर)
            throw new APIError('UOM कोड (Code) या नाम (Name) पहले से मौजूद है।', 409);
        }
        console.error('Database Error in createUom:', error);
        throw new APIError('Database insertion failed.', 500); 
    }
};

/** 2. ID द्वारा UOM को प्राप्त करता है। */
const getUomById = async (uomId) => {
    const query = pgp.as.format('SELECT uom_id, uom_code, uom_name, is_active, created_at FROM $1^ WHERE uom_id = $2', [TABLE_NAME, uomId]);
    return db.oneOrNone(query);
};

/** 3. सभी UOMs को फ़िल्टर, सर्च और पेजिंग के साथ प्राप्त करता है। */
const getAllUoms = async ({ limit, offset, search, isActive }) => {
    const params = {};
    let whereConditions = '';
    
    if (isActive !== null) {
        whereConditions += ' AND "is_active" = $<isActive>';
        params.isActive = isActive;
    }

    if (search) {
        // (कोड या नाम द्वारा खोजें)
        whereConditions += ' AND ("uom_code" ILIKE $<searchPattern> OR "uom_name" ILIKE $<searchPattern>)';
        params.searchPattern = `%${search}%`;
    }

    const baseQuery = `
        FROM ${TABLE_NAME}
        WHERE 1=1 ${whereConditions}
    `;
    
    const countQuery = `SELECT COUNT(*) ${baseQuery}`;
    
    const dataQuery = `
        SELECT uom_id, uom_code, uom_name, is_active, created_at, updated_at 
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

/** 4. UOM डेटा को अपडेट करता है। */
const updateUom = async (uomId, data) => {
    if (Object.keys(data).length === 0) {
        return getUomById(uomId); 
    }
    
    // कोड को UPPERCASE में रखें
    if (data.uom_code) {
        data.uom_code = data.uom_code.trim().toUpperCase();
    }
    
    data.updated_at = new Date(); 
    
    const updateQuery = pgp.helpers.update(data, null, TABLE_NAME) 
                        + ` WHERE uom_id = ${uomId} RETURNING uom_id, uom_code, uom_name, is_active`;
    
    try {
        const result = await db.one(updateQuery);
        return result;
    } catch (error) {
        if (error.code === '23505') {
            throw new APIError('Update failed: UOM कोड (Code) या नाम (Name) पहले से मौजूद है।', 409);
        }
        console.error('DB Error in updateUom:', error);
        throw new APIError('Database update failed.', 500);
    }
};

/** 5. UOM को निष्क्रिय (Deactivate) करता है। */
const deactivateUom = async (uomId) => {
    const query = pgp.as.format('UPDATE $1^ SET is_active = FALSE, updated_at = NOW() WHERE uom_id = $2 AND is_active = TRUE RETURNING uom_id, uom_code, is_active;', [TABLE_NAME, uomId]);
    return db.oneOrNone(query);
};

/** 6. UOM को पुनः सक्रिय (Activate) करता है। */
const activateUom = async (uomId) => {
    const query = pgp.as.format('UPDATE $1^ SET is_active = TRUE, updated_at = NOW() WHERE uom_id = $2 AND is_active = FALSE RETURNING uom_id, uom_code, is_active;', [TABLE_NAME, uomId]);
    return db.oneOrNone(query);
};


// =========================================================================
// FINAL EXPORTS
// =========================================================================

module.exports = {
    createUom,
    getUomById,
    getAllUoms,
    updateUom,
    deactivateUom,
    activateUom,
};