/*
 * Context Note: यह 'master_uoms' (Unit of Measurement) के लिए HTTP अनुरोधों को संभालता है।
 * यह model को business logic से जोड़ता है।
 * (पुराने /src/modules/masterData/uom/uom.controller.js से लिया गया)
 */

// निर्भरताएँ (Dependencies)
const uomModel = require('./uom.model'); // (इसे हम अगले चरण में बनाएँगे)
const { APIError } = require('../../../utils/errorHandler'); 
// validateUomCreation, validateUomUpdate, tr को validation.js से इम्पोर्ट करें
const { validateUomCreation, validateUomUpdate, tr } = require('../../../utils/validation'); 

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

/** 1. नया UOM बनाता है। */
const createUom = async (req, res, next) => {
    // 1. उपयोगकर्ता को JWT (req.user) से प्राप्त करें
    const creatorId = req.user.user_id; 
    
    const uomData = { 
        ...req.body,
        created_by: creatorId // created_by को auth टोकन से जोड़ें
    };

    // 2. वैलिडेशन
    const validationError = validateUomCreation(uomData); 
    if (validationError) {
        return next(new APIError(validationError, 400));
    }

    // 3. मॉडल को कॉल करें
    try {
        const newUom = await uomModel.createUom(uomData);

        return res.status(201).json({ 
            message: `UOM '${newUom.uom_code}' सफलतापूर्वक बन गया।`, 
            data: newUom 
        });
    } catch (error) {
        if (error.code === '23505') { // Unique constraint violation (uom_code)
            error.status = 409; 
            error.message = 'UOM कोड (Code) या नाम (Name) पहले से मौजूद है।';
        }
        return next(error); 
    }
};

/** 2. ID द्वारा UOM को प्राप्त करता है। */
const getUomById = async (req, res, next) => {
    const { error, id: uomId } = handleIdValidation(req.params.uomId, 'UOM ID');
    if (error) return next(new APIError(error, 400)); 

    try {
        const uom = await uomModel.getUomById(uomId);
        
        if (!uom) return next(new APIError(`UOM ID ${uomId} नहीं मिला।`, 404)); 
        return res.status(200).json({ data: uom });
    } catch (error) {
        return next(error); 
    }
};

/** 3. सभी UOMs को प्राप्त करता है (Paginated)। */
const getAllUoms = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 25;
        const search = tr(req.query.search);
        const isActive = req.query.isActive === 'false' ? false : (req.query.isActive === 'true' ? true : null);
        const offset = (page - 1) * limit;
        
        const { data: uoms, total_count } = await uomModel.getAllUoms({
            limit, offset, search, isActive,
        });

        const totalPages = Math.ceil(total_count / limit);

        return res.status(200).json({ 
            message: 'Master UOMs retrieved successfully.', 
            pagination: {
                total_records: total_count, total_pages: totalPages,
                current_page: page, limit: limit,
            },
            data: uoms 
        });
    } catch (error) {
        return next(error); 
    }
};

/** 4. UOM डेटा को अपडेट करता है। */
const updateUom = async (req, res, next) => {
    const { error, id: uomId } = handleIdValidation(req.params.uomId, 'UOM ID');
    if (error) return next(new APIError(error, 400)); 

    const updateData = req.body;
    
    const validationError = validateUomUpdate(updateData); 
    if (validationError) return next(new APIError(validationError, 400)); 

    try {
        const updatedUom = await uomModel.updateUom(uomId, updateData);

        if (!updatedUom) return next(new APIError(`UOM ID ${uomId} नहीं मिला।`, 404)); 
        return res.status(200).json({ 
            message: `UOM '${updatedUom.uom_code}' सफलतापूर्वक अपडेट हुआ।`, 
            data: updatedUom 
        });
    } catch (error) {
        if (error.code === '23505') {
            error.status = 409; 
            error.message = 'अपडेट विफल: UOM कोड (Code) या नाम (Name) पहले से मौजूद है।';
        }
        return next(error); 
    }
};

/** 5. UOM को निष्क्रिय (Deactivate) करता है। */
const deactivateUom = async (req, res, next) => {
    const { error, id: uomId } = handleIdValidation(req.params.uomId, 'UOM ID');
    if (error) return next(new APIError(error, 400)); 
    
    try {
        const deactivated = await uomModel.deactivateUom(uomId);
        
        if (!deactivated) {
            return next(new APIError(`UOM ID ${uomId} नहीं मिला या पहले से ही निष्क्रिय है।`, 400)); 
        }
        return res.status(200).json({
            message: `UOM (ID: ${uomId}) सफलतापूर्वक निष्क्रिय किया गया।`,
            data: deactivated,
        });
    } catch (error) {
        return next(error);
    }
};

/** 6. UOM को पुनः सक्रिय (Activate) करता है। */
const activateUom = async (req, res, next) => {
    const { error, id: uomId } = handleIdValidation(req.params.uomId, 'UOM ID');
    if (error) return next(new APIError(error, 400)); 
    
    try {
        const activated = await uomModel.activateUom(uomId);
        
        if (!activated) {
            return next(new APIError(`UOM ID ${uomId} नहीं मिला या पहले से ही सक्रिय है।`, 400)); 
        }
        return res.status(200).json({
            message: `UOM (ID: ${uomId}) सफलतापूर्वक सक्रिय किया गया।`,
            data: activated,
        });
    } catch (error) {
        return next(error);
    }
};

// =========================================================================
// FINAL EXPORTS
// =========================================================================

module.exports = {
    createUom,
    getUomById,
    getAllUoms,
    updateUom,
    deactivateUom,
    activateUom,
};