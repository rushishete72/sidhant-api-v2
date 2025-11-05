/* * Module: Security & Base Users (Master_Roles, Master_Users) 
 * FINAL FIX: Solved circular dependency (master_roles <-> master_users) using ALTER TABLE.
 * Full audit fields (created_by/updated_by) added to all core security tables.
 */

-- =================================================================================
-- PHASE 1: CREATE TABLES WITHOUT CROSS-REFERENCES (to break circular dependency)
-- =================================================================================

-- 1. Roles Table (Reference to master_users is temporarily removed)
CREATE TABLE IF NOT EXISTS master_roles (
    role_id SERIAL PRIMARY KEY,
    role_name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by_user_id INTEGER, -- Reference removed. Will be added in PHASE 2.
    updated_at TIMESTAMP WITH TIME ZONE,
    updated_by_user_id INTEGER  -- Reference removed. Will be added in PHASE 2.
);

-- 2. Permissions Lookup Table (Reference to master_users is temporarily removed)
CREATE TABLE IF NOT EXISTS permissions (
    permission_id SERIAL PRIMARY KEY,
    permission_key VARCHAR(100) UNIQUE NOT NULL, 
    description TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by_user_id INTEGER, -- Reference removed. Will be added in PHASE 2.
    updated_at TIMESTAMP WITH TIME ZONE,
    updated_by_user_id INTEGER   -- Reference removed. Will be added in PHASE 2.
);

-- 3. Role-Permissions Junction Table
CREATE TABLE IF NOT EXISTS role_permissions (
    role_id INTEGER NOT NULL REFERENCES master_roles(role_id) ON DELETE CASCADE,
    permission_id INTEGER NOT NULL REFERENCES permissions(permission_id) ON DELETE CASCADE,
    
    PRIMARY KEY (role_id, permission_id) 
);


-- 4. Users Table (Can reference master_roles because master_roles is created in step 1)
CREATE TABLE IF NOT EXISTS master_users (
    user_id SERIAL PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    
    role_id INTEGER REFERENCES master_roles(role_id) ON DELETE SET NULL,
    
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_verified BOOLEAN NOT NULL DEFAULT FALSE, 
    last_login TIMESTAMP WITH TIME ZONE,
    
    -- ✅ CRITICAL AUDIT FIELDS: Self-reference is fine for created_by/updated_by columns
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by_user_id INTEGER REFERENCES master_users(user_id), 
    updated_at TIMESTAMP WITH TIME ZONE,
    updated_by_user_id INTEGER REFERENCES master_users(user_id)
);

-- 5. Session / Token Management
CREATE TABLE IF NOT EXISTS user_sessions (
    session_id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES master_users(user_id) ON DELETE CASCADE,
    refresh_token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 6. User OTP Table 
CREATE TABLE IF NOT EXISTS user_otp (
    user_id INTEGER PRIMARY KEY REFERENCES master_users(user_id) ON DELETE CASCADE,
    otp_code VARCHAR(255) NOT NULL, 
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL, 
    attempts INTEGER NOT NULL DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by_user_id INTEGER REFERENCES master_users(user_id),
    updated_at TIMESTAMP WITH TIME ZONE,
    updated_by_user_id INTEGER REFERENCES master_users(user_id)
);


-- =================================================================================
-- PHASE 2: ADD DEFERRED FOREIGN KEY CONSTRAINTS (Resolves Circular Dependency)
-- =================================================================================

-- 7. Add FK to master_roles (now that master_users exists)
ALTER TABLE master_roles
ADD CONSTRAINT fk_master_roles_created_by
FOREIGN KEY (created_by_user_id) REFERENCES master_users(user_id);

ALTER TABLE master_roles
ADD CONSTRAINT fk_master_roles_updated_by
FOREIGN KEY (updated_by_user_id) REFERENCES master_users(user_id);


-- 8. Add FK to permissions (now that master_users exists)
ALTER TABLE permissions
ADD CONSTRAINT fk_permissions_created_by
FOREIGN KEY (created_by_user_id) REFERENCES master_users(user_id);

ALTER TABLE permissions
ADD CONSTRAINT fk_permissions_updated_by
FOREIGN KEY (updated_by_user_id) REFERENCES master_users(user_id);