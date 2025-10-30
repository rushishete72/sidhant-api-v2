/*
 * Context Note: यह 'inventory_stock' के लिए HTTP अनुरोधों को संभालता है।
 * यह वर्तमान इन्वेंट्री स्तरों और स्टॉक एडजस्टमेंट को प्रबंधित (manage) करता है।
 * (पुराने /src/modules/inventory/stock/stock.controller.js से लिया गया)
 */

// निर्भरताएँ (Dependencies)
const stockModel = require('./stock.model'); // (इसे हम अगले चरण में बनाएँगे)
const { APIError } = require('../../../utils/errorHandler'); 
const { validateStockAdjustment, tr, isNumeric } = require('../../../utils/validation'); 

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
// A. CORE STOCK MANAGEMENT CONTROLLERS
// =========================================================================

/** 1. वर्तमान स्टॉक स्तर (Current Stock Levels) प्राप्त करता है। */
const getCurrentStock = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 25;
        const search = tr(req.query.search); // Part No, Part Name, या Location Code द्वारा खोजें
        const locationId = isNumeric(req.query.locationId) ? Number(req.query.locationId) : null;
        const statusId = isNumeric(req.query.statusId) ? Number(req.query.statusId) : null;
        const offset = (page - 1) * limit;
        
        const { data: stock, total_count } = await stockModel.getCurrentStock({
            limit, offset, search, locationId, statusId
        });

        const totalPages = Math.ceil(total_count / limit);

        return res.status(200).json({ 
            message: 'Current Stock Levels retrieved successfully.', 
            pagination: {
                total_records: total_count, total_pages: totalPages,
                current_page: page, limit: limit,
            },
            data: stock 
        });
    } catch (error) {
        return next(error); 
    }
};

/** 2. Part ID द्वारा स्टॉक विवरण प्राप्त करता है। */
const getStockByPartId = async (req, res, next) => {
    const { error, id: partId } = handleIdValidation(req.params.partId, 'Part ID');
    if (error) return next(new APIError(error, 400)); 

    try {
        const stockDetails = await stockModel.getStockByPartId(partId);
        
        if (!stockDetails || stockDetails.length === 0) return next(new APIError(`पार्ट ID ${partId} के लिए कोई स्टॉक नहीं मिला।`, 404)); 
        
        return res.status(200).json({ 
            message: `Stock details for Part ID ${partId} retrieved.`,
            data: stockDetails 
        });
    } catch (error) {
        return next(error); 
    }
};

/** 3. Stock History/Movements प्राप्त करता है। */
const getStockHistory = async (req, res, next) => {
    const { error, id: partId } = handleIdValidation(req.params.partId, 'Part ID');
    if (error) return next(new APIError(error, 400)); 
    
    try {
        const limit = parseInt(req.query.limit, 10) || 50;
        const offset = parseInt(req.query.offset, 10) || 0;
        
        const movements = await stockModel.getStockHistory({ partId, limit, offset });
        
        return res.status(200).json({ 
            message: `Stock History for Part ID ${partId} retrieved.`,
            data: movements 
        });
    } catch (error) {
        return next(error); 
    }
};

/** 4. Manual Stock Adjustment बनाता है। */
const createStockAdjustment = async (req, res, next) => {
    const adjusterId = req.user.user_id; 
    
    const adjustmentData = { 
        ...req.body,
        created_by: adjusterId 
    };

    // 1. वैलिडेशन: Stock Adjustment के लिए (जो validation.js में जोड़ा जाएगा)
    const validationError = validateStockAdjustment(adjustmentData); 
    if (validationError) {
        return next(new APIError(validationError, 400));
    }
    
    try {
        // 2. मॉडल को कॉल करें (यह inventory_stock और inventory_movements को अपडेट करता है)
        const adjustment = await stockModel.createStockAdjustment(adjustmentData);

        return res.status(201).json({ 
            message: `Stock Adjustment '${adjustment.adjustment_type}' सफलतापूर्वक पोस्ट किया गया।`, 
            data: adjustment 
        });
    } catch (error) {
        if (error.message.includes('Insufficient stock')) {
            return next(new APIError(error.message, 400));
        }
        return next(error); 
    }
};

/** 5. Location ID द्वारा स्टॉक प्राप्त करता है। */
const getStockByLocation = async (req, res, next) => {
    const { error, id: locationId } = handleIdValidation(req.params.locationId, 'Location ID');
    if (error) return next(new APIError(error, 400)); 

    try {
        const stockAtLocation = await stockModel.getStockByLocation(locationId);
        
        if (!stockAtLocation || stockAtLocation.length === 0) return next(new APIError(`Location ID ${locationId} पर कोई स्टॉक नहीं मिला।`, 404)); 
        
        return res.status(200).json({ 
            message: `Stock at Location ID ${locationId} retrieved.`,
            data: stockAtLocation 
        });
    } catch (error) {
        return next(error); 
    }
};

// =========================================================================
// FINAL EXPORTS
// =========================================================================

module.exports = {
    getCurrentStock,
    getStockByPartId,
    getStockHistory,
    createStockAdjustment,
    getStockByLocation,
};