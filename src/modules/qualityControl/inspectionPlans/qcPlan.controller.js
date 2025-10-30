/*
 * Context Note: यह 'qc_inspection_plans' के लिए HTTP अनुरोधों को संभालता है।
 * यह Part ID के आधार पर Inspection Plan को प्रबंधित (manage) करता है।
 * (पुराने /src/modules/qualityControl/inspectionPlans/qcPlan.controller.js से लिया गया)
 */

// निर्भरताएँ (Dependencies)
const qcPlanModel = require('./qcPlan.model'); // (इसे हम अगले चरण में बनाएँगे)
const { APIError } = require('../../../utils/errorHandler'); 
const { validateQcPlanCreationOrUpdate, tr, isNumeric } = require('../../../utils/validation'); 

// --- Core Helper Functions ---

/** URL से प्राप्त ID (Part ID) को मान्य (Validate) करता है। */
const handlePartIdValidation = (id, paramName = 'Part ID') => {
    const parsedId = parseInt(id, 10);
    if (isNaN(parsedId) || parsedId <= 0) {
        return { error: `अमान्य (Invalid) ${paramName} URL में प्रदान किया गया है।` };
    }
    return { id: parsedId };
};

// =========================================================================
// A. CORE PLAN MANAGEMENT CONTROLLERS
// =========================================================================

/** 1. Part ID द्वारा Inspection Plan प्राप्त करता है। */
const getPlanByPartId = async (req, res, next) => {
    const { error, id: partId } = handlePartIdValidation(req.params.partId, 'Part ID');
    if (error) return next(new APIError(error, 400)); 

    try {
        const plan = await qcPlanModel.getPlanByPartId(partId);
        
        if (!plan) return next(new APIError(`पार्ट ID ${partId} के लिए Inspection Plan नहीं मिला।`, 404)); 
        return res.status(200).json({ data: plan });
    } catch (error) {
        return next(error); 
    }
};

/** 2. Inspection Plan बनाता या अपडेट करता है (Upsert Logic)। */
const createOrUpdatePlan = async (req, res, next) => {
    const creatorId = req.user.user_id; 
    
    const planData = { 
        ...req.body,
        created_by: creatorId 
    };

    // 1. वैलिडेशन: Creation और Update के लिए समान वैलिडेशन का उपयोग करें
    const validationError = validateQcPlanCreationOrUpdate(planData); 
    if (validationError) {
        return next(new APIError(validationError, 400));
    }
    
    try {
        // 2. मॉडल को कॉल करें
        const plan = await qcPlanModel.createOrUpdatePlan(planData);

        const isNew = req.method === 'POST' && plan.created_at.getTime() === plan.updated_at.getTime();

        return res.status(isNew ? 201 : 200).json({ 
            message: `Inspection Plan for Part ID ${plan.part_id} सफलतापूर्वक ${isNew ? 'बन गया' : 'अपडेट हुआ'}।`, 
            data: plan 
        });
    } catch (error) {
        if (error.code === '23503') { // Foreign Key Violation (Invalid Part ID)
            error.status = 400; 
            error.message = 'अमान्य पार्ट ID प्रदान की गई है।';
        }
        return next(error); 
    }
};

/** 3. सभी QC Inspection Plans को प्राप्त करता है (Paginated, Searchable)। */
const getAllQcPlans = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 25;
        const search = tr(req.query.search); // Part No या Name द्वारा खोजें
        const offset = (page - 1) * limit;
        
        const { data: plans, total_count } = await qcPlanModel.getAllQcPlans({
            limit, offset, search,
        });

        const totalPages = Math.ceil(total_count / limit);

        return res.status(200).json({ 
            message: 'QC Inspection Plans retrieved successfully.', 
            pagination: {
                total_records: total_count, total_pages: totalPages,
                current_page: page, limit: limit,
            },
            data: plans 
        });
    } catch (error) {
        return next(error); 
    }
};

/** 4. Plan Parameters की एक सरल सूची प्राप्त करता है। */
const getPlanParametersByPartId = async (req, res, next) => {
    const { error, id: partId } = handlePartIdValidation(req.params.partId, 'Part ID');
    if (error) return next(new APIError(error, 400)); 

    try {
        const parameters = await qcPlanModel.getPlanParametersByPartId(partId);
        
        return res.status(200).json({ 
            message: `Inspection Parameters for Part ID ${partId} retrieved.`,
            data: parameters 
        });
    } catch (error) {
        return next(error); 
    }
};


// =========================================================================
// FINAL EXPORTS
// =========================================================================

module.exports = {
    getPlanByPartId,
    createOrUpdatePlan,
    getAllQcPlans,
    getPlanParametersByPartId,
};