/*
 * Context Note: यह 'inventory_stock' और 'inventory_movements' टेबल के लिए डेटाबेस तर्क (logic) को संभालता है।
 * यह Lot/Location/Status के आधार पर स्टॉक स्तरों को ट्रैक करता है।
 * (पुराने /src/modules/inventory/stock/stock.model.js से लिया गया)
 */

// निर्भरताएँ (Dependencies)
// (पाथ फिक्स: 4 लेवल ऊपर)
const { db, pgp } = require('../../../../src/database/db'); 
const { APIError } = require('../../../utils/errorHandler'); 
const STOCK_TABLE = 'inventory_stock'; 
const MOVEMENTS_TABLE = 'inventory_movements';

// --- Core Helper Functions ---

/** स्टॉक (Stock) को Lot/Location/Status द्वारा ढूंढता है। */
const findStockRecord = (t, { lot_id, location_id, status_id }) => {
    const query = `
        SELECT stock_id, current_qty 
        FROM ${STOCK_TABLE}
        WHERE lot_id = $1 AND location_id = $2 AND status_id = $3
        FOR UPDATE; -- स्टॉक अपडेट करते समय लॉक करें
    `;
    return t.oneOrNone(query, [lot_id, location_id, status_id]);
};

/** स्टॉक मूवमेंट (Movement) बनाता है। */
const createMovement = (t, { stock_id, part_id, lot_id, from_location_id, to_location_id, from_status_id, to_status_id, quantity, movement_type, reference_doc, created_by }) => {
    const insertData = {
        stock_id, part_id, lot_id, 
        from_location_id, to_location_id, 
        from_status_id, to_status_id, 
        quantity: Number(quantity), 
        movement_type, reference_doc, created_by
    };
    
    const cs = new pgp.helpers.ColumnSet(Object.keys(insertData), { table: MOVEMENTS_TABLE });
    const insertQuery = pgp.helpers.insert(insertData, cs) + ' RETURNING movement_id;';

    return t.one(insertQuery);
};

// =========================================================================
// A. CORE STOCK MANAGEMENT FUNCTIONS
// =========================================================================

