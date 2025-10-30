/* * Seed Data Module 10: Test Parts and Procurement Transaction Data (FIXED) 
 * यह SELECT...INTO को हटाकर सबक्वेरी का उपयोग करता है।
 */

-- 1. Master Parts (R-2002)
INSERT INTO master_parts (part_no, part_name, base_uom_id, is_purchased) 
SELECT 
    'R-2002', 'Steel Raw Bar 10mm', 
    (SELECT uom_id FROM master_uoms WHERE uom_code = 'KG'), -- Subquery for KG UOM ID
    TRUE
ON CONFLICT (part_no) DO NOTHING;

-- 2. Sample Purchase Order (PO-2025-000001)
-- Insert PO Header. Status: 'AUTHORIZED'.
INSERT INTO procurement_purchase_orders (
    po_number, supplier_id, delivery_location_id, payment_terms, status, created_by, authorized_by, authorized_at
) 
SELECT 
    'PO-2025-000001', 
    (SELECT supplier_id FROM master_suppliers WHERE supplier_name = 'Raw Material Inc.'), 
    (SELECT bin_id FROM inventory_bin_locations WHERE bin_code = 'A-01-01'), -- Receiving Bin ID
    'NET_30', 
    'AUTHORIZED', 
    (SELECT user_id FROM master_users WHERE email = 'admin@sidhant.com'), 
    (SELECT user_id FROM master_users WHERE email = 'admin@sidhant.com'), 
    CURRENT_TIMESTAMP
ON CONFLICT (po_number) DO NOTHING;

-- 3. PO Line Items
-- PO ID को PO Number का उपयोग करके सबक्वेरी के माध्यम से प्राप्त किया जाता है।
INSERT INTO procurement_po_items (
    po_id, part_id, uom_id, quantity, unit_price
) 
SELECT 
    (SELECT po_id FROM procurement_purchase_orders WHERE po_number = 'PO-2025-000001'), -- PO ID Lookup
    (SELECT part_id FROM master_parts WHERE part_no = 'R-2002'),                   -- Part ID Lookup
    (SELECT uom_id FROM master_uoms WHERE uom_code = 'KG'),                        -- UOM ID Lookup
    500.000, 
    55.50
ON CONFLICT (po_id, part_id) DO NOTHING;