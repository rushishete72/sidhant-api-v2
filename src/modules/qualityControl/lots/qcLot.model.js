/*
 * Context Note: यह 'quality_control_lots' टेबल के लिए डेटाबेस तर्क (logic) को संभालता है।
 * यह Lot Creation, Status Change, और Finalization को हैंडल करता है।
 * (पुराने /src/modules/qualityControl/lots/qcLot.model.js से लिया गया)
 */

// निर्भरताएँ (Dependencies)
// (पाथ फिक्स: 4 लेवल ऊपर)
const { db, pgp } = require('../../../../src/database/db'); 
const { APIError } = require('../../../utils/errorHandler'); 
const TABLE_NAME = 'quality_control_lots'; 

// --- Helper Functions ---

/** एक नया Lot Number (जैसे: QCL-2025-000001) जनरेट करता है। */
const generateLotNumber = async (t) => {
    // अनुक्रम (sequence) को कॉल करें
    const result = await t.one('SELECT nextval(\'qc_lot_number_seq\') AS next_id');
    const nextId = String(result.next_id).padStart(6, '0');
    const year = new Date().getFullYear();
    return `QCL-${year}-${nextId}`;
};

/** Lot ID द्वारा Lot और उससे जुड़े Part/Supplier/Status विवरण प्राप्त करता है। */
const getLotDetailsById = async (lotId) => {
    const query = `
        SELECT 
            qcl.*, 
            mp.part_no, mp.part_name, 
            ms.supplier_name,
            qcls.status_name AS current_status
        FROM ${TABLE_NAME} qcl
        JOIN master_parts mp ON qcl.part_id = mp.part_id
        LEFT JOIN master_suppliers ms ON qcl.supplier_id = ms.supplier_id
        LEFT JOIN qc_lot_statuses qcls ON qcl.status = qcls.status_code
        WHERE qcl.lot_id = $1;
    `;
    return db.oneOrNone(query, [lotId]);
};

// =========================================================================
// A. CORE CRUD & STATUS MANAGEMENT FUNCTIONS
// =========================================================================

/** 1. नया QC Lot बनाता है। */
const createQcLot = async (data) => {
    const { 
        part_id, supplier_id, lot_quantity, document_ref, created_by 
    } = data;
    
    // ट्रांजैक्शन (Transaction) शुरू करें: Lot Number जनरेट करें और Lot INSERT करें
    return db.tx(async t => {
        // 1. Lot Number जनरेट करें
        const lot_number = await generateLotNumber(t);

        // 2. Lot INSERT करें
        const insertData = {
            lot_number,
            part_id: Number(part_id), 
            supplier_id: Number(supplier_id) || null,
            lot_quantity: Number(lot_quantity),
            document_ref: document_ref ? document_ref.trim() : null,
            // डिफ़ॉल्ट स्थिति: PENDING
            status: 'PENDING', 
            created_by: created_by,
        };
        
        const columns = new pgp.helpers.ColumnSet(Object.keys(insertData), { table: TABLE_NAME });
        const insertQuery = pgp.helpers.insert(insertData, columns, TABLE_NAME) 
                            + ' RETURNING lot_id;';

        const result = await t.one(insertQuery);
        
        // 3. पूरा Lot विवरण लौटाएँ
        return getLotDetailsById(result.lot_id);
    });
};

/** 2. ID द्वारा QC Lot को प्राप्त करता है। */
const getQcLotById = async (lotId) => {
    return getLotDetailsById(lotId);
};

