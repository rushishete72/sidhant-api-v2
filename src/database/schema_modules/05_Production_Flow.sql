/* * Module: Production Flow (Optional, but included for completeness) */

-- 1. Production Work Orders Table
CREATE TABLE IF NOT EXISTS production_work_orders (
    wo_id SERIAL PRIMARY KEY,
    wo_number VARCHAR(20) UNIQUE NOT NULL,
    part_id INTEGER NOT NULL REFERENCES master_parts(part_id),
    quantity_to_produce NUMERIC(10, 3) NOT NULL,
    
    status VARCHAR(20) NOT NULL DEFAULT 'CREATED',
    
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);