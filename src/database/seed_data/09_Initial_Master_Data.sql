/* * Seed Data Module 09: Initial Setup for all Master/Base Tables */

-- --------------------------------------------------
-- I. ROLES & PBAC PERMISSIONS SETUP (RELATIONAL MODEL)
-- --------------------------------------------------

-- 1. Permissions Lookup Table (PBAC Keys)
-- इन Keys का उपयोग 'authorize' middleware में किया जाता है।
INSERT INTO permissions (permission_key, description) VALUES
('manage:roles', 'Create, update, and assign permissions to roles.'),
('read:roles', 'View list of all roles and their permissions.'),
('manage:users', 'Create, update, and manage non-admin user accounts.'),
('read:users', 'View list of all user accounts.'),
('read:all', 'Global read access to all master data/inventory views.'),
('manage:all', 'Global manage access (highest privilege).'),
('create:purchasing', 'Create new Purchase Orders.'),
('read:purchasing', 'View Purchase Orders.'),
('authorize:purchasing', 'Final authorization/approval of Purchase Orders.'),
('create:goods_receipt', 'Record inbound material receipt.'),
('post:goods_receipt_stock', 'Approve and post goods to final inventory stock.'),
('process:qc_receipt', 'Perform Quality Check on goods receipt.'),
('read:quality_control', 'View all QC related data.')
ON CONFLICT (permission_key) DO NOTHING;


-- 2. Roles (Removed deprecated JSONB 'permissions' column)
INSERT INTO master_roles (role_name, description) VALUES
('System_Admin', 'Full access, Architect-level privileges.'),
('Procurement_User', 'Create and Read Purchase Orders.'),
('Inventory_QC_User', 'Handle Goods Receipt, QC, and Stock movements.')
ON CONFLICT (role_name) DO NOTHING;


-- 3. Role Permissions (Junction Table Seeding - Linking Roles to Keys)

-- System_Admin Permissions (Full Access & PBAC Management)
INSERT INTO role_permissions (role_id, permission_id)
SELECT 
    (SELECT role_id FROM master_roles WHERE role_name = 'System_Admin'),
    permission_id
FROM permissions WHERE permission_key IN (
    'manage:all', 'read:all', 'authorize:purchasing', 'post:goods_receipt_stock', 
    'manage:roles', 'read:roles', 'manage:users', 'read:users'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Procurement_User Permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT 
    (SELECT role_id FROM master_roles WHERE role_name = 'Procurement_User'),
    permission_id
FROM permissions WHERE permission_key IN (
    'read:purchasing', 'create:purchasing', 'read:goods_receipt'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Inventory_QC_User Permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT 
    (SELECT role_id FROM master_roles WHERE role_name = 'Inventory_QC_User'),
    permission_id
FROM permissions WHERE permission_key IN (
    'read:inventory', 'create:goods_receipt', 'process:qc_receipt', 'read:quality_control'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;


-- 4. Initial Admin User (Role ID अब relational table lookup से आता है)
-- Note: 'employee_id' और 'phone_number' कॉलम नए स्कीमा से हटा दिए गए हैं।
INSERT INTO master_users (full_name, email, password_hash, role_id, is_active,is_verified) VALUES
(
    'System Administrator', 
    'rushishete72@gmail.com', 
    -- 'password123' का सैंपल हैश
    '$2a$10$w1e7F/n/uTzM3I0J0bS1w.i/nJ0bS1w.i/nJ0bS1w.i', 
    (SELECT role_id FROM master_roles WHERE role_name = 'System_Admin'),
    TRUE,TRUE
)
ON CONFLICT (email) DO NOTHING;


-- --------------------------------------------------
-- II. CORE MASTER DATA SEEDING (Original Sections Preserved)
-- --------------------------------------------------

-- 5. Master UOMs (Units of Measure)
INSERT INTO master_uoms (uom_code, uom_name) VALUES
('KG', 'Kilogram'),
('PC', 'Piece'),
('M', 'Meter')
ON CONFLICT (uom_code) DO NOTHING;

-- 6. Master Clients
INSERT INTO master_clients (client_name) VALUES
('Alpha Mfg Co.'),
('Beta Components')
ON CONFLICT (client_name) DO NOTHING;

-- 7. Master Suppliers
INSERT INTO master_suppliers (supplier_name) VALUES
('Raw Material Inc.'),
('Finished Goods Supplier')
ON CONFLICT (supplier_name) DO NOTHING;

-- --------------------------------------------------
-- III. INVENTORY BASE DATA (Original Sections Preserved)
-- --------------------------------------------------

-- 8. Warehouses
INSERT INTO inventory_warehouses (warehouse_code, warehouse_name) VALUES
('RM', 'Raw Material Store'),
('FG', 'Finished Goods Store'),
('QC', 'Quality Control Hold Area')
ON CONFLICT (warehouse_code) DO NOTHING;

-- 9. Bin Locations
INSERT INTO inventory_bin_locations (warehouse_id, bin_code) VALUES
((SELECT warehouse_id FROM inventory_warehouses WHERE warehouse_code = 'RM'), 'A-01-01'),
((SELECT warehouse_id FROM inventory_warehouses WHERE warehouse_code = 'RM'), 'A-01-02'),
((SELECT warehouse_id FROM inventory_warehouses WHERE warehouse_code = 'FG'), 'Z-00-01'),
((SELECT warehouse_id FROM inventory_warehouses WHERE warehouse_code = 'QC'), 'Q-BIN')
ON CONFLICT (warehouse_id, bin_code) DO NOTHING;

-- 10. Stock Statuses
INSERT INTO inventory_stock_statuses (status_code, status_name, is_usable) VALUES
('USABLE', 'Usable Stock', TRUE),
('QC_HOLD', 'Under Quality Check', FALSE),
('REJECT', 'Rejected/Scrap', FALSE)
ON CONFLICT (status_code) DO NOTHING;