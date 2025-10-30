/*
 * Context Note: यह 'master_stock_types' और 'master_stock_statuses' के लिए HTTP अनुरोधों को संभालता है।
 * यह model को business logic से जोड़ता है।
 * (पुराने /src/modules/inventory/masterData/inventoryMaster.controller.js से लिया गया)
 */

// निर्भरताएँ (Dependencies)
const inventoryMasterModel = require('./inventoryMaster.model'); // (इसे हम अगले चरण में बनाएँगे)
const { APIError } = require('../../../utils/errorHandler'); 
const { 
    validateStockTypeCreation, 
    validateStockStatusCreation, 
    validateStockStatusUpdate,
    tr, 
    isNumeric 
} = require('../../../utils/validation'); 

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
// A. Stock Types (master_stock_types)
// =========================================================================

/** 1. सभी Stock Types को प्राप्त करता है। */
const getAllStockTypes = async (req, res, next) => {
    try {
        const types = await inventoryMasterModel.getAllStockTypes();
        
        return res.status(200).json({ 
            message: 'All Stock Types retrieved successfully.', 
            data: types 
        });
    } catch (error) {
        return next(error); 
    }
};

/** 2. नया Stock Type बनाता है। */
const createStockType = async (req, res, next) => {
    const { type_code, type_name } = req.body;
    
    const typeData = { type_code: tr(type_code), type_name: tr(type_name) };

    // 1. वैलिडेशन
    const validationError = validateStockTypeCreation(typeData); 
    if (validationError) {
        return next(new APIError(validationError, 400));
    }

    try {
        const newType = await inventoryMasterModel.createStockType(typeData);

        return res.status(201).json({ 
            message: `Stock Type '${newType.type_code}' सफलतापूर्वक बन गया।`, 
            data: newType 
        });
    } catch (error) {
        if (error.code === '23505') { // Unique constraint violation (type_code/type_name)
            error.status = 409; 
            error.message = 'यह Stock Type Code या Name पहले से मौजूद है।';
        }
        return next(error); 
    }
};

/** 3. Stock Type को अपडेट करता है। */
const updateStockType = async (req, res, next) => {
    const { error, id: typeId } = handleIdValidation(req.params.typeId, 'Type ID');
    if (error) return next(new APIError(error, 400)); 

    const { type_code, type_name } = req.body;
    const updateData = {};
    if (type_code) updateData.type_code = tr(type_code);
    if (type_name) updateData.type_name = tr(type_name);

    // 1. वैलिडेशन: Creation वैलिडेशन का उपयोग करें, लेकिन केवल मौजूद फ़ील्ड्स के लिए
    const validationError = validateStockTypeCreation(updateData); 
    if (validationError) return next(new APIError(validationError, 400)); 
    if (Object.keys(updateData).length === 0) return next(new APIError('अपडेट करने के लिए कम से कम एक फ़ील्ड प्रदान करें।', 400));

    try {
        const updatedType = await inventoryMasterModel.updateStockType(typeId, updateData);

        if (!updatedType) return next(new APIError(`Stock Type ID ${typeId} नहीं मिला।`, 404)); 
        return res.status(200).json({ 
            message: `Stock Type '${updatedType.type_code}' सफलतापूर्वक अपडेट हुई।`, 
            data: updatedType 
        });
    } catch (error) {
        if (error.code === '23505') {
            error.status = 409; 
            error.message = 'अपडेट विफल: यह Stock Type Code या Name पहले से मौजूद है।';
        }
        return next(error); 
    }
};

// =========================================================================
// B. Stock Statuses (master_stock_statuses)
// =========================================================================

/** 4. सभी Stock Statuses को प्राप्त करता है। */
const getAllStockStatuses = async (req, res, next) => {
    try {
        const statuses = await inventoryMasterModel.getAllStockStatuses();
        
        return res.status(200).json({ 
            message: 'All Stock Statuses retrieved successfully.', 
            data: statuses 
        });
    } catch (error) {
        return next(error); 
    }
};

/** 5. नया Stock Status बनाता है। */
const createStockStatus = async (req, res, next) => {
    const { status_code, status_name, is_negative_allowed = false } = req.body;
    
    const statusData = { 
        status_code: tr(status_code), 
        status_name: tr(status_name), 
        is_negative_allowed 
    };

    // 1. वैलिडेशन
    const validationError = validateStockStatusCreation(statusData); 
    if (validationError) {
        return next(new APIError(validationError, 400));
    }

    try {
        const newStatus = await inventoryMasterModel.createStockStatus(statusData);

        return res.status(201).json({ 
            message: `Stock Status '${newStatus.status_code}' सफलतापूर्वक बन गया।`, 
            data: newStatus 
        });
    } catch (error) {
        if (error.code === '23505') { 
            error.status = 409; 
            error.message = 'यह Stock Status Code या Name पहले से मौजूद है।';
        }
        return next(error); 
    }
};

/** 6. Stock Status को अपडेट करता है। */
const updateStockStatus = async (req, res, next) => {
    const { error, id: statusId } = handleIdValidation(req.params.statusId, 'Status ID');
    if (error) return next(new APIError(error, 400)); 

    const updateData = req.body;
    
    // 1. वैलिडेशन
    const validationError = validateStockStatusUpdate(updateData); 
    if (validationError) return next(new APIError(validationError, 400)); 
    if (Object.keys(updateData).length === 0) return next(new APIError('अपडेट करने के लिए कम से कम एक फ़ील्ड प्रदान करें।', 400));

    try {
        const updatedStatus = await inventoryMasterModel.updateStockStatus(statusId, updateData);

        if (!updatedStatus) return next(new APIError(`Stock Status ID ${statusId} नहीं मिला।`, 404)); 
        return res.status(200).json({ 
            message: `Stock Status '${updatedStatus.status_code}' सफलतापूर्वक अपडेट हुई।`, 
            data: updatedStatus 
        });
    } catch (error) {
        if (error.code === '23505') {
            error.status = 409; 
            error.message = 'अपडेट विफल: यह Stock Status Code या Name पहले से मौजूद है।';
        }
        return next(error); 
    }
};


// =========================================================================
// FINAL EXPORTS
// =========================================================================

module.exports = {
    getAllStockTypes,
    createStockType,
    updateStockType,
    getAllStockStatuses,
    createStockStatus,
    updateStockStatus,
};