/** 3. सभी QC Lots को फ़िल्टर, सर्च और पेजिंग के साथ प्राप्त करता है। */
const getAllQcLots = async ({ limit, offset, search, status }) => {
    const params = {};
    let whereConditions = '';
    
    if (status) {
        whereConditions += ' AND qcl.status = $<status>';
        params.status = status.toUpperCase();
    }

    if (search) {
        // (Lot Number, Part No, Part Name, या Supplier Name द्वारा खोजें)
        whereConditions += ` AND (
            qcl."lot_number" ILIKE $<searchPattern> 
            OR mp."part_no" ILIKE $<searchPattern> 
            OR ms."supplier_name" ILIKE $<searchPattern>
        )`;
        params.searchPattern = `%${search}%`;
    }

    const baseQuery = `
        FROM ${TABLE_NAME} qcl
        JOIN master_parts mp ON qcl.part_id = mp.part_id
        LEFT JOIN master_suppliers ms ON qcl.supplier_id = ms.supplier_id
        LEFT JOIN qc_lot_statuses qcls ON qcl.status = qcls.status_code
        WHERE 1=1 ${whereConditions}
    `;
    
    const countQuery = `SELECT COUNT(*) ${baseQuery}`;
    
    const dataQuery = `
        SELECT 
            qcl.lot_id, qcl.lot_number, qcl.lot_quantity, qcl.status, qcls.status_name, 
            mp.part_no, mp.part_name, ms.supplier_name, qcl.created_at
        ${baseQuery}
        ORDER BY qcl.created_at DESC
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

/** 4. QC Lot डेटा को अपडेट करता है (माध्यमिक विवरण)। */
const updateQcLot = async (lotId, data) => {
    if (Object.keys(data).length === 0) {
        return getLotDetailsById(lotId); 
    }
    
    // केवल Lot Number, Status, और ID को अपडेट न करने दें
    delete data.lot_number;
    delete data.status;
    delete data.lot_id;
    
    data.updated_at = new Date(); 
    
    // यदि Lot पहले से ही बंद है, तो अपडेट को अस्वीकार करें
    const currentLot = await db.oneOrNone('SELECT status FROM ${TABLE_NAME} WHERE lot_id = $1', [lotId]);
    if (currentLot && (currentLot.status === 'APPROVED' || currentLot.status === 'REJECTED')) {
         throw new APIError(`Lot ID ${lotId} cannot be updated as its status is already ${currentLot.status}.`, 400);
    }
    
    const updateQuery = pgp.helpers.update(data, null, TABLE_NAME) 
                        + ` WHERE lot_id = ${lotId} RETURNING lot_id`;
    
    try {
        const result = await db.oneOrNone(updateQuery);
        if (!result) return null;
        
        return getLotDetailsById(result.lot_id);

    } catch (error) {
        console.error('DB Error in updateQcLot:', error);
        throw new APIError('Database update failed.', 500);
    }
};

/** 5. QC Lot को Final Status (APPROVED/REJECTED) के साथ बंद करता है। */
const closeQcLot = async ({ lotId, final_status, total_accepted_qty, rejection_reason_id, finalized_by }) => {
    
    // Lot को बंद करने से पहले यह जाँच करें कि वह 'PENDING' या 'IN_INSPECTION' में है
    const currentLot = await db.oneOrNone('SELECT status, lot_quantity FROM ${TABLE_NAME} WHERE lot_id = $1', [lotId]);
    
    if (!currentLot) return null; // Lot नहीं मिला

    if (currentLot.status === 'APPROVED' || currentLot.status === 'REJECTED') {
         throw new APIError(`Lot ID ${lotId} cannot be closed as its status is already ${currentLot.status}.`, 400);
    }

    if (total_accepted_qty > currentLot.lot_quantity) {
        throw new APIError('Accepted quantity cannot be greater than lot quantity.', 400);
    }
    
    // अपडेट करें
    const updateData = {
        status: final_status,
        finalized_by: finalized_by,
        finalized_at: new Date(),
        total_accepted_qty: total_accepted_qty,
        total_rejected_qty: currentLot.lot_quantity - total_accepted_qty,
        rejection_reason_id: rejection_reason_id,
        updated_at: new Date()
    };
    
    const updateQuery = pgp.helpers.update(updateData, null, TABLE_NAME) 
                        + ` WHERE lot_id = ${lotId} RETURNING lot_id`;
    
    const result = await db.oneOrNone(updateQuery);
    if (!result) return null;
    
    // यदि APPROVED है, तो Lot को Inventory में स्थानांतरित (transfer) करने के लिए एक अलग सेवा/ट्रिगर की आवश्यकता होगी
    
    return getLotDetailsById(result.lot_id);
};

/** 6. पेंडिंग Lot Count प्राप्त करता है (डैशबोर्ड के लिए)। */
const getPendingLotCount = async () => {
    const query = `
        SELECT
            SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) AS pending_lots,
            SUM(CASE WHEN status = 'IN_INSPECTION' THEN 1 ELSE 0 END) AS in_inspection_lots,
            COUNT(lot_id) AS total_pending
        FROM ${TABLE_NAME}
        WHERE status IN ('PENDING', 'IN_INSPECTION');
    `;
    // db.one का उपयोग करें, क्योंकि COUNT हमेशा एक पंक्ति (row) लौटाता है
    const result = await db.one(query); 
    
    return {
        pending_lots: Number(result.pending_lots) || 0,
        in_inspection_lots: Number(result.in_inspection_lots) || 0,
        total_pending: Number(result.total_pending) || 0
    };
};


// =========================================================================
// FINAL EXPORTS
// =========================================================================

module.exports = {
    createQcLot,
    getQcLotById,
    getAllQcLots,
    updateQcLot,
    closeQcLot,
    getPendingLotCount,
};