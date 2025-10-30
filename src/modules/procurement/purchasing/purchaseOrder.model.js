/*
 * Context Note: यह 'procurement_purchase_orders' और 'procurement_po_items' टेबल के लिए डेटाबेस तर्क (logic) को संभालता है।
 * यह PO Creation, Status Change, और Line Item management को हैंडल करता है।
 * (पुराने /src/modules/procurement/purchasing/purchaseOrder.model.js से लिया गया)
 */

// निर्भरताएँ (Dependencies)
// (पाथ फिक्स: 4 लेवल ऊपर)
const { db, pgp } = require('../../../../src/database/db'); 
const { APIError } = require('../../../utils/errorHandler'); 
const PO_TABLE = 'procurement_purchase_orders';
const PO_ITEMS_TABLE = 'procurement_po_items';

// --- Helper Functions ---

/** एक नया PO Number (जैसे: PO-2025-000001) जनरेट करता है। */
const generatePONumber = async (t) => {
    // अनुक्रम (sequence) को कॉल करें
    const result = await t.one('SELECT nextval(\'po_number_seq\') AS next_id');
    const nextId = String(result.next_id).padStart(6, '0');
    const year = new Date().getFullYear();
    return `PO-${year}-${nextId}`;
};

/** PO ID द्वारा PO Header और Line Items प्राप्त करता है। */
const getPoDetailsById = async (poId) => {
    // 1. PO Header प्राप्त करें
    const poHeaderQuery = `
        SELECT 
            pop.*, 
            ms.supplier_name
        FROM ${PO_TABLE} pop
        JOIN master_suppliers ms ON pop.supplier_id = ms.supplier_id
        WHERE pop.po_id = $1;
    `;
    const poHeader = await db.oneOrNone(poHeaderQuery, [poId]);
    
    if (!poHeader) return null;

    // 2. Line Items प्राप्त करें
    const poItemsQuery = `
        SELECT 
            poi.*,
            mp.part_no, mp.part_name,
            mu.uom_code
        FROM ${PO_ITEMS_TABLE} poi
        JOIN master_parts mp ON poi.part_id = mp.part_id
        JOIN master_uoms mu ON poi.uom_id = mu.uom_id
        WHERE poi.po_id = $1
        ORDER BY poi.po_item_id ASC;
    `;
    poHeader.items = await db.any(poItemsQuery, [poId]);
    
    return poHeader;
};

// =========================================================================
// A. CORE PO MANAGEMENT FUNCTIONS
// =========================================================================

/** 1. नया Purchase Order बनाता है। (Header + Line Items) */
const createPurchaseOrder = async (data) => {
    const { 
        supplier_id, delivery_location_id, payment_terms, po_items, created_by 
    } = data;
    
    if (!po_items || po_items.length === 0) {
        throw new APIError('PO में कम से कम एक लाइन आइटम (Line Item) होना चाहिए।', 400);
    }
    
    // 1. ट्रांजैक्शन (Transaction) शुरू करें
    return db.tx(async t => {
        // 2. PO Number जनरेट करें
        const po_number = await generatePONumber(t);

        // 3. PO Header INSERT करें
        const poHeaderData = {
            po_number,
            supplier_id: Number(supplier_id), 
            delivery_location_id: Number(delivery_location_id) || null,
            payment_terms: payment_terms,
            // डिफ़ॉल्ट स्थिति: PENDING
            status: 'PENDING', 
            created_by: created_by,
        };
        
        const headerCols = new pgp.helpers.ColumnSet(Object.keys(poHeaderData), { table: PO_TABLE });
        const headerQuery = pgp.helpers.insert(poHeaderData, headerCols, PO_TABLE) 
                            + ' RETURNING po_id;';

        const poResult = await t.one(headerQuery);
        const poId = poResult.po_id;
        
        // 4. PO Line Items INSERT करें
        const poLineItemsData = po_items.map(item => ({
            po_id: poId,
            part_id: Number(item.part_id),
            uom_id: Number(item.uom_id),
            quantity: Number(item.quantity),
            unit_price: Number(item.unit_price) || 0,
            required_date: item.required_date // Date object/string
        }));
        
        const itemCols = new pgp.helpers.ColumnSet(Object.keys(poLineItemsData[0]), { table: PO_ITEMS_TABLE });
        const itemQuery = pgp.helpers.insert(poLineItemsData, itemCols, PO_ITEMS_TABLE);
        
        await t.none(itemQuery);
        
        // 5. पूरा PO विवरण लौटाएँ
        return getPoDetailsById(poId);
    });
};

/** 2. ID द्वारा Purchase Order प्राप्त करता है। */
const getPurchaseOrderById = async (poId) => {
    return getPoDetailsById(poId);
};

