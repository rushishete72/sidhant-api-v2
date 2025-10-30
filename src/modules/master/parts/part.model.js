/*
 * Context Note: यह 'master_parts' टेबल के लिए डेटाबेस तर्क (logic) को संभालता है।
 * यह db.js, errorHandler.js, और pg-promise helpers पर निर्भर करता है।
 * (पुराने /src/modules/master/parts/part.model.js से लिया गया)
 */

// निर्भरताएँ (Dependencies)
const { db, pgp } = require('../../../../src/database/db'); 
const { APIError } = require('../../../utils/errorHandler'); 
const TABLE_NAME = 'master_parts'; 

// =========================================================================
// A. CORE CRUD FUNCTIONS
// =========================================================================

/** 1. नया पार्ट बनाता है। */
const createPart = async (data) => {
    const { 
        part_no, rev_no, part_name, uom_id, 
        drawing_no, material_spec, std_weight_gm, std_lead_time_days, 
        is_active = true,
    } = data;
    
    // केवल वे कॉलम शामिल करें जो DB में मौजूद हैं
    const columns = new pgp.helpers.ColumnSet([
        'part_no', 
        'rev_no', 
        'part_name', 
        'uom_id',
        'drawing_no', 
        'material_spec', 
        'std_weight_gm', 
        'std_lead_time_days', 
        'is_active', 
    ], { table: TABLE_NAME });
    
    // INSERT के लिए डेटा
    const insertData = {
        part_no: part_no.trim(), 
        rev_no: rev_no.trim(), 
        part_name: part_name.trim(),
        uom_id: uom_id,
        drawing_no: drawing_no ? drawing_no.trim() : null,
        material_spec: material_spec ? material_spec.trim() : null,
        std_weight_gm: std_weight_gm || null,
        std_lead_time_days: std_lead_time_days || null,
        is_active: is_active, 
    };
    
    const insertQuery = pgp.helpers.insert(insertData, columns, TABLE_NAME) 
                        + ' RETURNING part_id, part_no, rev_no, part_name, uom_id, is_active;';

    try {
        const result = await db.one(insertQuery);
        return result;
        
    } catch (error) {
        if (error.code === '23505') { // Unique constraint violation (part_no, rev_no)
            throw new APIError('पार्ट नंबर (Part No) और रिविज़न नंबर (Rev No) का संयोजन पहले से मौजूद है।', 409);
        }
        console.error('Database Error in createPart:', error);
        throw new APIError('Database insertion failed.', 500); 
    }
};

/** 2. ID द्वारा पार्ट को प्राप्त करता है। */
const getPartById = async (partId) => {
    // Note: SELECT क्वेरी में uom_id और अन्य फ़ील्ड्स को शामिल करें।
    const query = pgp.as.format('SELECT * FROM $1^ WHERE part_id = $2', [TABLE_NAME, partId]);
    return db.oneOrNone(query);
};

/** 3. सभी पार्ट्स को फ़िल्टर, सर्च और पेजिंग के साथ प्राप्त करता है। */
const getAllParts = async ({ limit, offset, search, isActive }) => {
    const params = {};
    let whereConditions = '';
    
    if (isActive !== null) {
        whereConditions += ' AND "is_active" = $<isActive>';
        params.isActive = isActive;
    }

    if (search) {
        // (पार्ट नंबर या नाम द्वारा खोजें)
        whereConditions += ' AND ("part_no" ILIKE $<searchPattern> OR "part_name" ILIKE $<searchPattern>)';
        params.searchPattern = `%${search}%`;
    }

    const baseQuery = `
        FROM ${TABLE_NAME}
        WHERE 1=1 ${whereConditions}
    `;
    
    const countQuery = `SELECT COUNT(*) ${baseQuery}`;
    
    const dataQuery = `
        SELECT part_id, part_no, rev_no, part_name, uom_id, is_active, created_at
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

/** 4. पार्ट डेटा को अपडेट करता है। */
const updatePart = async (partId, data) => {
    if (Object.keys(data).length === 0) {
        return getPartById(partId); 
    }
    
    data.updated_at = new Date(); 
    
    // pgp.helpers.update केवल भेजे गए फ़ील्ड्स को अपडेट करेगा
    const updateQuery = pgp.helpers.update(data, null, TABLE_NAME) 
                        + ` WHERE part_id = ${partId} RETURNING part_id, part_no, rev_no, part_name, is_active`;
    
    try {
        const result = await db.one(updateQuery);
        return result;
    } catch (error) {
        if (error.code === '23505') {
            throw new APIError('अपडेट विफल: पार्ट नंबर और रिविज़न नंबर का संयोजन पहले से मौजूद है।', 409);
        }
        console.error('DB Error in updatePart:', error);
        throw new APIError('Database update failed.', 500);
    }
};

/** 5. पार्ट को निष्क्रिय (Deactivate) करता है। */
const deactivatePart = async (partId) => {
    const query = pgp.as.format('UPDATE $1^ SET is_active = FALSE, updated_at = NOW() WHERE part_id = $2 AND is_active = TRUE RETURNING part_id, part_no, is_active;', [TABLE_NAME, partId]);
    return db.oneOrNone(query);
};

/** 6. पार्ट को पुनः सक्रिय (Activate) करता है। */
const activatePart = async (partId) => {
    const query = pgp.as.format('UPDATE $1^ SET is_active = TRUE, updated_at = NOW() WHERE part_id = $2 AND is_active = FALSE RETURNING part_id, part_no, is_active;', [TABLE_NAME, partId]);
    return db.oneOrNone(query);
};


// =========================================================================
// FINAL EXPORTS
// =========================================================================

module.exports = {
    createPart,
    getPartById,
    getAllParts,
    updatePart,
    deactivatePart,
    activatePart,
};