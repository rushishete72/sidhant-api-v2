/*
 * Context Note: यह 'master_parts' के लिए HTTP अनुरोधों को संभालता है।
 * यह model को business logic से जोड़ता है।
 * (पुराने /src/modules/master/parts/part.controller.js से लिया गया)
 */

// निर्भरताएँ (Dependencies)
const partModel = require('./part.model'); // (इसे हम अगले चरण में बनाएँगे)
const { APIError } = require('../../../utils/errorHandler'); 
const { validatePartCreation, validatePartUpdate, tr } = require('../../../utils/validation'); 
const { isNumeric } = require('../../../utils/validation'); // isNumeric helper

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

/** 1. नया पार्ट बनाता है। */
const createPart = async (req, res, next) => {
    const creatorId = req.user.user_id; 
    
    const partData = { 
        ...req.body,
        created_by: creatorId // created_by को auth टोकन से जोड़ें
    };

    // 2. वैलिडेशन
    const validationError = validatePartCreation(partData); 
    if (validationError) {
        return next(new APIError(validationError, 400));
    }
    
    // 3. मॉडल को कॉल करें
    try {
        const newPart = await partModel.createPart(partData);

        return res.status(201).json({ 
            message: `पार्ट '${newPart.part_no}' सफलतापूर्वक बन गया।`, 
            data: newPart 
        });
    } catch (error) {
        if (error.code === '23505') { // Unique constraint violation (part_no, rev_no)
            error.status = 409; 
            error.message = 'पार्ट नंबर (Part No) और रिविज़न नंबर (Rev No) का संयोजन पहले से मौजूद है।';
        }
        return next(error); 
    }
};

/** 2. ID द्वारा पार्ट को प्राप्त करता है। */
const getPartById = async (req, res, next) => {
    const { error, id: partId } = handleIdValidation(req.params.partId, 'Part ID');
    if (error) return next(new APIError(error, 400)); 

    try {
        const part = await partModel.getPartById(partId);
        
        if (!part) return next(new APIError(`पार्ट ID ${partId} नहीं मिला।`, 404)); 
        return res.status(200).json({ data: part });
    } catch (error) {
        return next(error); 
    }
};

/** 3. सभी पार्ट्स को प्राप्त करता है (Paginated)। */
const getAllParts = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 25;
        const search = tr(req.query.search);
        const isActive = req.query.isActive === 'false' ? false : (req.query.isActive === 'true' ? true : null);
        const offset = (page - 1) * limit;
        
        const { data: parts, total_count } = await partModel.getAllParts({
            limit, offset, search, isActive,
        });

        const totalPages = Math.ceil(total_count / limit);

        return res.status(200).json({ 
            message: 'Master Parts retrieved successfully.', 
            pagination: {
                total_records: total_count, total_pages: totalPages,
                current_page: page, limit: limit,
            },
            data: parts 
        });
    } catch (error) {
        return next(error); 
    }
};

/** 4. पार्ट डेटा को अपडेट करता है। */
const updatePart = async (req, res, next) => {
    const { error, id: partId } = handleIdValidation(req.params.partId, 'Part ID');
    if (error) return next(new APIError(error, 400)); 

    const updateData = req.body;
    
    const validationError = validatePartUpdate(updateData); 
    if (validationError) return next(new APIError(validationError, 400)); 

    try {
        const updatedPart = await partModel.updatePart(partId, updateData);

        if (!updatedPart) return next(new APIError(`पार्ट ID ${partId} नहीं मिला।`, 404)); 
        return res.status(200).json({ 
            message: `पार्ट '${updatedPart.part_no}' सफलतापूर्वक अपडेट हुआ।`, 
            data: updatedPart 
        });
    } catch (error) {
        if (error.code === '23505') {
            error.status = 409; 
            error.message = 'अपडेट विफल: पार्ट नंबर और रिविज़न नंबर का संयोजन पहले से मौजूद है।';
        }
        return next(error); 
    }
};

/** 5. पार्ट को निष्क्रिय (Deactivate) करता है। */
const deactivatePart = async (req, res, next) => {
    const { error, id: partId } = handleIdValidation(req.params.partId, 'Part ID');
    if (error) return next(new APIError(error, 400)); 
    
    try {
        const deactivated = await partModel.deactivatePart(partId);
        
        if (!deactivated) {
            return next(new APIError(`पार्ट ID ${partId} नहीं मिला या पहले से ही निष्क्रिय है।`, 400)); 
        }
        return res.status(200).json({
            message: `पार्ट (ID: ${partId}) सफलतापूर्वक निष्क्रिय किया गया।`,
            data: deactivated,
        });
    } catch (error) {
        return next(error);
    }
};

/** 6. पार्ट को पुनः सक्रिय (Activate) करता है। */
const activatePart = async (req, res, next) => {
    const { error, id: partId } = handleIdValidation(req.params.partId, 'Part ID');
    if (error) return next(new APIError(error, 400)); 
    
    try {
        const activated = await partModel.activatePart(partId);
        
        if (!activated) {
            return next(new APIError(`पार्ट ID ${partId} नहीं मिला या पहले से ही सक्रिय है।`, 400)); 
        }
        return res.status(200).json({
            message: `पार्ट (ID: ${partId}) सफलतापूर्वक सक्रिय किया गया।`,
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
    createPart,
    getPartById,
    getAllParts,
    updatePart,
    deactivatePart,
    activatePart,
};