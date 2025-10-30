/* * Module: Master Data - Part Definition */

-- 1. Parts Master Table
CREATE TABLE IF NOT EXISTS master_parts (
    part_id SERIAL PRIMARY KEY,
    part_no VARCHAR(50) UNIQUE NOT NULL,
    part_name VARCHAR(255) NOT NULL,
    description TEXT,
    
    base_uom_id INTEGER NOT NULL REFERENCES master_uoms(uom_id), -- Base unit of measure
    
    is_purchased BOOLEAN NOT NULL DEFAULT TRUE,
    is_manufactured BOOLEAN NOT NULL DEFAULT FALSE,
    is_sales_item BOOLEAN NOT NULL DEFAULT TRUE,
    
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE
);