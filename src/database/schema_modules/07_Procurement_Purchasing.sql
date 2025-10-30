/* * Module: Procurement - Purchasing (Purchase Order) 
 * Tables: procurement_purchase_orders, procurement_po_items 
 */

-- PO Number Sequence: PO-YYYY-XXXXXX जनरेशन के लिए
CREATE SEQUENCE IF NOT EXISTS po_number_seq START 1;

-- 1. PO Header Table
CREATE TABLE IF NOT EXISTS procurement_purchase_orders (
    po_id SERIAL PRIMARY KEY,
    po_number VARCHAR(20) UNIQUE NOT NULL, -- जैसे: PO-2025-000001
    
    supplier_id INTEGER NOT NULL REFERENCES master_suppliers(supplier_id),
    delivery_location_id INTEGER REFERENCES inventory_bin_locations(bin_id), -- PO के लिए डिफ़ॉल्ट डिलीवरी लोकेशन
    
    payment_terms VARCHAR(50),
    
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' 
        CHECK (status IN ('PENDING', 'AUTHORIZED', 'RECEIVED', 'CANCELLED', 'CLOSED')),
    
    total_amount NUMERIC(15, 4) NOT NULL DEFAULT 0.00, -- अनुमानित कुल लागत
    
    -- Audit Fields
    created_by INTEGER NOT NULL REFERENCES master_users(user_id),
    authorized_by INTEGER REFERENCES master_users(user_id),
    cancelled_by INTEGER REFERENCES master_users(user_id),
    
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    authorized_at TIMESTAMP WITH TIME ZONE,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE
);

-- 2. PO Line Items Table
CREATE TABLE IF NOT EXISTS procurement_po_items (
    po_item_id SERIAL PRIMARY KEY,
    po_id INTEGER NOT NULL REFERENCES procurement_purchase_orders(po_id) ON DELETE CASCADE,
    
    part_id INTEGER NOT NULL REFERENCES master_parts(part_id),
    uom_id INTEGER NOT NULL REFERENCES master_uoms(uom_id),
    
    quantity NUMERIC(10, 3) NOT NULL, -- Ordered Quantity
    unit_price NUMERIC(10, 4) NOT NULL DEFAULT 0.00,
    
    required_date DATE,
    
    -- Tracking Fields
    received_qty NUMERIC(10, 3) NOT NULL DEFAULT 0.00, -- GR द्वारा अपडेट किया गया
    cancelled_qty NUMERIC(10, 3) NOT NULL DEFAULT 0.00,
    
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE,
    
    UNIQUE (po_id, part_id) -- एक PO में एक पार्ट एक ही बार होना चाहिए
);

-- Index for fast lookup by PO Number
CREATE INDEX IF NOT EXISTS idx_po_number ON procurement_purchase_orders (po_number);
CREATE INDEX IF NOT EXISTS idx_po_items_po_id ON procurement_po_items (po_id);