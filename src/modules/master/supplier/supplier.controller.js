/*
 * Context Note: यह 'master_suppliers' के लिए HTTP अनुरोधों को संभालता है।
 * यह model को business logic से जोड़ता है।
 */

// निर्भरताएँ (Dependencies)
const supplierModel = require('./supplier.model'); // (इसे हम अगले चरण में बनाएँगे)
const { APIError } = require('../../../utils/errorHandler'); 
// validateSupplierCreation को validation.js से इम्पोर्ट करें
const { validateSupplierCreation, validateSupplierUpdate, tr } = require('../../../utils/validation'); 

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

/** 1. नया सप्लायर बनाता है। */
const createSupplier = async (req, res, next) => {
    // 1. उपयोगकर्ता को JWT (req.user) से प्राप्त करें, जिसने यह बनाया है
    const creatorId = req.user.user_id; 
    
    const supplierData = { 
        ...req.body,
        created_by: creatorId // created_by को auth टोकन से जोड़ें
    };

    // 2. वैलिडेशन (पुराने /utils/validation.js से)
    // (हम बाद में validation.js को अपडेट करेंगे)
    // const validationError = validateSupplierCreation(supplierData); 
    // if (validationError) {
    //     return next(new APIError(validationError, 400));
    // }

    // 3. मॉडल को कॉल करें (अभी के लिए प्लेसहोल्डर)
    try {
        // const newSupplier = await supplierModel.createSupplier(supplierData);
        // (नकली प्रतिक्रिया (Mock response) जब तक मॉडल नहीं बनता)
        const newSupplier = { ...supplierData, supplier_id: 1, is_active: true };

        return res.status(201).json({ 
            message: `सप्लायर '${newSupplier.supplier_name}' सफलतापूर्वक बन गया।`, 
            data: newSupplier 
        });
    } catch (error) {
         // (असली (Real) DB एरर हैंडलिंग)
        if (error.code === '23505') { // Unique constraint violation
            error.status = 409; 
            error.message = 'सप्लायर का नाम (Name) या कोड (Code) पहले से मौजूद है।';
        }
        return next(error); 
    }
};

/** 2. ID द्वारा सप्लायर को प्राप्त करता है। */
const getSupplierById = async (req, res, next) => {
    const { error, id: supplierId } = handleIdValidation(req.params.supplierId, 'Supplier ID');
    if (error) return next(new APIError(error, 400)); 

    try {
        // const supplier = await supplierModel.getSupplierById(supplierId);
        // (नकली प्रतिक्रिया (Mock response))
        const supplier = { supplier_id: supplierId, supplier_name: 'Mock Supplier', supplier_code: 'MS-001' };
        
        if (!supplier) return next(new APIError(`सप्लायर ID ${supplierId} नहीं मिला।`, 404)); 
        return res.status(200).json({ data: supplier });
    } catch (error) {
        return next(error); 
    }
};

/** 3. सभी सप्लायर्स को प्राप्त करता है (Paginated)। */
const getAllSuppliers = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 25;
        const search = tr(req.query.search);
        // (isActive फ़िल्टर, पुराने कोड से)
        const isActive = req.query.isActive === 'false' ? false : (req.query.isActive === 'true' ? true : null);
        
        // (नकली प्रतिक्रिया (Mock response))
        const suppliers = [{ supplier_id: 1, supplier_name: 'Mock Supplier', supplier_code: 'MS-001' }];
        const total_count = 1;

        const totalPages = Math.ceil(total_count / limit);

        return res.status(200).json({ 
            message: 'Master Suppliers retrieved successfully.', 
            pagination: {
                total_records: total_count, total_pages: totalPages,
                current_page: page, limit: limit,
            },
            data: suppliers 
        });
    } catch (error) {
        return next(error); 
    }
};

/** 4. सप्लायर डेटा को अपडेट करता है। */
const updateSupplier = async (req, res, next) => {
    const { error, id: supplierId } = handleIdValidation(req.params.supplierId, 'Supplier ID');
    if (error) return next(new APIError(error, 400)); 

    const updateData = req.body;
    // (वैलिडेशन जोड़ा जाएगा)

    try {
        // (नकली प्रतिक्रिया (Mock response))
        const updatedSupplier = { supplier_id: supplierId, ...updateData };

        if (!updatedSupplier) return next(new APIError(`सप्लायर ID ${supplierId} नहीं मिला।`, 404)); 
        return res.status(200).json({ 
            message: `सप्लायर '${updatedSupplier.supplier_name}' सफलतापूर्वक अपडेट हुआ।`, 
            data: updatedSupplier 
        });
    } catch (error) {
        if (error.code === '23505') {
            error.status = 409; 
            error.message = 'सप्लायर का नाम (Name) या कोड (Code) पहले से मौजूद है।';
        }
        return next(error); 
    }
};

/** 5. सप्लायर को निष्क्रिय (Deactivate) करता है। */
const deactivateSupplier = async (req, res, next) => {
    const { error, id: supplierId } = handleIdValidation(req.params.supplierId, 'Supplier ID');
    if (error) return next(new APIError(error, 400)); 
    
    try {
        // (नकली प्रतिक्रिया (Mock response))
        const deactivated = { supplier_id: supplierId, is_active: false };
        
        if (!deactivated) {
            return next(new APIError(`सप्लायर ID ${supplierId} नहीं मिला या पहले से ही निष्क्रिय है।`, 400)); 
        }
        return res.status(200).json({
            message: `सप्लायर (ID: ${supplierId}) सफलतापूर्वक निष्क्रिय किया गया।`,
            data: deactivated,
        });
    } catch (error) {
        return next(error);
    }
};

/** 6. सप्लायर को पुनः सक्रिय (Activate) करता है। */
const activateSupplier = async (req, res, next) => {
    const { error, id: supplierId } = handleIdValidation(req.params.supplierId, 'Supplier ID');
    if (error) return next(new APIError(error, 400)); 
    
    try {
        // (नकली प्रतिक्रिया (Mock response))
        const activated = { supplier_id: supplierId, is_active: true };
        
        if (!activated) {
            return next(new APIError(`सप्लायर ID ${supplierId} नहीं मिला या पहले से ही सक्रिय है।`, 400)); 
        }
        return res.status(200).json({
            message: `सप्लायर (ID: ${supplierId}) सफलतापूर्वक सक्रिय किया गया।`,
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
    createSupplier,
    getSupplierById,
    getAllSuppliers,
    updateSupplier,
    deactivateSupplier,
    activateSupplier,
    // (यहाँ और भी कंट्रोलर फ़ंक्शंस (पुराने कोड से) जोड़े जा सकते हैं)
};