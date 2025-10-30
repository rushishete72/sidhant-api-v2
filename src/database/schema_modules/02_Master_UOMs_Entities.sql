/* * Module: Master Data - UOMs, Suppliers, Clients */

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