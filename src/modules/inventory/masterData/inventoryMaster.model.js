/*
 * Context Note: यह 'master_stock_types' और 'master_stock_statuses' टेबल के लिए डेटाबेस तर्क (logic) को संभालता है।
 * (पुराने /src/modules/inventory/masterData/inventoryMaster.model.js से लिया गया)
 */

// निर्भरताएँ (Dependencies)
// (पाथ फिक्स: 4 लेवल ऊपर)
const { db, pgp } = require('../../../../src/database/db'); 
const { APIError } = require('../../../utils/errorHandler'); 
const TYPES_TABLE = 'master_stock_types'; 
const STATUSES_TABLE = 'master_stock_statuses'; 

// =========================================================================
// A. Stock Types (master_stock_types)
// =========================================================================

/** 1. सभी Stock Types को प्राप्त करता है। */
const getAllStockTypes = async () => {
    const query = `
        SELECT type_id, type_code, type_name, is_active 
        FROM ${TYPES_TABLE} 
        ORDER BY type_code ASC;
    `;
    return db.any(query);
};

/** 2. नया Stock Type बनाता है। */
const createStockType = async (data) => {
    const { type_code, type_name, is_active = true } = data;
    
    const insertData = {
        type_code: type_code.trim().toUpperCase(),
        type_name: type_name.trim(),
        is_active: is_active, 
    };
    
    const columns = new pgp.helpers.ColumnSet(Object.keys(insertData), { table: TYPES_TABLE });
    const insertQuery = pgp.helpers.insert(insertData, columns, TYPES_TABLE) 
                        + ' RETURNING type_id, type_code, type_name, is_active;';

    try {
        return db.one(insertQuery);
    } catch (error) {
        if (error.code === '23505') { // Unique constraint violation
            throw new APIError('यह Stock Type Code या Name पहले से मौजूद है।', 409);
        }
        console.error('Database Error in createStockType:', error);
        throw new APIError('Database insertion failed.', 500); 
    }
};

/** 3. Stock Type को अपडेट करता है। */
const updateStockType = async (typeId, data) => {
    if (Object.keys(data).length === 0) return db.oneOrNone('SELECT type_id, type_code, type_name, is_active FROM ${TYPES_TABLE} WHERE type_id = $1', [typeId]);
    
    if (data.type_code) { data.type_code = data.type_code.trim().toUpperCase(); }
    data.updated_at = new Date(); 

    const updateQuery = pgp.helpers.update(data, null, TYPES_TABLE) 
                        + ` WHERE type_id = ${typeId} RETURNING type_id, type_code, type_name, is_active;`;
    
    try {
        return db.oneOrNone(updateQuery);
    } catch (error) {
        if (error.code === '23505') {
            throw new APIError('अपडेट विफल: यह Stock Type Code या Name पहले से मौजूद है।', 409);
        }
        console.error('DB Error in updateStockType:', error);
        throw new APIError('Database update failed.', 500);
    }
};

// =========================================================================
// B. Stock Statuses (master_stock_statuses)
// =========================================================================

/** 4. सभी Stock Statuses को प्राप्त करता है। */
const getAllStockStatuses = async () => {
    const query = `
        SELECT status_id, status_code, status_name, is_active, is_negative_allowed 
        FROM ${STATUSES_TABLE} 
        ORDER BY status_code ASC;
    `;
    return db.any(query);
};

/** 5. नया Stock Status बनाता है। */
const createStockStatus = async (data) => {
    const { status_code, status_name, is_negative_allowed = false, is_active = true } = data;
    
    const insertData = {
        status_code: status_code.trim().toUpperCase(),
        status_name: status_name.trim(),
        is_negative_allowed: is_negative_allowed,
        is_active: is_active, 
    };
    
    const columns = new pgp.helpers.ColumnSet(Object.keys(insertData), { table: STATUSES_TABLE });
    const insertQuery = pgp.helpers.insert(insertData, columns, STATUSES_TABLE) 
                        + ' RETURNING status_id, status_code, status_name, is_active, is_negative_allowed;';

    try {
        return db.one(insertQuery);
    } catch (error) {
        if (error.code === '23505') { // Unique constraint violation
            throw new APIError('यह Stock Status Code या Name पहले से मौजूद है।', 409);
        }
        console.error('Database Error in createStockStatus:', error);
        throw new APIError('Database insertion failed.', 500); 
    }
};

/** 6. Stock Status को अपडेट करता है। */
const updateStockStatus = async (statusId, data) => {
    if (Object.keys(data).length === 0) return db.oneOrNone('SELECT status_id, status_code, status_name, is_active, is_negative_allowed FROM ${STATUSES_TABLE} WHERE status_id = $1', [statusId]);

    if (data.status_code) { data.status_code = data.status_code.trim().toUpperCase(); }
    data.updated_at = new Date(); 

    const updateQuery = pgp.helpers.update(data, null, STATUSES_TABLE) 
                        + ` WHERE status_id = ${statusId} RETURNING status_id, status_code, status_name, is_active, is_negative_allowed;`;
    
    try {
        return db.oneOrNone(updateQuery);
    } catch (error) {
        if (error.code === '23505') {
            throw new APIError('अपडेट विफल: यह Stock Status Code या Name पहले से मौजूद है।', 409);
        }
        console.error('DB Error in updateStockStatus:', error);
        throw new APIError('Database update failed.', 500);
    }
};


// =========================================================================
// FINAL EXPORTS
// =========================================================================

module.exports = {
    getAllStockTypes,
    createStockType,
    updateStockType,
    getAllStockStatuses,
    createStockStatus,
    updateStockStatus,
};