/** 3. सभी Purchase Orders को फ़िल्टर, सर्च और पेजिंग के साथ प्राप्त करता है। */
const getAllPurchaseOrders = async ({ limit, offset, search, status }) => {
    const params = {};
    let whereConditions = '';
    
    if (status) {
        whereConditions += ' AND pop.status = $<status>';
        params.status = status.toUpperCase();
    }

    if (search) {
        // (PO Number, Supplier Name द्वारा खोजें)
        whereConditions += ` AND (
            pop."po_number" ILIKE $<searchPattern> 
            OR ms."supplier_name" ILIKE $<searchPattern>
        )`;
        params.searchPattern = `%${search}%`;
    }

    const baseQuery = `
        FROM ${PO_TABLE} pop
        JOIN master_suppliers ms ON pop.supplier_id = ms.supplier_id
        WHERE 1=1 ${whereConditions}
    `;
    
    const countQuery = `SELECT COUNT(*) ${baseQuery}`;
    
    const dataQuery = `
        SELECT 
            pop.po_id, pop.po_number, pop.status, pop.total_amount, 
            ms.supplier_name, pop.created_at
        ${baseQuery}
        ORDER BY pop.created_at DESC
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

/** 4. Purchase Order डेटा को अपडेट करता है (केवल PENDING स्थिति में)। */
const updatePurchaseOrder = async (poId, data) => {
    if (Object.keys(data).length === 0) { return getPoDetailsById(poId); }
    
    // 1. PO की वर्तमान स्थिति (Status) की जाँच करें
    const po = await db.oneOrNone('SELECT status FROM ${PO_TABLE} WHERE po_id = $1', [poId]);
    
    if (!po) return null; // PO नहीं मिला

    if (po.status !== 'PENDING') {
         throw new APIError(`Purchase Order ID ${poId} को केवल 'PENDING' स्थिति में ही अपडेट किया जा सकता है (वर्तमान स्थिति: ${po.status})।`, 400);
    }
    
    // 2. Header और Items डेटा को विभाजित करें
    const { po_items, ...headerData } = data;
    
    headerData.updated_at = new Date();
    
    // 3. ट्रांजैक्शन (Transaction) शुरू करें
    return db.tx(async t => {
        // A. PO Header अपडेट करें (यदि कोई Header डेटा है)
        if (Object.keys(headerData).length > 0) {
            const headerQuery = pgp.helpers.update(headerData, null, PO_TABLE) 
                                + ` WHERE po_id = ${poId} RETURNING po_id;`;
            await t.none(headerQuery);
        }
        
        // B. Line Items को पूरी तरह से फिर से लिखें (Simplification)
        if (po_items && po_items.length > 0) {
            // पुराने आइटम्स हटाएँ
            await t.none('DELETE FROM ${PO_ITEMS_TABLE} WHERE po_id = $1', [poId]);

            // नए आइटम्स INSERT करें
            const poLineItemsData = po_items.map(item => ({
                po_id: poId,
                part_id: Number(item.part_id),
                uom_id: Number(item.uom_id),
                quantity: Number(item.quantity),
                unit_price: Number(item.unit_price) || 0,
                required_date: item.required_date 
            }));
            
            const itemCols = new pgp.helpers.ColumnSet(Object.keys(poLineItemsData[0]), { table: PO_ITEMS_TABLE });
            const itemQuery = pgp.helpers.insert(poLineItemsData, itemCols, PO_ITEMS_TABLE);
            
            await t.none(itemQuery);
        }

        // 4. पूरा PO विवरण लौटाएँ
        return getPoDetailsById(poId);
    });
};

/** 5. Purchase Order को Approve/Authorize करता है। */
const authorizePurchaseOrder = async (poId, authorizerId) => {
    // 1. PO की वर्तमान स्थिति (Status) की जाँच करें
    const po = await db.oneOrNone('SELECT status FROM ${PO_TABLE} WHERE po_id = $1', [poId]);
    
    if (!po) return null;
    if (po.status !== 'PENDING') {
         throw new APIError(`Purchase Order ID ${poId} को केवल 'PENDING' स्थिति में ही Approve किया जा सकता है (वर्तमान स्थिति: ${po.status})।`, 400);
    }
    
    // 2. अपडेट करें
    const updateQuery = pgp.as.format(`
        UPDATE ${PO_TABLE} 
        SET status = 'AUTHORIZED', authorized_by = $2, authorized_at = NOW(), updated_at = NOW() 
        WHERE po_id = $1 
        RETURNING po_id;
    `, [poId, authorizerId]);
    
    const result = await db.oneOrNone(updateQuery);
    if (!result) return null;
    
    return getPoDetailsById(poId);
};

/** 6. Purchase Order को Cancel करता है। */
const cancelPurchaseOrder = async (poId, cancellerId) => {
    // 1. PO की वर्तमान स्थिति (Status) की जाँच करें (RECEIVED को Cancel नहीं किया जा सकता)
    const po = await db.oneOrNone('SELECT status FROM ${PO_TABLE} WHERE po_id = $1', [poId]);
    
    if (!po) return null;
    if (po.status === 'RECEIVED' || po.status === 'CANCELLED') {
         throw new APIError(`Purchase Order ID ${poId} को वर्तमान स्थिति (${po.status}) में Cancel नहीं किया जा सकता।`, 400);
    }
    
    // 2. अपडेट करें
    const updateQuery = pgp.as.format(`
        UPDATE ${PO_TABLE} 
        SET status = 'CANCELLED', cancelled_by = $2, cancelled_at = NOW(), updated_at = NOW() 
        WHERE po_id = $1 
        RETURNING po_id;
    `, [poId, cancellerId]);
    
    const result = await db.oneOrNone(updateQuery);
    if (!result) return null;
    
    return getPoDetailsById(poId);
};

// 7. PO Line Items प्राप्त करता है।
const getPoItemsByPoId = async (poId) => {
    // यह getPoDetailsById द्वारा पहले ही कवर किया जा चुका है, लेकिन यदि केवल items चाहिए
    const poItemsQuery = `
        SELECT 
            poi.*,
            mp.part_no, mp.part_name,
            mu.uom_code
        FROM ${PO_ITEMS_TABLE} poi
        JOIN master_parts mp ON poi.part_id = mp.part_id
        JOIN master_uoms mu ON poi.uom_id = mu.uom_id
        WHERE poi.po_id = $1
        ORDER BY poi.po_item_id ASC;
    `;
    return db.any(poItemsQuery, [poId]);
};


// =========================================================================
// FINAL EXPORTS
// =========================================================================

module.exports = {
    createPurchaseOrder,
    getPurchaseOrderById,
    getAllPurchaseOrders,
    updatePurchaseOrder,
    authorizePurchaseOrder,
    cancelPurchaseOrder,
    getPoItemsByPoId,
};