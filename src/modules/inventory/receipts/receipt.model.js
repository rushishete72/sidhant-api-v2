// modules/inventory/receipts/receipt.model.js (Goods Receipt - 15 Functions)

const db = require('../../../../src/database/db'); 
const pgp = require('pg-promise')({ capSQL: true });

// =========================================================================
// A. RECEIPT DOCUMENT MANAGEMENT (5)
// =========================================================================

/** 1. एक नया Goods Receipt Document (Header) बनाता है। */
const createGoodsReceipt = async (data) => {
    // Note: po_id, warehouse_id, received_by, status (e.g., PENDING_QC) अनिवार्य हैं।
    const columnSet = new pgp.helpers.ColumnSet([
        'po_id', 'warehouse_id', 'received_by_user_id', 'receipt_date', 'status'
    ], { table: 'inventory_receipts' });
    const query = pgp.helpers.insert(data, columnSet) + ' RETURNING *';
    return db.one(query); 
};

/** 2. GR ID द्वारा एक Goods Receipt Header प्राप्त करता है। */
const getGoodsReceiptHeaderById = async (receiptId) => {
    return db.oneOrNone('SELECT * FROM inventory_receipts WHERE receipt_id = $1', [receiptId]);
};

/** 3. एक GR Document के लिए सभी Items (Lines) जोड़ता है। (Bulk Insert) */
const addReceiptItems = async (receiptItems) => {
    // Note: receipt_id, part_id, received_qty, uom_id, receiving_bin_id, lot_number अनिवार्य हैं।
    const columnSet = new pgp.helpers.ColumnSet([
        'receipt_id', 'part_id', 'received_qty', 'uom_id', 'receiving_bin_id', 
        'lot_number', 'expiry_date', 'qc_status', 'is_posted'
    ], { table: 'inventory_receipt_items' });
    const query = pgp.helpers.insert(receiptItems, columnSet);
    return db.none(query); // No RETURNING * for bulk insert, just confirm success
};

/** 4. PO ID द्वारा एक Goods Receipt Document प्राप्त करता है। (PO to GR link) */
const getReceiptByPoId = async (poId) => {
    return db.oneOrNone('SELECT * FROM inventory_receipts WHERE po_id = $1', [poId]);
};

/** 5. एक GR Document के सभी Items (Lines) को प्राप्त करता है। */
const getReceiptItemsByReceiptId = async (receiptId) => {
    const query = `
        SELECT 
            iri.*, mp.part_no, mp.part_name, ibl.bin_code 
        FROM 
            inventory_receipt_items iri
        JOIN 
            master_parts mp ON iri.part_id = mp.part_id
        JOIN 
            inventory_bin_locations ibl ON iri.receiving_bin_id = ibl.bin_id
        WHERE 
            iri.receipt_id = $1
        ORDER BY iri.item_id ASC
    `;
    return db.any(query, [receiptId]);
};


// =========================================================================
// B. QUALITY CONTROL & STOCK POSTING (10)
// =========================================================================

/** 6. एक विशिष्ट Receipt Item (Line) का QC Status अद्यतन करता है। (CRITICAL STEP 1) */
const updateItemQcStatus = async (itemId, qcStatus, qcNotes = null) => {
    const query = `
        UPDATE inventory_receipt_items 
        SET qc_status = $2, qc_notes = $3, updated_at = NOW()
        WHERE item_id = $1
        RETURNING *
    `;
    return db.oneOrNone(query, [itemId, qcStatus, qcNotes]);
};

/** 7. किसी GR Document में QC के लिए लंबित (Pending) वस्तुओं की संख्या प्राप्त करता है। */
const countPendingQcItems = async (receiptId) => {
    const query = `
        SELECT 
            COUNT(*) AS pending_count
        FROM 
            inventory_receipt_items
        WHERE 
            receipt_id = $1 AND qc_status = 'PENDING'
    `;
    return db.one(query, [receiptId], a => +a.pending_count);
};

/** 8. एक Receipt Item को Stock On Hand (SOH) में पोस्ट करता है। (CRITICAL STEP 2) */
const postReceiptItemToStock = async (itemId, transactionId, targetStockStatusId) => {
    const query = `
        UPDATE inventory_receipt_items iri
        SET is_posted = TRUE, stock_status_id = $3, updated_at = NOW()
        WHERE item_id = $1 AND is_posted = FALSE
        RETURNING 
            iri.part_id, iri.received_qty, iri.uom_id, iri.receiving_bin_id AS bin_id, 
            iri.lot_number, iri.expiry_date, $2 AS last_transaction_id;
    `;
    // Note: SOH Upsert के लिए आवश्यक डेटा को RETURNING क्लॉज़ में तैयार किया जाता है।
    return db.oneOrNone(query, [itemId, transactionId, targetStockStatusId]);
};

