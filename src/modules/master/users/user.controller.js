/*
 * Context Note: यह 'master_users' (Admin User Management) के लिए HTTP अनुरोधों को संभालता है।
 * यह model को business logic से जोड़ता है।
 * (पुराने /src/modules/master/users/user.controller.js से लिया गया)
 */

// निर्भरताएँ (Dependencies)
const userModel = require('./user.model'); // (इसे हम अगले चरण में बनाएँगे)
const { APIError } = require('../../../utils/errorHandler'); 
const { tr } = require('../../../utils/validation'); 
const bcrypt = require('bcryptjs'); // पासवर्ड हैशिंग के लिए

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
// A. CORE CRUD & STATUS MANAGEMENT CONTROLLERS
// =========================================================================

/** 1. नया उपयोगकर्ता (User) बनाता है। (Admin Panel के लिए) */
const createUser = async (req, res, next) => {
    const { email, full_name, password, role_id } = req.body;
    const creatorId = req.user.user_id; // Admin जिसने बनाया

    if (!email || !full_name || !password || !role_id) {
        return next(new APIError('Email, Full Name, Password, and Role ID are required.', 400));
    }
    if (password.length < 6) {
        return next(new APIError('Password must be at least 6 characters long.', 400));
    }
    
    try {
        // 1. पासवर्ड को हैश करें
        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);

        const userData = {
            email: tr(email),
            full_name: tr(full_name),
            password_hash,
            role_id: Number(role_id),
            created_by: creatorId,
            is_active: true,
            is_verified: true, // Admin द्वारा बनाया गया, इसलिए सत्यापित (verified)
        };
        
        // 2. मॉडल को कॉल करें
        const newUser = await userModel.createUser(userData);

        return res.status(201).json({ 
            message: `उपयोगकर्ता '${newUser.email}' सफलतापूर्वक बन गया।`, 
            data: {
                user_id: newUser.user_id,
                email: newUser.email,
                role_name: newUser.role_name
            }
        });
    } catch (error) {
        if (error.code === '23505') { // Unique constraint violation (Email)
            error.status = 409; 
            error.message = 'यह ईमेल पहले से मौजूद है।';
        }
        if (error.code === '23503') { // Foreign key violation (Role ID)
            error.status = 400; 
            error.message = 'अमान्य भूमिका ID (Role ID) प्रदान की गई है।';
        }
        return next(error); 
    }
};

/** 2. ID द्वारा उपयोगकर्ता को प्राप्त करता है। */
const getUserById = async (req, res, next) => {
    const { error, id: userId } = handleIdValidation(req.params.userId, 'User ID');
    if (error) return next(new APIError(error, 400)); 

    try {
        const user = await userModel.getUserById(userId);
        
        if (!user) return next(new APIError(`उपयोगकर्ता ID ${userId} नहीं मिला।`, 404)); 
        
        // पासवर्ड हैश को छिपाएँ
        delete user.password_hash; 
        
        return res.status(200).json({ data: user });
    } catch (error) {
        return next(error); 
    }
};

/** 3. सभी उपयोगकर्ताओं को प्राप्त करता है (Paginated)। */
const getAllUsers = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 25;
        const search = tr(req.query.search);
        const isActive = req.query.isActive === 'false' ? false : (req.query.isActive === 'true' ? true : null);
        const offset = (page - 1) * limit;
        
        const { data: users, total_count } = await userModel.getAllUsers({
            limit, offset, search, isActive,
        });

        const totalPages = Math.ceil(total_count / limit);
        
        // प्रत्येक उपयोगकर्ता से पासवर्ड हैश हटाएँ
        users.forEach(user => delete user.password_hash);

        return res.status(200).json({ 
            message: 'Master Users retrieved successfully.', 
            pagination: {
                total_records: total_count, total_pages: totalPages,
                current_page: page, limit: limit,
            },
            data: users 
        });
    } catch (error) {
        return next(error); 
    }
};

/** 4. उपयोगकर्ता डेटा को अपडेट करता है। */
const updateUser = async (req, res, next) => {
    const { error, id: userId } = handleIdValidation(req.params.userId, 'User ID');
    if (error) return next(new APIError(error, 400)); 

    const updateData = req.body;
    delete updateData.password; // पासवर्ड को इस रूट से अपडेट न करें
    delete updateData.password_hash;
    delete updateData.role_id; // भूमिका को समर्पित (dedicated) रूट से अपडेट करें

    if (Object.keys(updateData).length === 0) {
        return next(new APIError('अपडेट करने के लिए कम से कम एक फ़ील्ड प्रदान करें।', 400));
    }

    try {
        const updatedUser = await userModel.updateUser(userId, updateData);

        if (!updatedUser) return next(new APIError(`उपयोगकर्ता ID ${userId} नहीं मिला।`, 404)); 
        
        delete updatedUser.password_hash;

        return res.status(200).json({ 
            message: `उपयोगकर्ता '${updatedUser.email}' सफलतापूर्वक अपडेट हुआ।`, 
            data: updatedUser 
        });
    } catch (error) {
        if (error.code === '23505') {
            error.status = 409; 
            error.message = 'अपडेट विफल: यह ईमेल पहले से मौजूद है।';
        }
        return next(error); 
    }
};

