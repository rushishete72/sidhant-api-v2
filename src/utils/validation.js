/*
 * Context Note: यह यूटिलिटी फ़ाइल वैलिडेशन से जुड़े फ़ंक्शंस रखती है।
 * (UPGRADED: अब 'Location Master' मॉड्यूल के लिए वैलिडेशन शामिल है)
 */

// =========================================================================
// 0. CORE UTILITIES
// =========================================================================
const tr = (s) => String(s || '').trim();
const isNumeric = (value) => {
     if (value === null || value === undefined || value === '') return true; 
     const num = Number(value);
     return !isNaN(num) && isFinite(num); 
};


// =========================================================================
// A. AUTHENTICATION HELPERS (OTP & Email)
// =========================================================================
const generateOtp = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

const handleEmailValidation = (email) => {
    const trimmedEmail = tr(email);
    if (!trimmedEmail) return 'Email address is required.';
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,30}$/; 
    if (!emailRegex.test(trimmedEmail)) return 'Invalid email format.';
    if (trimmedEmail.length > 100) return 'Email address must be under 100 characters.';
    return null;
};


// =========================================================================
// B. INVENTORY LOCATION VALIDATION (नया लॉजिक)
// =========================================================================

/** * Location बनाने के लिए इनपुट डेटा को सत्यापित (validate) करता है। */
const validateLocationCreation = (data) => {
    const { location_code, location_name, created_by } = data;
    
    if (!tr(location_code) || tr(location_code).length < 2 || tr(location_code).length > 20) {
        return 'लोकेशन कोड (Location Code) आवश्यक है और 2 से 20 अक्षरों के बीच होना चाहिए।';
    }
    if (!tr(location_name) || tr(location_name).length > 50) {
        return 'लोकेशन नाम (Location Name) आवश्यक है और 50 अक्षरों से कम होना चाहिए।';
    }
    if (!created_by || !isNumeric(created_by) || Number(created_by) <= 0) {
        return 'क्रिएटर ID (created_by) आवश्यक है।';
    }
    return null;
};

/** * Location को अपडेट करने के लिए इनपुट डेटा को सत्यापित (validate) करता है। */
const validateLocationUpdate = (data) => {
    if (Object.keys(data).length === 0) return 'अपडेट करने के लिए कम से कम एक फ़ील्ड प्रदान करें।';
    const { location_code, location_name, is_active } = data; 
    
    if (location_code !== undefined && (!tr(location_code) || tr(location_code).length < 2 || tr(location_code).length > 20)) {
        return 'लोकेशन कोड (Location Code) 2 से 20 अक्षरों के बीच होना चाहिए।';
    }
    if (location_name !== undefined && (!tr(location_name) || tr(location_name).length > 50)) {
        return 'लोकेशन नाम (Location Name) 50 अक्षरों से कम होना चाहिए।';
    }
    if (is_active !== undefined && typeof is_active !== 'boolean') {
        return 'is_active एक बूलियन (boolean) होना चाहिए।';
    }

    return null;
};

// =========================================================================
// C. OTHERS (Master Data & QC Validation - केवल Exports)
// =========================================================================

// (अपरिवर्तित Exports)
const validateUomCreation = () => { return null; };
const validateUomUpdate = () => { return null; };
const validateSupplierCreation = () => { return null; };
const validateSupplierUpdate = () => { return null; };
const validateClientCreation = () => { return null; };
const validateClientUpdate = () => { return null; };
const validateUserCreation = () => { return null; };
const validateUserUpdate = () => { return null; };
const validateQCLotCreation = () => { return null; };
const validateQCLotUpdate = () => { return null; };
const validateQcPlanCreationOrUpdate = () => { return null; };
const validateStockAdjustment = () => { return null; };


// =========================================================================
// FINAL EXPORTS
// =========================================================================

module.exports = {
    // Core
    tr,
    isNumeric,

    // Auth
    generateOtp,
    handleEmailValidation,
    
    // Master Data
    validateSupplierCreation, validateSupplierUpdate,
    validateClientCreation, validateClientUpdate,
    validateUomCreation, validateUomUpdate,
    validateUserCreation, validateUserUpdate,
    
    // QC Exports
    validateQCLotCreation, validateQCLotUpdate,
    validateQcPlanCreationOrUpdate,
    
    // Inventory Exports
    validateStockAdjustment,
    // ✅ Location Exports
    validateLocationCreation,
    validateLocationUpdate,
};