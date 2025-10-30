/* * Module: Inventory - Receipts (Goods Receipt) 
 * Tables: inventory_receipts, inventory_receipt_items 
 */

-- 1. Goods Receipt Header Table
CREATE TABLE IF NOT EXISTS inventory_receipts (
    receipt_id SERIAL PRIMARY KEY,
    
    po_id INTEGER REFERENCES procurement_purchase_orders(po_id), -- किस PO से प्राप्त हुआ (वैकल्पिक)
    warehouse_id INTEGER NOT NULL REFERENCES inventory_warehouses(warehouse_id),
    
    receipt_date DATE NOT NULL DEFAULT CURRENT_DATE,
    
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING_QC'
        CHECK (status IN ('PENDING_QC', 'QC_FAILED', 'POSTED', 'CANCELLED')),
        
    -- Audit Fields
    received_by_user_id INTEGER NOT NULL REFERENCES master_users(user_id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE
);

-- 2. Goods Receipt Line Items (Lot Tracking Level)
CREATE TABLE IF NOT EXISTS inventory_receipt_items (
    item_id SERIAL PRIMARY KEY,
    receipt_id INTEGER NOT NULL REFERENCES inventory_receipts(receipt_id) ON DELETE CASCADE,
    
    part_id INTEGER NOT NULL REFERENCES master_parts(part_id),
    uom_id INTEGER NOT NULL REFERENCES master_uoms(uom_id),
    
    received_qty NUMERIC(10, 3) NOT NULL,
    
    receiving_bin_id INTEGER NOT NULL REFERENCES inventory_bin_locations(bin_id), -- वह बिन जहाँ इसे प्राप्त किया गया
    
    lot_number VARCHAR(50), -- प्रत्येक आइटम को एक लॉट नंबर निर्दिष्ट करना
    expiry_date DATE, -- वैकल्पिक
    
    qc_status VARCHAR(10) NOT NULL DEFAULT 'PENDING'
        CHECK (qc_status IN ('PENDING', 'PASS', 'FAIL')),
        
    qc_notes TEXT,
    
    -- Stock Posting Status
    is_posted BOOLEAN NOT NULL DEFAULT FALSE, -- क्या यह SOH में चला गया है
    stock_status_id INTEGER REFERENCES inventory_stock_statuses(stock_status_id), -- परिणामी स्टॉक स्थिति (e.g., USABLE)
    
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE
);

-- Indexing for fast traceability and lookup
CREATE INDEX IF NOT EXISTS idx_receipts_po_id ON inventory_receipts (po_id);
CREATE INDEX IF NOT EXISTS idx_receipt_items_receipt_id ON inventory_receipt_items (receipt_id);
CREATE INDEX IF NOT EXISTS idx_receipt_items_lot ON inventory_receipt_items (lot_number);