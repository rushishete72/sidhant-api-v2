/* * Seed Data Module 09: Initial Setup for all Master/Base Tables */

-- --------------------------------------------------
-- I. ROLES & ADMIN USER SETUP
-- --------------------------------------------------

-- 1. Roles (JSONB permissions के साथ)
INSERT INTO master_roles (role_name, description, permissions) VALUES
('System_Admin', 'Full access, Architect-level privileges.', '{
    "manage:all": true, 
    "read:all": true,
    "authorize:purchasing": true,
    "post:goods_receipt_stock": true
}'::jsonb) ON CONFLICT (role_name) DO NOTHING;

INSERT INTO master_roles (role_name, description, permissions) VALUES
('Procurement_User', 'Create and Read Purchase Orders.', '{
    "read:purchasing": true, 
    "create:purchasing": true,
    "read:goods_receipt": true
}'::jsonb) ON CONFLICT (role_name) DO NOTHING;

INSERT INTO master_roles (role_name, description, permissions) VALUES
('Inventory_QC_User', 'Handle Goods Receipt, QC, and Stock movements.', '{
    "read:inventory": true, 
    "create:goods_receipt": true,
    "process:qc_receipt": true,
    "read:quality_control": true
}'::jsonb) ON CONFLICT (role_name) DO NOTHING;


-- 2. Initial Admin User
-- Note: 'employee_id' और 'phone_number' कॉलम नए स्कीमा से हटा दिए गए हैं।
INSERT INTO master_users (full_name, email, password_hash, role_id, is_active) VALUES
(
    'System Administrator', 
    'admin@sidhant.com', 
    -- 'password123' का सैंपल हैश
    '$2a$10$w1e7F/n/uTzM3I0J0bS1w.i/nJ0bS1w.i/nJ0bS1w.i', 
    (SELECT role_id FROM master_roles WHERE role_name = 'System_Admin'),
    TRUE
)
ON CONFLICT (email) DO NOTHING;


-- --------------------------------------------------
-- II. CORE MASTER DATA SEEDING
-- --------------------------------------------------

-- 3. Master UOMs (Units of Measure)
INSERT INTO master_uoms (uom_code, uom_name) VALUES
('KG', 'Kilogram'),
('PC', 'Piece'),
('M', 'Meter')
ON CONFLICT (uom_code) DO NOTHING;

-- 4. Master Clients
INSERT INTO master_clients (client_name) VALUES
('Alpha Mfg Co.'),
('Beta Components')
ON CONFLICT (client_name) DO NOTHING;

-- 5. Master Suppliers
INSERT INTO master_suppliers (supplier_name) VALUES
('Raw Material Inc.'),
('Finished Goods Supplier')
ON CONFLICT (supplier_name) DO NOTHING;

-- --------------------------------------------------
-- III. INVENTORY BASE DATA
-- --------------------------------------------------

-- 6. Warehouses
INSERT INTO inventory_warehouses (warehouse_code, warehouse_name) VALUES
('RM', 'Raw Material Store'),
('FG', 'Finished Goods Store'),
('QC', 'Quality Control Hold Area')
ON CONFLICT (warehouse_code) DO NOTHING;

-- 7. Bin Locations
INSERT INTO inventory_bin_locations (warehouse_id, bin_code) VALUES
((SELECT warehouse_id FROM inventory_warehouses WHERE warehouse_code = 'RM'), 'A-01-01'),
((SELECT warehouse_id FROM inventory_warehouses WHERE warehouse_code = 'RM'), 'A-01-02'),
((SELECT warehouse_id FROM inventory_warehouses WHERE warehouse_code = 'FG'), 'Z-00-01'),
((SELECT warehouse_id FROM inventory_warehouses WHERE warehouse_code = 'QC'), 'Q-BIN')
ON CONFLICT (warehouse_id, bin_code) DO NOTHING;

-- 8. Stock Statuses
INSERT INTO inventory_stock_statuses (status_code, status_name, is_usable) VALUES
('USABLE', 'Usable Stock', TRUE),
('QC_HOLD', 'Under Quality Check', FALSE),
('REJECT', 'Rejected/Scrap', FALSE)
ON CONFLICT (status_code) DO NOTHING;