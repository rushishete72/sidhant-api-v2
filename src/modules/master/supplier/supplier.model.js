/*
 * Context Note: यह 'master_suppliers' टेबल के लिए डेटाबेस तर्क (logic) को संभालता है।
 * यह db.js, errorHandler.js, और pg-promise helpers पर निर्भर करता है।
 * (पुराने /src/modules/master/supplier/supplier.model.js से लिया गया)
 */

// निर्भरताएँ (Dependencies)
const { db, pgp } = require('../../../../src/database/db'); 
const { APIError } = require('../../../utils/errorHandler'); 
const TABLE_NAME = 'master_suppliers'; 

// =========================================================================
// A. CORE CRUD FUNCTIONS
// =========================================================================

/** 1. नया सप्लायर बनाता है। */
const createSupplier = async (data) => {
    const { 
        supplier_name, supplier_code, is_active = true,
        // (पुराने कोड के फिक्स के आधार पर: created_by DB स्कीमा में नहीं है)
    } = data;
    
    // (पुराने कोड से फिक्स: केवल वे कॉलम शामिल करें जो DB में मौजूद हैं)
    const columns = new pgp.helpers.ColumnSet([
        'supplier_name', 
        'supplier_code', 
        'is_active', 
        // (DB में created_at/updated_at के लिए DEFAULT NOW() मान लिया गया है)
    ], { table: TABLE_NAME });
    
    // INSERT के लिए डेटा
    const insertData = {
        supplier_name: supplier_name.trim(), 
        supplier_code: supplier_code.trim(), 
        is_active: is_active, 
    };
    
    const insertQuery = pgp.helpers.insert(insertData, columns, TABLE_NAME) 
                        + ' RETURNING supplier_id, supplier_name, supplier_code, is_active;';

    try {
        const result = await db.one(insertQuery);
        return result;
        
    } catch (error) {
        if (error.code === '23505') { // Unique constraint violation
            throw new APIError('सप्लायर का नाम (Name) या कोड (Code) पहले से मौजूद है।', 409);
        }
        console.error('Database Error in createSupplier:', error);
        throw new APIError('Database insertion failed.', 500); 
    }
};

/** 2. ID द्वारा सप्लायर को प्राप्त करता है। */
const getSupplierById = async (supplierId) => {
    // (पुराने कोड से फिक्स: केवल कोर फ़ील्ड्स का उपयोग करें)
    const query = pgp.as.format('SELECT supplier_id, supplier_name, supplier_code, is_active, created_at FROM $1^ WHERE supplier_id = $2', [TABLE_NAME, supplierId]);
    return db.oneOrNone(query);
};

/** 3. सभी सप्लायर्स को फ़िल्टर, सर्च और पेजिंग के साथ प्राप्त करता है। */
const getAllSuppliers = async ({ limit, offset, search, isActive }) => {
    const params = {};
    let whereConditions = '';
    
    if (isActive !== null) {
        whereConditions += ' AND "is_active" = $<isActive>';
        params.isActive = isActive;
    }

    if (search) {
        // (पुराने कोड से: नाम या कोड द्वारा खोजें)
        whereConditions += ' AND ("supplier_name" ILIKE $<searchPattern> OR "supplier_code" ILIKE $<searchPattern>)';
        params.searchPattern = `%${search}%`;
    }

    const baseQuery = `
        FROM ${TABLE_NAME}
        WHERE 1=1 ${whereConditions}
    `;
    
    const countQuery = `SELECT COUNT(*) ${baseQuery}`;
    
    const dataQuery = `
        SELECT supplier_id, supplier_name, supplier_code, is_active, created_at, updated_at 
        ${baseQuery}
        ORDER BY created_at DESC
        LIMIT $<limit> OFFSET $<offset>
    `;

    params.limit = limit;
    params.offset = offset;

    // (पुराने कोड से: ट्रांजैक्शन में दोनों क्वेरी चलाएँ)
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

/** 4. सप्लायर डेटा को अपडेट करता है। */
const updateSupplier = async (supplierId, data) => {
    if (Object.keys(data).length === 0) {
        return getSupplierById(supplierId); 
    }
    
    // (पुराने कोड से: updated_at को मैन्युअल रूप से सेट करें)
    data.updated_at = new Date(); 
    
    // pgp.helpers.update केवल भेजे गए फ़ील्ड्स को अपडेट करेगा
    const updateQuery = pgp.helpers.update(data, null, TABLE_NAME) + ` WHERE supplier_id = ${supplierId} RETURNING supplier_id, supplier_name, supplier_code, is_active`;
    
    try {
        const result = await db.one(updateQuery);
        return result;
    } catch (error) {
        if (error.code === '23505') {
            throw new APIError('Update failed: सप्लायर का नाम (Name) या कोड (Code) पहले से मौजूद है।', 409);
        }
        console.error('DB Error in updateSupplier:', error);
        throw new APIError('Database update failed.', 500);
    }
};

/** 5. सप्लायर को निष्क्रिय (Deactivate) करता है। */
const deactivateSupplier = async (supplierId) => {
    const query = pgp.as.format('UPDATE $1^ SET is_active = FALSE, updated_at = NOW() WHERE supplier_id = $2 AND is_active = TRUE RETURNING supplier_id, supplier_name, is_active;', [TABLE_NAME, supplierId]);
    return db.oneOrNone(query);
};

/** 6. सप्लायर को पुनः सक्रिय (Activate) करता है। */
const activateSupplier = async (supplierId) => {
    const query = pgp.as.format('UPDATE $1^ SET is_active = TRUE, updated_at = NOW() WHERE supplier_id = $2 AND is_active = FALSE RETURNING supplier_id, supplier_name, is_active;', [TABLE_NAME, supplierId]);
    return db.oneOrNone(query);
};


// (भविष्य में और भी फ़ंक्शंस (जैसे getPartsSupplied) यहाँ जोड़े जाएँगे)


// =========================================================================
// FINAL EXPORTS
// =========================================================================

module.exports = {
    createSupplier,
    getSupplierById,
    getAllSuppliers,
    updateSupplier,
    deactivateSupplier,
    activateSupplier,
};