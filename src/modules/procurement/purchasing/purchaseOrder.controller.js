/*
 * Context Note: यह 'procurement_purchase_orders' के लिए HTTP अनुरोधों को संभालता है।
 * यह PO Creation, Status Change, और Line Item management को हैंडल करता है।
 * (पुराने /src/modules/procurement/purchasing/purchaseOrder.controller.js से लिया गया)
 */

// निर्भरताएँ (Dependencies)
const poModel = require('./purchaseOrder.model'); // (इसे हम अगले चरण में बनाएँगे)
const { APIError } = require('../../../utils/errorHandler'); 
const { validatePOCreation, validatePOUpdate, tr, isNumeric } = require('../../../utils/validation'); 

// --- Core Helper Functions ---

/** URL से प्राप्त ID (PO ID) को मान्य (Validate) करता है। */
const handleIdValidation = (id, paramName = 'PO ID') => {
    const parsedId = parseInt(id, 10);
    if (isNaN(parsedId) || parsedId <= 0) {
        return { error: `अमान्य (Invalid) ${paramName} URL में प्रदान किया गया है।` };
    }
    return { id: parsedId };
};

// =========================================================================
// A. CORE PO MANAGEMENT CONTROLLERS
// =========================================================================

/** 1. नया Purchase Order बनाता है। (Header + Line Items) */
const createPurchaseOrder = async (req, res, next) => {
    const creatorId = req.user.user_id; 
    
    const poData = { 
        ...req.body,
        created_by: creatorId 
    };

    // 1. वैलिडेशन
    const validationError = validatePOCreation(poData); 
    if (validationError) {
        return next(new APIError(validationError, 400));
    }
    
    try {
        // 2. मॉडल को कॉल करें
        const newPO = await poModel.createPurchaseOrder(poData);

        return res.status(201).json({ 
            message: `Purchase Order '${newPO.po_number}' सफलतापूर्वक बन गया।`, 
            data: newPO 
        });
    } catch (error) {
        if (error.code === '23503') { // Foreign Key Violation (Invalid Supplier ID या Part ID)
            error.status = 400; 
            error.message = 'अमान्य सप्लायर (Supplier), पार्ट (Part) या UOM ID प्रदान की गई है।';
        }
        return next(error); 
    }
};

/** 2. ID द्वारा Purchase Order प्राप्त करता है। */
const getPurchaseOrderById = async (req, res, next) => {
    const { error, id: poId } = handleIdValidation(req.params.poId, 'PO ID');
    if (error) return next(new APIError(error, 400)); 

    try {
        const po = await poModel.getPurchaseOrderById(poId);
        
        if (!po) return next(new APIError(`Purchase Order ID ${poId} नहीं मिला।`, 404)); 
        return res.status(200).json({ data: po });
    } catch (error) {
        return next(error); 
    }
};

/** 3. सभी Purchase Orders को प्राप्त करता है (Paginated, Searchable)। */
const getAllPurchaseOrders = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 25;
        const search = tr(req.query.search);
        const status = tr(req.query.status); // PENDING, AUTHORIZED, RECEIVED, CANCELLED
        const offset = (page - 1) * limit;
        
        const { data: poList, total_count } = await poModel.getAllPurchaseOrders({
            limit, offset, search, status,
        });

        const totalPages = Math.ceil(total_count / limit);

        return res.status(200).json({ 
            message: 'Purchase Orders retrieved successfully.', 
            pagination: {
                total_records: total_count, total_pages: totalPages,
                current_page: page, limit: limit,
            },
            data: poList 
        });
    } catch (error) {
        return next(error); 
    }
};

/** 4. Purchase Order डेटा को अपडेट करता है (केवल PENDING स्थिति में)। */
const updatePurchaseOrder = async (req, res, next) => {
    const { error, id: poId } = handleIdValidation(req.params.poId, 'PO ID');
    if (error) return next(new APIError(error, 400)); 

    const updateData = req.body;
    
    // 1. वैलिडेशन
    const validationError = validatePOUpdate(updateData); 
    if (validationError) return next(new APIError(validationError, 400)); 

    try {
        const updatedPO = await poModel.updatePurchaseOrder(poId, updateData);

        if (!updatedPO) return next(new APIError(`Purchase Order ID ${poId} नहीं मिला।`, 404)); 
        return res.status(200).json({ 
            message: `Purchase Order '${updatedPO.po_number}' सफलतापूर्वक अपडेट हुआ।`, 
            data: updatedPO 
        });
    } catch (error) {
        if (error.message.includes('cannot be updated')) {
             return next(new APIError(error.message, 400)); // मॉडल से लॉजिक एरर
        }
        if (error.code === '23503') { 
            error.status = 400; 
            error.message = 'अमान्य Foreign Key (जैसे: Supplier, Part) प्रदान की गई है।';
        }
        return next(error); 
    }
};

/** 5. Purchase Order को Approve/Authorize करता है। */
const authorizePurchaseOrder = async (req, res, next) => {
    const { error, id: poId } = handleIdValidation(req.params.poId, 'PO ID');
    if (error) return next(new APIError(error, 400)); 

    const authorizerId = req.user.user_id;
    
    try {
        const authorizedPO = await poModel.authorizePurchaseOrder(poId, authorizerId);
        
        if (!authorizedPO) return next(new APIError(`Purchase Order ID ${poId} नहीं मिला या उसे Approve नहीं किया जा सकता।`, 400)); 
        
        return res.status(200).json({
            message: `Purchase Order '${authorizedPO.po_number}' सफलतापूर्वक Authorize हुआ।`,
            data: authorizedPO,
        });
    } catch (error) {
        if (error.message.includes('cannot be authorized')) {
             return next(new APIError(error.message, 400));
        }
        return next(error);
    }
};

/** 6. Purchase Order को Cancel करता है। */
const cancelPurchaseOrder = async (req, res, next) => {
    const { error, id: poId } = handleIdValidation(req.params.poId, 'PO ID');
    if (error) return next(new APIError(error, 400)); 

    const cancellerId = req.user.user_id;
    
    try {
        const cancelledPO = await poModel.cancelPurchaseOrder(poId, cancellerId);
        
        if (!cancelledPO) return next(new APIError(`Purchase Order ID ${poId} नहीं मिला या उसे Cancel नहीं किया जा सकता।`, 400)); 
        
        return res.status(200).json({
            message: `Purchase Order '${cancelledPO.po_number}' सफलतापूर्वक Cancel हुआ।`,
            data: cancelledPO,
        });
    } catch (error) {
        if (error.message.includes('cannot be cancelled')) {
             return next(new APIError(error.message, 400));
        }
        return next(error);
    }
};

/** 7. Purchase Order Items/Lines प्राप्त करता है। */
const getPoItemsByPoId = async (req, res, next) => {
    const { error, id: poId } = handleIdValidation(req.params.poId, 'PO ID');
    if (error) return next(new APIError(error, 400)); 

    try {
        const items = await poModel.getPoItemsByPoId(poId);
        
        if (!items) return next(new APIError(`Purchase Order ID ${poId} के लिए कोई आइटम नहीं मिला।`, 404)); 
        
        return res.status(200).json({ 
            message: `PO Items for PO ID ${poId} retrieved.`,
            data: items 
        });
    } catch (error) {
        return next(error); 
    }
};


// =========================================================================
// FINAL EXPORTS
// =========================================================================

module.exports = {
    createPurchaseOrder,
    getPurchaseOrderById,
    getAllPurchaseOrders,
    updatePurchaseOrder,
    authorizePurchaseOrder,
    cancelPurchaseOrder,
    getPoItemsByPoId,
};