/* * Module: Security & Base Users (Master_Roles, Master_Users) */

-- 1. Roles Table (RBAC / PBAC Core)
CREATE TABLE IF NOT EXISTS master_roles (
    role_id SERIAL PRIMARY KEY,
    role_name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    permissions JSONB NOT NULL DEFAULT '{}', -- Permissions JSON structure
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE
);

-- 2. Users Table
CREATE TABLE IF NOT EXISTS master_users (
    user_id SERIAL PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    
    role_id INTEGER REFERENCES master_roles(role_id) ON DELETE SET NULL,
    
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_login TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE
);

-- 3. Session / Token Management (Optional but good practice)
CREATE TABLE IF NOT EXISTS user_sessions (
    session_id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES master_users(user_id) ON DELETE CASCADE,
    refresh_token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 4. User OTP Table (For password reset and verification)
CREATE TABLE IF NOT EXISTS user_otp (
    user_id INTEGER PRIMARY KEY REFERENCES master_users(user_id) ON DELETE CASCADE,
    otp_code VARCHAR(255) NOT NULL, -- Hashed OTP Code
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL, 
    attempts INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);