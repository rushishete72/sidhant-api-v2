/*
 * Context Note: यह 'qc_inspection_results' के लिए HTTP अनुरोधों को संभालता है।
 * यह Lot ID के लिए Inspection Result को कैप्चर करता है।
 * (पुराने /src/modules/qualityControl/inspectionResults/qcResult.controller.js से लिया गया)
 */

// निर्भरताएँ (Dependencies)
const qcResultModel = require('./qcResult.model'); // (इसे हम अगले चरण में बनाएँगे)
const { APIError } = require('../../../utils/errorHandler'); 
const { validateInspectionResults, tr, isNumeric } = require('../../../utils/validation'); 

// --- Core Helper Functions ---

/** URL से प्राप्त ID (Lot ID) को मान्य (Validate) करता है। */
const handleLotIdValidation = (id, paramName = 'Lot ID') => {
    const parsedId = parseInt(id, 10);
    if (isNaN(parsedId) || parsedId <= 0) {
        return { error: `अमान्य (Invalid) ${paramName} URL में प्रदान किया गया है।` };
    }
    return { id: parsedId };
};

// =========================================================================
// A. CORE RESULT MANAGEMENT CONTROLLERS
// =========================================================================

/** 1. Lot ID द्वारा Inspection Results प्राप्त करता है। */
const getResultsByLotId = async (req, res, next) => {
    const { error, id: lotId } = handleLotIdValidation(req.params.lotId, 'Lot ID');
    if (error) return next(new APIError(error, 400)); 

    try {
        const results = await qcResultModel.getResultsByLotId(lotId);
        
        if (!results || results.results.length === 0) {
            return next(new APIError(`QC Lot ID ${lotId} के लिए कोई Inspection Result नहीं मिला।`, 404)); 
        }
        return res.status(200).json({ 
            message: `Inspection Results for Lot ID ${lotId} retrieved.`,
            data: results 
        });
    } catch (error) {
        return next(error); 
    }
};

/** 2. Initial Inspection Results सेव/क्रिएट करता है। */
const saveInspectionResults = async (req, res, next) => {
    const inspectorId = req.user.user_id; 
    const { lot_id, inspected_quantity, results } = req.body;

    if (!lot_id || !isNumeric(lot_id)) {
        return next(new APIError('Lot ID is required and must be numeric.', 400));
    }
    
    const lotId = Number(lot_id);
    const resultData = { lot_id: lotId, inspected_quantity, results, inspected_by: inspectorId };

    // 1. वैलिडेशन: Results Array और Quantities की जाँच करें
    const validationError = validateInspectionResults(resultData); 
    if (validationError) {
        return next(new APIError(validationError, 400));
    }
    
    try {
        // 2. मॉडल को कॉल करें (यह Lot Status को 'IN_INSPECTION' में बदलता है)
        const newResult = await qcResultModel.saveInspectionResults(resultData);

        return res.status(201).json({ 
            message: `Initial Inspection Results for Lot ID ${lotId} सफलतापूर्वक सेव हुए।`, 
            data: newResult 
        });
    } catch (error) {
        if (error.code === '23505') { 
            error.status = 409; 
            error.message = 'इस Lot ID के लिए Results पहले से मौजूद हैं। कृपया PUT का उपयोग करें।';
        }
        if (error.message.includes('Lot must be PENDING')) {
            error.status = 400;
        }
        return next(error); 
    }
};

/** 3. Inspection Results को अपडेट करता है। */
const updateInspectionResults = async (req, res, next) => {
    const { error, id: lotId } = handleLotIdValidation(req.params.lotId, 'Lot ID');
    if (error) return next(new APIError(error, 400)); 

    const inspectorId = req.user.user_id;
    const { inspected_quantity, results } = req.body;
    
    const updateData = { lot_id: lotId, inspected_quantity, results, updated_by: inspectorId };
    
    // 1. वैलिडेशन
    const validationError = validateInspectionResults(updateData, true); // true = update mode
    if (validationError) return next(new APIError(validationError, 400)); 

    try {
        const updatedResult = await qcResultModel.updateInspectionResults(lotId, updateData);

        if (!updatedResult) return next(new APIError(`QC Lot ID ${lotId} के लिए कोई मौजूदा Result नहीं मिला।`, 404)); 
        
        return res.status(200).json({ 
            message: `Inspection Results for Lot ID ${lotId} सफलतापूर्वक अपडेट हुए।`, 
            data: updatedResult 
        });
    } catch (error) {
        if (error.message.includes('cannot be updated')) {
             return next(new APIError(error.message, 400));
        }
        return next(error); 
    }
};

/** 4. AQL Table lookup (UI Helper) प्राप्त करता है। */
const getAqlTableLookup = async (req, res, next) => {
    // Plan ID का उपयोग करें, Lot ID का नहीं
    const { error, id: planId } = handleIdValidation(req.params.planId, 'Plan ID'); 
    if (error) return next(new APIError(error, 400)); 
    
    // NOTE: AQL लॉजिक बहुत जटिल हो सकता है, हम यहाँ केवल डेटाबेस से Plan ID द्वारा AQL डेटा प्राप्त करने का मॉडल कॉल करेंगे
    
    try {
        const aqlData = await qcResultModel.getAqlTableLookup(planId);
        
        return res.status(200).json({ 
            message: `AQL data for Plan ID ${planId} retrieved.`,
            data: aqlData 
        });
    } catch (error) {
        return next(error); 
    }
};


// =========================================================================
// FINAL EXPORTS
// =========================================================================

module.exports = {
    getResultsByLotId,
    saveInspectionResults,
    updateInspectionResults,
    getAqlTableLookup,
};