/** 1. वर्तमान स्टॉक स्तर (Current Stock Levels) प्राप्त करता है। */
const getCurrentStock = async ({ limit, offset, search, locationId, statusId }) => {
    const params = {};
    let whereConditions = '';
    
    if (locationId) {
        whereConditions += ' AND i.location_id = $<locationId>';
        params.locationId = locationId;
    }
    if (statusId) {
        whereConditions += ' AND i.status_id = $<statusId>';
        params.statusId = statusId;
    }
    if (search) {
        // (Part No, Part Name, या Location Code द्वारा खोजें)
        whereConditions += ` AND (
            mp."part_no" ILIKE $<searchPattern> 
            OR mp."part_name" ILIKE $<searchPattern> 
            OR ml."location_code" ILIKE $<searchPattern>
        )`;
        params.searchPattern = `%${search}%`;
    }

    const baseQuery = `
        FROM ${STOCK_TABLE} i
        JOIN master_parts mp ON i.part_id = mp.part_id
        JOIN master_locations ml ON i.location_id = ml.location_id
        JOIN master_stock_statuses mss ON i.status_id = mss.status_id
        WHERE i.current_qty > 0 ${whereConditions}
    `;
    
    const countQuery = `SELECT COUNT(i.stock_id) ${baseQuery}`;
    
    const dataQuery = `
        SELECT 
            i.stock_id, i.current_qty, i.lot_id, 
            mp.part_no, mp.part_name, 
            ml.location_code, mss.status_name
        ${baseQuery}
        ORDER BY mp.part_no ASC
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

/** 2. Manual Stock Adjustment बनाता है। */
const createStockAdjustment = async (data) => {
    const { 
        lot_id, part_id, location_id, status_id, 
        quantity, adjustment_type, reference_doc, created_by 
    } = data;
    
    const adjQuantity = Number(quantity);
    const isConsumption = (adjustment_type === 'CONSUMPTION' || adjustment_type === 'SCRAP');

    // Lot ID, Location ID, Status ID, और Part ID की आवश्यकता है
    if (!lot_id || !part_id || !location_id || !status_id) {
         throw new APIError('Lot, Part, Location, and Status IDs are required for adjustment.', 400);
    }
    
    // 1. ट्रांजैक्शन (Transaction) शुरू करें
    return db.tx(async t => {
        // 2. स्टॉक रिकॉर्ड प्राप्त करें (FOR UPDATE लॉक के साथ)
        let stockRecord = await findStockRecord(t, { lot_id, location_id, status_id });
        
        let stockId;
        let newQty;

        if (isConsumption) {
            // A. खपत (Consumption) / स्क्रैप (Scrap) (स्टॉक को कम करना)
            if (!stockRecord || stockRecord.current_qty < adjQuantity) {
                throw new APIError(`Insufficient stock in Lot ID ${lot_id}, Location ID ${location_id}. Available: ${stockRecord ? stockRecord.current_qty : 0}.`, 400);
            }
            stockId = stockRecord.stock_id;
            newQty = stockRecord.current_qty - adjQuantity;
        } else {
            // B. सुधार (Correction) / रसीद (Receipt) (स्टॉक बढ़ाना)
            if (stockRecord) {
                // मौजूदा रिकॉर्ड को अपडेट करें
                stockId = stockRecord.stock_id;
                newQty = stockRecord.current_qty + adjQuantity;
            } else {
                // नया रिकॉर्ड INSERT करें
                const newStock = await t.one(`
                    INSERT INTO ${STOCK_TABLE} (part_id, lot_id, location_id, status_id, current_qty)
                    VALUES ($1, $2, $3, $4, $5) RETURNING stock_id, current_qty
                `, [part_id, lot_id, location_id, status_id, adjQuantity]);
                stockId = newStock.stock_id;
                newQty = newStock.current_qty;
            }
        }
        
        // 3. Inventory Stock को अपडेट करें
        if (!stockRecord && !isConsumption) {
            // नया रिकॉर्ड पहले ही INSERT हो चुका है (चरण 2B)
        } else {
             // स्टॉक अपडेट करें (नयाqty < 0 को रोकने के लिए जाँच)
            if (newQty < 0) { throw new APIError('Cannot reduce stock below zero.', 400); }
            await t.none(`UPDATE ${STOCK_TABLE} SET current_qty = $1, updated_at = NOW() WHERE stock_id = $2`, [newQty, stockId]);
        }


        // 4. Inventory Movement रिकॉर्ड करें
        const movementData = {
            stock_id: stockId, part_id, lot_id, 
            // Location/Status केवल 'from' या 'to' के रूप में सेट करें
            from_location_id: isConsumption ? location_id : null, 
            to_location_id: isConsumption ? null : location_id,
            from_status_id: isConsumption ? status_id : null,
            to_status_id: isConsumption ? null : status_id,
            quantity: adjQuantity,
            movement_type: adjustment_type, 
            reference_doc, created_by
        };

        await createMovement(t, movementData);
        
        // 5. पूरा मूवमेंट डेटा वापस करें
        return movementData; // सादगी के लिए मूवमेंट डेटा वापस करें
    });
};

/** 3. Stock History/Movements प्राप्त करता है। */
const getStockHistory = async ({ partId, limit, offset }) => {
    const query = `
        SELECT 
            im.*,
            mp.part_no, mp.part_name,
            ml_from.location_code AS from_location,
            ml_to.location_code AS to_location,
            mss_from.status_name AS from_status,
            mss_to.status_name AS to_status
        FROM ${MOVEMENTS_TABLE} im
        JOIN master_parts mp ON im.part_id = mp.part_id
        LEFT JOIN master_locations ml_from ON im.from_location_id = ml_from.location_id
        LEFT JOIN master_locations ml_to ON im.to_location_id = ml_to.location_id
        LEFT JOIN master_stock_statuses mss_from ON im.from_status_id = mss_from.status_id
        LEFT JOIN master_stock_statuses mss_to ON im.to_status_id = mss_to.status_id
        WHERE im.part_id = $1
        ORDER BY im.created_at DESC
        LIMIT $2 OFFSET $3;
    `;
    return db.any(query, [partId, limit, offset]);
};


// (अन्य मॉडल फ़ंक्शंस यहाँ जोड़े जा सकते हैं)


// =========================================================================
// FINAL EXPORTS
// =========================================================================

module.exports = {
    getCurrentStock,
    getStockByPartId: () => [], // Lot/Location/Status द्वारा ब्रेकडाउन
    getStockHistory,
    createStockAdjustment,
    getStockByLocation: () => [], // Location ID द्वारा स्टॉक
};