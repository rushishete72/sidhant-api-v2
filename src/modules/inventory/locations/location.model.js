/*
 * Context Note: यह 'master_locations' (Warehouse/Shelf Locations) टेबल के लिए डेटाबेस तर्क (logic) को संभालता है।
 * (पुराने /src/modules/inventory/locations/location.model.js से लिया गया)
 */

// निर्भरताएँ (Dependencies)
// (पाथ फिक्स: 4 लेवल ऊपर)
const { db, pgp } = require('../../../../src/database/db'); 
const { APIError } = require('../../../utils/errorHandler'); 
const TABLE_NAME = 'master_locations'; 

// =========================================================================
// A. CORE CRUD FUNCTIONS
// =========================================================================

/** 1. नया Location बनाता है। */
const createLocation = async (data) => {
    const { 
        location_code, location_name, is_active = true, created_by
    } = data;
    
    // केवल वे कॉलम शामिल करें जो DB में मौजूद हैं
    const columns = new pgp.helpers.ColumnSet([
        'location_code', 
        'location_name', 
        'is_active', 
    ], { table: TABLE_NAME });
    
    // INSERT के लिए डेटा
    const insertData = {
        location_code: location_code.trim().toUpperCase(), // कोड को UPPERCASE में रखें
        location_name: location_name.trim(),
        is_active: is_active, 
        // created_by को मॉडल में नहीं, बल्कि log/metadata में उपयोग करें
    };
    
    const insertQuery = pgp.helpers.insert(insertData, columns, TABLE_NAME) 
                        + ' RETURNING location_id, location_code, location_name, is_active;';

    try {
        const result = await db.one(insertQuery);
        
        // (यदि आवश्यक हो तो यहां created_by के साथ एक मूवमेंट/लॉग रिकॉर्ड करें)
        
        return result;
        
    } catch (error) {
        if (error.code === '23505') { // Unique constraint violation (location_code)
            throw new APIError('यह लोकेशन कोड (Location Code) पहले से मौजूद है।', 409);
        }
        console.error('Database Error in createLocation:', error);
        throw new APIError('Database insertion failed.', 500); 
    }
};

/** 2. ID द्वारा Location को प्राप्त करता है। */
const getLocationById = async (locationId) => {
    const query = pgp.as.format('SELECT location_id, location_code, location_name, is_active, created_at FROM $1^ WHERE location_id = $2', [TABLE_NAME, locationId]);
    return db.oneOrNone(query);
};

/** 3. सभी Locations को फ़िल्टर, सर्च और पेजिंग के साथ प्राप्त करता है। */
const getAllLocations = async ({ limit, offset, search, isActive }) => {
    const params = {};
    let whereConditions = '';
    
    if (isActive !== null) {
        whereConditions += ' AND "is_active" = $<isActive>';
        params.isActive = isActive;
    }

    if (search) {
        // (कोड या नाम द्वारा खोजें)
        whereConditions += ' AND ("location_code" ILIKE $<searchPattern> OR "location_name" ILIKE $<searchPattern>)';
        params.searchPattern = `%${search}%`;
    }

    const baseQuery = `
        FROM ${TABLE_NAME}
        WHERE 1=1 ${whereConditions}
    `;
    
    const countQuery = `SELECT COUNT(*) ${baseQuery}`;
    
    const dataQuery = `
        SELECT location_id, location_code, location_name, is_active, created_at, updated_at 
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

/** 4. Location डेटा को अपडेट करता है। */
const updateLocation = async (locationId, data) => {
    if (Object.keys(data).length === 0) {
        return getLocationById(locationId); 
    }
    
    // कोड को UPPERCASE में रखें
    if (data.location_code) {
        data.location_code = data.location_code.trim().toUpperCase();
    }
    
    data.updated_at = new Date(); 
    
    const updateQuery = pgp.helpers.update(data, null, TABLE_NAME) 
                        + ` WHERE location_id = ${locationId} RETURNING location_id, location_code, location_name, is_active`;
    
    try {
        const result = await db.one(updateQuery);
        return getLocationById(result.location_id);
    } catch (error) {
        if (error.code === '23505') {
            throw new APIError('अपडेट विफल: यह लोकेशन कोड (Location Code) पहले से मौजूद है।', 409);
        }
        console.error('DB Error in updateLocation:', error);
        throw new APIError('Database update failed.', 500);
    }
};

/** 5. Location को निष्क्रिय (Deactivate) करता है। */
const deactivateLocation = async (locationId) => {
    const query = pgp.as.format('UPDATE $1^ SET is_active = FALSE, updated_at = NOW() WHERE location_id = $2 AND is_active = TRUE RETURNING location_id, location_code, is_active;', [TABLE_NAME, locationId]);
    return db.oneOrNone(query);
};


// =========================================================================
// FINAL EXPORTS
// =========================================================================

module.exports = {
    createLocation,
    getLocationById,
    getAllLocations,
    updateLocation,
    deactivateLocation,
};