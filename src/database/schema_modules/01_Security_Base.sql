/* * Module: Security & Base Users (Master_Roles, Master_Users) 
 * FIX: Added missing 'permissions' and 'role_permissions' tables for PBAC.
 */

-- 1. Roles Table (RBAC / PBAC Core)
CREATE TABLE IF NOT EXISTS master_roles (
    role_id SERIAL PRIMARY KEY,
    role_name VARCHAR(50) UNIQUE NOT NULL,
    -- permissions JSONB NOT NULL DEFAULT '{}', -- OLD: JSON structure removed, now using relational model (permissions/role_permissions)
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE
);

-- 2. Permissions Lookup Table (NEW - CRITICAL FOR PBAC)
CREATE TABLE IF NOT EXISTS permissions (
    permission_id SERIAL PRIMARY KEY,
    permission_key VARCHAR(100) UNIQUE NOT NULL, -- e.g., 'manage:users', 'read:inventory_stock'
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. Role-Permissions Junction Table (NEW - CRITICAL FOR PBAC)
CREATE TABLE IF NOT EXISTS role_permissions (
    role_id INTEGER NOT NULL REFERENCES master_roles(role_id) ON DELETE CASCADE,
    permission_id INTEGER NOT NULL REFERENCES permissions(permission_id) ON DELETE CASCADE,
    
    PRIMARY KEY (role_id, permission_id) -- Composite Primary Key to ensure unique assignment
);


-- 4. Users Table
CREATE TABLE IF NOT EXISTS master_users (
    user_id SERIAL PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    
    role_id INTEGER REFERENCES master_roles(role_id) ON DELETE SET NULL,
    
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_verified BOOLEAN NOT NULL DEFAULT FALSE, -- ✅ FIX: यह कॉलम जोड़ा गया
    last_login TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE
);

-- 5. Session / Token Management (Optional but good practice)
CREATE TABLE IF NOT EXISTS user_sessions (
    session_id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES master_users(user_id) ON DELETE CASCADE,
    refresh_token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 6. User OTP Table (For password reset and verification)
CREATE TABLE IF NOT EXISTS user_otp (
    user_id INTEGER PRIMARY KEY REFERENCES master_users(user_id) ON DELETE CASCADE,
    otp_code VARCHAR(255) NOT NULL, -- ✅ FIX: Column name must be otp_code
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL, 
    attempts INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);