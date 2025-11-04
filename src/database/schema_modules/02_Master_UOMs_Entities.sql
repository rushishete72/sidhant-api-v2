/* * Module: Master Data - UOMs, Suppliers, Clients (FINAL FIX: Added Inventory Master Tables) */

-- 1. Units of Measure (UOMs) Table
CREATE TABLE IF NOT EXISTS master_uoms (
    uom_id SERIAL PRIMARY KEY,
    uom_code VARCHAR(10) UNIQUE NOT NULL,
    uom_name VARCHAR(50) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. Suppliers Table
CREATE TABLE IF NOT EXISTS master_suppliers (
    supplier_id SERIAL PRIMARY KEY,
    supplier_name VARCHAR(150) UNIQUE NOT NULL,
    contact_person VARCHAR(100),
    email VARCHAR(100),
    phone VARCHAR(20),
    address_json JSONB,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. Clients Table
CREATE TABLE IF NOT EXISTS master_clients (
    client_id SERIAL PRIMARY KEY,
    client_name VARCHAR(150) UNIQUE NOT NULL,
    contact_person VARCHAR(100),
    email VARCHAR(100),
    phone VARCHAR(20),
    address_json JSONB,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================================
-- ✅ CRITICAL FIX: Inventory Master Tables added here
-- ये टेबल्स 08_Inventory_Receipts.sql और 09_Initial_Master_Data.sql के लिए आवश्यक हैं।
-- ==========================================================

-- 4. Inventory Stock Statuses Table
-- 08_Inventory_Receipts.sql में inventory_receipt_items द्वारा संदर्भित।
CREATE TABLE IF NOT EXISTS inventory_stock_statuses (
    stock_status_id SERIAL PRIMARY KEY, 
    status_code VARCHAR(20) UNIQUE NOT NULL,
    status_name VARCHAR(100) NOT NULL,
    is_usable BOOLEAN NOT NULL DEFAULT TRUE, 
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 5. Inventory Warehouses Table
-- 08_Inventory_Receipts.sql में inventory_receipts द्वारा संदर्भित।
CREATE TABLE IF NOT EXISTS inventory_warehouses (
    warehouse_id SERIAL PRIMARY KEY,
    warehouse_code VARCHAR(10) UNIQUE NOT NULL,
    warehouse_name VARCHAR(50) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE
);