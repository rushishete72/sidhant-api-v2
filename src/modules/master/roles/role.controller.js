/*
 * Context Note: यह 'roles' और 'permissions' के लिए HTTP अनुरोधों को संभालता है।
 * यह मॉडल को business logic से जोड़ता है।
 */

// निर्भरताएँ (Dependencies)
const roleModel = require('./role.model'); // (इसे हम अगले चरण में बनाएँगे)
const { APIError } = require('../../../utils/errorHandler'); 
const { tr } = require('../../../utils/validation'); 

// --- Core Helper Functions ---

/** URL से प्राप्त ID को मान्य (Validate) करता है। */
const handleIdValidation = (id, paramName = 'ID') => {
    const parsedId = parseInt(id, 10);
    if (isNaN(parsedId) || parsedId <= 0) {
        return { error: `अमान्य (Invalid) ${paramName} URL में प्रदान किया गया है।` };
    }
    return { id: parsedId };
};

// =========================================================================
// A. ROLES CRUD CONTROLLERS
// =========================================================================

/** 1. सभी भूमिकाओं (Roles) और उनकी अनुमतियों (Permissions) को प्राप्त करता है। */
const getAllRoles = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 25;
        const offset = (page - 1) * limit;

        const { data: roles, total_count } = await roleModel.getAllRoles({ limit, offset });
        
        const totalPages = Math.ceil(total_count / limit);

        return res.status(200).json({ 
            message: 'All Roles retrieved successfully.', 
            pagination: {
                total_records: total_count, total_pages: totalPages,
                current_page: page, limit: limit,
            },
            data: roles 
        });
    } catch (error) {
        return next(error); 
    }
};

/** 2. एक नई भूमिका (Role) बनाता है। */
const createRole = async (req, res, next) => {
    const { role_name } = req.body;

    if (!role_name || tr(role_name).length < 3) {
        return next(new APIError('Role Name is required and must be at least 3 characters long.', 400));
    }
    
    try {
        const newRole = await roleModel.createRole({ role_name: tr(role_name) });

        return res.status(201).json({ 
            message: `भूमिका '${newRole.role_name}' सफलतापूर्वक बन गई।`, 
            data: newRole 
        });
    } catch (error) {
        if (error.code === '23505') { // Unique constraint violation (role_name)
            error.status = 409; 
            error.message = 'यह भूमिका नाम (Role Name) पहले से मौजूद है।';
        }
        return next(error); 
    }
};

/** 3. ID द्वारा भूमिका को प्राप्त करता है। */
const getRoleById = async (req, res, next) => {
    const { error, id: roleId } = handleIdValidation(req.params.roleId, 'Role ID');
    if (error) return next(new APIError(error, 400)); 

    try {
        const role = await roleModel.getRoleById(roleId);
        
        if (!role) return next(new APIError(`भूमिका ID ${roleId} नहीं मिली।`, 404)); 
        return res.status(200).json({ data: role });
    } catch (error) {
        return next(error); 
    }
};

/** 4. भूमिका का नाम/विवरण (Name/Description) अपडेट करता है। */
const updateRole = async (req, res, next) => {
    const { error, id: roleId } = handleIdValidation(req.params.roleId, 'Role ID');
    if (error) return next(new APIError(error, 400)); 

    const { role_name } = req.body;

    if (!role_name || tr(role_name).length < 3) {
        return next(new APIError('Role Name is required and must be at least 3 characters long for update.', 400));
    }
    
    try {
        const updatedRole = await roleModel.updateRole(roleId, { role_name: tr(role_name) });

        if (!updatedRole) return next(new APIError(`भूमिका ID ${roleId} नहीं मिली।`, 404)); 
        
        return res.status(200).json({ 
            message: `भूमिका '${updatedRole.role_name}' सफलतापूर्वक अपडेट हुई।`, 
            data: updatedRole 
        });
    } catch (error) {
        if (error.code === '23505') {
            error.status = 409; 
            error.message = 'अपडेट विफल: यह भूमिका नाम (Role Name) पहले से मौजूद है।';
        }
        return next(error); 
    }
};

// =========================================================================
// B. PERMISSIONS CONTROLLERS
// =========================================================================

/** 5. सभी उपलब्ध अनुमतियों (Permissions) को प्राप्त करता है। */
const getAllPermissions = async (req, res, next) => {
    try {
        const permissions = await roleModel.getAllPermissions();
        
        return res.status(200).json({ 
            message: 'All available permissions retrieved successfully.', 
            data: permissions 
        });
    } catch (error) {
        return next(error); 
    }
};


/** 6. भूमिका के लिए अनुमतियों को असाइन/रद्द (Assign/Revoke) करता है। */
const updateRolePermissions = async (req, res, next) => {
    const { error, id: roleId } = handleIdValidation(req.params.roleId, 'Role ID');
    if (error) return next(new APIError(error, 400)); 

    const { permission_keys } = req.body;

    // सुनिश्चित करें कि permission_keys एक गैर-शून्य ऐरे (non-null array) है
    if (!Array.isArray(permission_keys)) {
        return next(new APIError('permission_keys must be an array of strings.', 400));
    }

    try {
        // मॉडल को कॉल करें जो पुराने अनुमतियों को हटा देगा और नए को जोड़ देगा (ट्रांजैक्शन में)
        const updatedRole = await roleModel.updateRolePermissions(roleId, permission_keys);
        
        if (!updatedRole) {
            return next(new APIError(`भूमिका ID ${roleId} नहीं मिली।`, 404)); 
        }

        return res.status(200).json({
            message: `भूमिका '${updatedRole.role_name}' के लिए अनुमतियाँ सफलतापूर्वक अपडेट हुईं।`,
            data: updatedRole,
        });

    } catch (error) {
        if (error.code === '23503') { // Foreign Key Violation (यदि कोई अमान्य परमिशन कुंजी (key) प्रदान की गई है)
            error.status = 400; 
            error.message = 'अमान्य अनुमति कुंजी (Permission Key) प्रदान की गई है।';
        }
        return next(error);
    }
};

// =========================================================================
// FINAL EXPORTS
// =========================================================================

module.exports = {
    getAllRoles,
    createRole,
    getRoleById,
    updateRole,
    getAllPermissions,
    updateRolePermissions,
};