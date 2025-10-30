/* * Module: Quality Control & Inventory Management Base */

-- 1. Inventory Warehouse Table
CREATE TABLE IF NOT EXISTS inventory_warehouses (
    warehouse_id SERIAL PRIMARY KEY,
    warehouse_code VARCHAR(10) UNIQUE NOT NULL,
    warehouse_name VARCHAR(100) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. Inventory Bin/Location Table
CREATE TABLE IF NOT EXISTS inventory_bin_locations (
    bin_id SERIAL PRIMARY KEY,
    warehouse_id INTEGER NOT NULL REFERENCES inventory_warehouses(warehouse_id),
    bin_code VARCHAR(20) NOT NULL, -- जैसे: A-01-01
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    
    UNIQUE (warehouse_id, bin_code),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. Stock Statuses Table (e.g., USABLE, QC_HOLD, DAMAGED)
CREATE TABLE IF NOT EXISTS inventory_stock_statuses (
    stock_status_id SERIAL PRIMARY KEY,
    status_code VARCHAR(20) UNIQUE NOT NULL,
    status_name VARCHAR(50) NOT NULL,
    is_usable BOOLEAN NOT NULL DEFAULT TRUE, -- क्या इसे Production/Sales के लिए इस्तेमाल किया जा सकता है
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 4. Stock On Hand (SOH) Table - Lot / Bin / Part Level
CREATE TABLE IF NOT EXISTS inventory_stock_on_hand (
    stock_id BIGSERIAL PRIMARY KEY,
    part_id INTEGER NOT NULL REFERENCES master_parts(part_id),
    bin_id INTEGER NOT NULL REFERENCES inventory_bin_locations(bin_id),
    stock_status_id INTEGER NOT NULL REFERENCES inventory_stock_statuses(stock_status_id),
    
    lot_number VARCHAR(50) NOT NULL, -- Lot traceability
    expiry_date DATE,
    
    quantity NUMERIC(15, 3) NOT NULL DEFAULT 0.000,
    
    -- Transaction History Link
    last_transaction_id INTEGER, 
    
    -- Constraint: Ensures only one unique record per Part/Bin/Status/Lot combination
    UNIQUE (part_id, bin_id, stock_status_id, lot_number),
    
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 5. Inventory Transaction History Table
CREATE TABLE IF NOT EXISTS inventory_transaction_history (
    transaction_id BIGSERIAL PRIMARY KEY,
    transaction_type VARCHAR(20) NOT NULL, -- जैसे: GR_IN, MI_OUT, QC_MOVE, CC_ADJ
    
    user_id INTEGER REFERENCES master_users(user_id),
    
    source_document_type VARCHAR(50), -- जैसे: PO, WO, SO
    source_document_id INTEGER, -- Document ID
    
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 6. Quality Control Lot Tracking Table
CREATE TABLE IF NOT EXISTS qc_lots (
    qc_lot_id SERIAL PRIMARY KEY,
    lot_number VARCHAR(50) UNIQUE NOT NULL,
    part_id INTEGER NOT NULL REFERENCES master_parts(part_id),
    
    source_document_type VARCHAR(50), -- GR, WO, etc.
    source_document_id INTEGER, 
    
    qc_status VARCHAR(10) NOT NULL DEFAULT 'PENDING',
    
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 7. QC Inspection Plan (Master Data)
CREATE TABLE IF NOT EXISTS qc_inspection_plans (
    plan_id SERIAL PRIMARY KEY,
    plan_name VARCHAR(100) NOT NULL,
    part_id INTEGER UNIQUE REFERENCES master_parts(part_id), -- Part-specific plan
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 8. QC Plan Items (Parameters)
CREATE TABLE IF NOT EXISTS qc_plan_items (
    item_id SERIAL PRIMARY KEY,
    plan_id INTEGER NOT NULL REFERENCES qc_inspection_plans(plan_id) ON DELETE CASCADE,
    
    parameter_name VARCHAR(100) NOT NULL,
    min_value NUMERIC(10, 3),
    max_value NUMERIC(10, 3),
    uom_id INTEGER REFERENCES master_uoms(uom_id),
    
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 9. QC Inspection Results (Lot / Plan Link)
CREATE TABLE IF NOT EXISTS qc_inspection_results (
    result_id BIGSERIAL PRIMARY KEY,
    qc_lot_id INTEGER NOT NULL REFERENCES qc_lots(qc_lot_id) ON DELETE CASCADE,
    plan_id INTEGER NOT NULL REFERENCES qc_inspection_plans(plan_id),
    
    inspector_id INTEGER REFERENCES master_users(user_id),
    inspection_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    overall_status VARCHAR(10) NOT NULL, -- PASS/FAIL
    notes TEXT,
    
    UNIQUE (qc_lot_id, plan_id)
);

-- 10. QC Result Details (Parameter Level)
CREATE TABLE IF NOT EXISTS qc_result_details (
    detail_id BIGSERIAL PRIMARY KEY,
    result_id BIGINT NOT NULL REFERENCES qc_inspection_results(result_id) ON DELETE CASCADE,
    plan_item_id INTEGER NOT NULL REFERENCES qc_plan_items(item_id),
    
    measured_value NUMERIC(10, 3),
    is_compliant BOOLEAN NOT NULL,
    
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE (result_id, plan_item_id)
);