/** 5. उपयोगकर्ता की भूमिका (Role) बदलता है। */
const changeUserRole = async (req, res, next) => {
    const { error, id: userId } = handleIdValidation(req.params.userId, 'User ID');
    if (error) return next(new APIError(error, 400)); 

    const { role_id } = req.body;
    if (!role_id) return next(new APIError('Role ID is required to change user role.', 400));
    if (isNaN(Number(role_id)) || Number(role_id) <= 0) return next(new APIError('Invalid Role ID.', 400));
    
    try {
        const updatedUser = await userModel.updateUser(userId, { role_id: Number(role_id) });

        if (!updatedUser) return next(new APIError(`उपयोगकर्ता ID ${userId} नहीं मिला।`, 404)); 
        
        delete updatedUser.password_hash;
        
        return res.status(200).json({
            message: `उपयोगकर्ता '${updatedUser.email}' की भूमिका सफलतापूर्वक अपडेट हुई।`,
            data: updatedUser
        });

    } catch (error) {
        if (error.code === '23503') { // Foreign key violation (Role ID)
            error.status = 400; 
            error.message = 'अमान्य भूमिका ID (Role ID) प्रदान की गई है।';
        }
        return next(error);
    }
};

/** 6. उपयोगकर्ता का पासवर्ड रीसेट करता है। (Admin द्वारा) */
const resetUserPassword = async (req, res, next) => {
    const { error, id: userId } = handleIdValidation(req.params.userId, 'User ID');
    if (error) return next(new APIError(error, 400)); 

    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
        return next(new APIError('New password is required and must be at least 6 characters long.', 400));
    }
    
    try {
        // 1. पासवर्ड को हैश करें
        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(newPassword, salt);
        
        // 2. मॉडल को कॉल करें
        const updatedUser = await userModel.updateUser(userId, { password_hash });

        if (!updatedUser) return next(new APIError(`उपयोगकर्ता ID ${userId} नहीं मिला।`, 404)); 
        
        return res.status(200).json({
            message: `उपयोगकर्ता '${updatedUser.email}' का पासवर्ड सफलतापूर्वक रीसेट किया गया।`,
            data: { user_id: updatedUser.user_id, email: updatedUser.email }
        });

    } catch (error) {
        return next(error);
    }
};

/** 7. उपयोगकर्ता को निष्क्रिय (Deactivate) करता है। */
const deactivateUser = async (req, res, next) => {
    const { error, id: userId } = handleIdValidation(req.params.userId, 'User ID');
    if (error) return next(new APIError(error, 400)); 
    
    try {
        const deactivated = await userModel.deactivateUser(userId);
        
        if (!deactivated) {
            return next(new APIError(`उपयोगकर्ता ID ${userId} नहीं मिला या पहले से ही निष्क्रिय है।`, 400)); 
        }
        return res.status(200).json({
            message: `उपयोगकर्ता (ID: ${userId}) सफलतापूर्वक निष्क्रिय किया गया।`,
            data: { user_id: deactivated.user_id, email: deactivated.email, is_active: deactivated.is_active },
        });
    } catch (error) {
        return next(error);
    }
};

/** 8. उपयोगकर्ता को पुनः सक्रिय (Activate) करता है। */
const activateUser = async (req, res, next) => {
    const { error, id: userId } = handleIdValidation(req.params.userId, 'User ID');
    if (error) return next(new APIError(error, 400)); 
    
    try {
        const activated = await userModel.activateUser(userId);
        
        if (!activated) {
            return next(new APIError(`उपयोगकर्ता ID ${userId} नहीं मिला या पहले से ही सक्रिय है।`, 400)); 
        }
        return res.status(200).json({
            message: `उपयोगकर्ता (ID: ${userId}) सफलतापूर्वक सक्रिय किया गया।`,
            data: { user_id: activated.user_id, email: activated.email, is_active: activated.is_active },
        });
    } catch (error) {
        return next(error);
    }
};

// =========================================================================
// FINAL EXPORTS
// =========================================================================

module.exports = {
    createUser,
    getUserById,
    getAllUsers,
    updateUser,
    changeUserRole,
    resetUserPassword,
    deactivateUser,
    activateUser,
};