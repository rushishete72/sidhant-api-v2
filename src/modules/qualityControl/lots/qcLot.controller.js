/*
 * Context Note: यह 'quality_control_lots' के लिए HTTP अनुरोधों को संभालता है।
 * यह Lot Creation, Status Change, और Inspection flow को हैंडल करता है।
 * (पुराने /src/modules/qualityControl/lots/qcLot.controller.js से लिया गया)
 */

// निर्भरताएँ (Dependencies)
const qcLotModel = require('./qcLot.model'); // (इसे हम अगले चरण में बनाएँगे)
const { APIError } = require('../../../utils/errorHandler'); 
const { validateQCLotCreation, validateQCLotUpdate, tr, isNumeric } = require('../../../utils/validation'); 

// --- Core Helper Functions ---

/** URL से प्राप्त ID को मान्य (Validate) करता है। */
const handleIdValidation = (id, paramName = 'Lot ID') => {
    const parsedId = parseInt(id, 10);
    if (isNaN(parsedId) || parsedId <= 0) {
        return { error: `अमान्य (Invalid) ${paramName} URL में प्रदान किया गया है।` };
    }
    return { id: parsedId };
};

// =========================================================================
// A. CORE CRUD & STATUS MANAGEMENT CONTROLLERS
// =========================================================================

/** 1. नया QC Lot बनाता है। */
const createQcLot = async (req, res, next) => {
    const creatorId = req.user.user_id; 
    
    const lotData = { 
        ...req.body,
        created_by: creatorId 
    };

    // 1. वैलिडेशन
    const validationError = validateQCLotCreation(lotData); 
    if (validationError) {
        return next(new APIError(validationError, 400));
    }

    // 2. सुनिश्चित करें कि Lot Quantity, Part ID, Supplier ID संख्यात्मक हैं
    if (!isNumeric(lotData.part_id) || !isNumeric(lotData.supplier_id) || !isNumeric(lotData.lot_quantity)) {
        return next(new APIError('Part ID, Supplier ID, and Lot Quantity must be valid numbers.', 400));
    }
    
    try {
        // 3. मॉडल को कॉल करें
        const newLot = await qcLotModel.createQcLot(lotData);

        return res.status(201).json({ 
            message: `QC Lot '${newLot.lot_number}' सफलतापूर्वक बन गया।`, 
            data: newLot 
        });
    } catch (error) {
        if (error.code === '23503') { // Foreign Key Violation (e.g., Invalid Part ID or Supplier ID)
            error.status = 400; 
            error.message = 'अमान्य पार्ट (Part) या सप्लायर (Supplier) ID प्रदान की गई है।';
        }
        return next(error); 
    }
};

/** 2. ID द्वारा QC Lot को प्राप्त करता है। */
const getQcLotById = async (req, res, next) => {
    const { error, id: lotId } = handleIdValidation(req.params.lotId, 'Lot ID');
    if (error) return next(new APIError(error, 400)); 

    try {
        const lot = await qcLotModel.getQcLotById(lotId);
        
        if (!lot) return next(new APIError(`QC Lot ID ${lotId} नहीं मिला।`, 404)); 
        return res.status(200).json({ data: lot });
    } catch (error) {
        return next(error); 
    }
};

/** 3. सभी QC Lots को प्राप्त करता है (Paginated, Searchable)। */
const getAllQcLots = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 25;
        const search = tr(req.query.search);
        const status = tr(req.query.status); // PENDING, IN_INSPECTION, APPROVED, REJECTED
        const offset = (page - 1) * limit;
        
        const { data: lots, total_count } = await qcLotModel.getAllQcLots({
            limit, offset, search, status,
        });

        const totalPages = Math.ceil(total_count / limit);

        return res.status(200).json({ 
            message: 'QC Lots retrieved successfully.', 
            pagination: {
                total_records: total_count, total_pages: totalPages,
                current_page: page, limit: limit,
            },
            data: lots 
        });
    } catch (error) {
        return next(error); 
    }
};

/** 4. QC Lot डेटा को अपडेट करता है (माध्यमिक विवरण)। */
const updateQcLot = async (req, res, next) => {
    const { error, id: lotId } = handleIdValidation(req.params.lotId, 'Lot ID');
    if (error) return next(new APIError(error, 400)); 

    const updateData = req.body;
    
    // 1. वैलिडेशन
    const validationError = validateQCLotUpdate(updateData); 
    if (validationError) return next(new APIError(validationError, 400)); 

    try {
        const updatedLot = await qcLotModel.updateQcLot(lotId, updateData);

        if (!updatedLot) return next(new APIError(`QC Lot ID ${lotId} नहीं मिला।`, 404)); 
        return res.status(200).json({ 
            message: `QC Lot '${updatedLot.lot_number}' सफलतापूर्वक अपडेट हुआ।`, 
            data: updatedLot 
        });
    } catch (error) {
         if (error.code === '23503') { 
            error.status = 400; 
            error.message = 'अमान्य Foreign Key (जैसे: Part, Supplier) प्रदान की गई है।';
        }
        return next(error); 
    }
};

/** 5. QC Lot को Final Status (APPROVED/REJECTED) के साथ बंद करता है। */
const closeQcLot = async (req, res, next) => {
    const { error, id: lotId } = handleIdValidation(req.params.lotId, 'Lot ID');
    if (error) return next(new APIError(error, 400)); 
    
    const { final_status, total_accepted_qty, rejection_reason_id } = req.body;
    const finalizerId = req.user.user_id;

    if (!final_status || !['APPROVED', 'REJECTED'].includes(final_status.toUpperCase())) {
        return next(new APIError('Final status must be APPROVED or REJECTED.', 400));
    }
    if (final_status === 'REJECTED' && !isNumeric(rejection_reason_id)) {
        return next(new APIError('Rejection Reason ID is required for REJECTED status.', 400));
    }

    try {
        const closedLot = await qcLotModel.closeQcLot({
            lotId, 
            final_status: final_status.toUpperCase(), 
            total_accepted_qty: Number(total_accepted_qty), 
            rejection_reason_id: Number(rejection_reason_id) || null,
            finalized_by: finalizerId
        });
        
        if (!closedLot) {
            return next(new APIError(`QC Lot ID ${lotId} नहीं मिला या उसे बंद नहीं किया जा सकता।`, 400)); 
        }
        return res.status(200).json({
            message: `QC Lot '${closedLot.lot_number}' Final Status: ${closedLot.status}.`,
            data: closedLot,
        });
    } catch (error) {
         if (error.message.includes('cannot be closed')) {
             return next(new APIError(error.message, 400)); // मॉडल से लॉजिक एरर
         }
        return next(error);
    }
};

/** 6. पेंडिंग Lot Count प्राप्त करता है (डैशबोर्ड के लिए)। */
const getPendingLotCount = async (req, res, next) => {
    try {
        const count = await qcLotModel.getPendingLotCount();
        return res.status(200).json({
            message: 'Pending Lot Count retrieved successfully.',
            data: {
                pending_lots: count.pending_lots,
                in_inspection_lots: count.in_inspection_lots,
                total_pending: count.total_pending
            }
        });
    } catch (error) {
        return next(error);
    }
};


// =========================================================================
// FINAL EXPORTS
// =========================================================================

module.exports = {
    createQcLot,
    getQcLotById,
    getAllQcLots,
    updateQcLot,
    closeQcLot,
    getPendingLotCount,
};