/** 9. एक विशिष्ट रिसीप्ट आइटम के लिए QC Status प्राप्त करता है। (Validation) */
const getItemQcStatus = async (itemId) => {
    return db.oneOrNone('SELECT qc_status, is_posted FROM inventory_receipt_items WHERE item_id = $1', [itemId]);
};

/** 10. एक GR को "POSTED" या "QC_FAILED" पर अद्यतन करता है। (Finalize GR Status) */
const updateReceiptStatus = async (receiptId, newStatus) => {
    const query = `
        UPDATE inventory_receipts 
        SET status = $2, updated_at = NOW()
        WHERE receipt_id = $1
        RETURNING *
    `;
    return db.oneOrNone(query, [receiptId, newStatus]);
};

/** 11. एक GR में QC पास की गई, लेकिन अभी तक पोस्ट नहीं की गई वस्तुओं को प्राप्त करता है। */
const getQcPassedButUnpostedItems = async (receiptId) => {
    const query = `
        SELECT 
            iri.*
        FROM 
            inventory_receipt_items iri
        WHERE 
            iri.receipt_id = $1 AND iri.qc_status = 'PASS' AND iri.is_posted = FALSE
    `;
    return db.any(query, [receiptId]);
};

/** 12. GRs की एक सूची प्राप्त करता है जो QC के लिए लंबित हैं। (QC Dashboard View) */
const getPendingQcReceipts = async (limit = 50) => {
    const query = `
        SELECT 
            ir.receipt_id, ir.receipt_date, ir.status, iw.warehouse_code, mu.full_name AS received_by
        FROM 
            inventory_receipts ir
        JOIN 
            inventory_warehouses iw ON ir.warehouse_id = iw.warehouse_id
        JOIN 
            master_users mu ON ir.received_by_user_id = mu.user_id
        WHERE 
            ir.status = 'PENDING_QC'
        ORDER BY ir.receipt_date ASC
        LIMIT $1
    `;
    return db.any(query, [limit]);
};

/** 13. एक GR से पोस्ट की गई कुल मात्रा (Total Posted Quantity) प्राप्त करता है। (Reporting) */
const getTotalPostedQtyByReceipt = async (receiptId) => {
    const query = `
        SELECT 
            COALESCE(SUM(received_qty), 0) AS total_posted
        FROM 
            inventory_receipt_items
        WHERE 
            receipt_id = $1 AND is_posted = TRUE
    `;
    return db.one(query, [receiptId]);
};

/** 14. एक विशिष्ट Lot Number से जुड़े सभी GR Items प्राप्त करता है। (Lot Traceability) */
const getReceiptItemsByLotNumber = async (lotNumber) => {
    const query = `
        SELECT 
            iri.receipt_id, ir.receipt_date, mp.part_no, iri.received_qty
        FROM 
            inventory_receipt_items iri
        JOIN 
            inventory_receipts ir ON iri.receipt_id = ir.receipt_id
        JOIN 
            master_parts mp ON iri.part_id = mp.part_id
        WHERE 
            iri.lot_number = $1
        ORDER BY ir.receipt_date DESC
    `;
    return db.any(query, [lotNumber]);
};

/** 15. एक विशिष्ट पार्ट के लिए सबसे हालिया QC पास Bin Location प्राप्त करता है। (Smart Putaway Suggestion) */
const getLatestQcPassBinForPart = async (partId) => {
    const query = `
        SELECT 
            ibl.bin_id, ibl.bin_code, ir.receipt_date
        FROM 
            inventory_receipt_items iri
        JOIN 
            inventory_receipts ir ON iri.receipt_id = ir.receipt_id
        JOIN
            inventory_bin_locations ibl ON iri.receiving_bin_id = ibl.bin_id
        WHERE 
            iri.part_id = $1 AND iri.qc_status = 'PASS'
        ORDER BY ir.receipt_date DESC
        LIMIT 1
    `;
    return db.oneOrNone(query, [partId]);
};


// =========================================================================
// FINAL EXPORTS (All 15 Functions)
// =========================================================================

module.exports = {
    // Receipt Document Management (1-5)
    createGoodsReceipt,
    getGoodsReceiptHeaderById,
    addReceiptItems,
    getReceiptByPoId,
    getReceiptItemsByReceiptId,

    // QC & Stock Posting (6-15)
    updateItemQcStatus,
    countPendingQcItems,
    postReceiptItemToStock,
    getItemQcStatus,
    updateReceiptStatus,
    getQcPassedButUnpostedItems,
    getPendingQcReceipts,
    getTotalPostedQtyByReceipt,
    getReceiptItemsByLotNumber,
    getLatestQcPassBinForPart,
};