/*
 * Context Note: यह 'master_clients' के लिए HTTP अनुरोधों को संभालता है।
 * यह model को business logic से जोड़ता है।
 */

// निर्भरताएँ (Dependencies)
const clientModel = require('./client.model'); // (इसे हम अगले चरण में बनाएँगे)
const { APIError } = require('../../../utils/errorHandler'); 
// (हम बाद में validation.js को अपडेट करेंगे)
const { validateClientCreation, validateClientUpdate, tr } = require('../../../utils/validation'); 

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

/** 1. नया क्लाइंट बनाता है। */
const createClient = async (req, res, next) => {
    // 1. उपयोगकर्ता को JWT (req.user) से प्राप्त करें
    const creatorId = req.user.user_id; 
    
    const clientData = { 
        ...req.body,
        created_by: creatorId // created_by को auth टोकन से जोड़ें
    };

    // 2. वैलिडेशन (यह validation.js में जोड़ा जाएगा)
    // const validationError = validateClientCreation(clientData); 
    // if (validationError) {
    //     return next(new APIError(validationError, 400));
    // }

    // 3. मॉडल को कॉल करें (अभी के लिए प्लेसहोल्डर)
    try {
        // const newClient = await clientModel.createClient(clientData);
        // (नकली प्रतिक्रिया (Mock response) जब तक मॉडल नहीं बनता)
        const newClient = { ...clientData, client_id: 1, is_active: true };

        return res.status(201).json({ 
            message: `क्लाइंट '${newClient.client_name}' सफलतापूर्वक बन गया।`, 
            data: newClient 
        });
    } catch (error) {
        if (error.code === '23505') { // Unique constraint violation
            error.status = 409; 
            error.message = 'क्लाइंट का नाम (Name) या ईमेल (Email) पहले से मौजूद है।';
        }
        return next(error); 
    }
};

/** 2. ID द्वारा क्लाइंट को प्राप्त करता है। */
const getClientById = async (req, res, next) => {
    const { error, id: clientId } = handleIdValidation(req.params.clientId, 'Client ID');
    if (error) return next(new APIError(error, 400)); 

    try {
        // const client = await clientModel.getClientById(clientId);
        // (नकली प्रतिक्रिया (Mock response))
        const client = { client_id: clientId, client_name: 'Mock Client' };
        
        if (!client) return next(new APIError(`क्लाइंट ID ${clientId} नहीं मिला।`, 404)); 
        return res.status(200).json({ data: client });
    } catch (error) {
        return next(error); 
    }
};

/** 3. सभी क्लाइंट्स को प्राप्त करता है (Paginated)। */
const getAllClients = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 25;
        const search = tr(req.query.search);
        const isActive = req.query.isActive === 'false' ? false : (req.query.isActive === 'true' ? true : null);
        
        // (नकली प्रतिक्रिया (Mock response))
        const clients = [{ client_id: 1, client_name: 'Mock Client' }];
        const total_count = 1;

        const totalPages = Math.ceil(total_count / limit);

        return res.status(200).json({ 
            message: 'Master Clients retrieved successfully.', 
            pagination: {
                total_records: total_count, total_pages: totalPages,
                current_page: page, limit: limit,
            },
            data: clients 
        });
    } catch (error) {
        return next(error); 
    }
};

/** 4. क्लाइंट डेटा को अपडेट करता है। */
const updateClient = async (req, res, next) => {
    const { error, id: clientId } = handleIdValidation(req.params.clientId, 'Client ID');
    if (error) return next(new APIError(error, 400)); 

    const updateData = req.body;
    // (वैलिडेशन जोड़ा जाएगा)

    try {
        // (नकली प्रतिक्रिया (Mock response))
        const updatedClient = { client_id: clientId, ...updateData };

        if (!updatedClient) return next(new APIError(`क्लाइंट ID ${clientId} नहीं मिला।`, 404)); 
        return res.status(200).json({ 
            message: `क्लाइंट '${updatedClient.client_name}' सफलतापूर्वक अपडेट हुआ।`, 
            data: updatedClient 
        });
    } catch (error) {
        if (error.code === '23505') {
            error.status = 409; 
            error.message = 'क्लाइंट का नाम (Name) या ईमेल (Email) पहले से मौजूद है।';
        }
        return next(error); 
    }
};

/** 5. क्लाइंट को निष्क्रिय (Deactivate) करता है। */
const deactivateClient = async (req, res, next) => {
    const { error, id: clientId } = handleIdValidation(req.params.clientId, 'Client ID');
    if (error) return next(new APIError(error, 400)); 
    
    try {
        // (नकली प्रतिक्रिया (Mock response))
        const deactivated = { client_id: clientId, is_active: false };
        
        if (!deactivated) {
            return next(new APIError(`क्लाइंट ID ${clientId} नहीं मिला या पहले से ही निष्क्रिय है।`, 400)); 
        }
        return res.status(200).json({
            message: `क्लाइंट (ID: ${clientId}) सफलतापूर्वक निष्क्रिय किया गया।`,
            data: deactivated,
        });
    } catch (error) {
        return next(error);
    }
};

/** 6. क्लाइंट को पुनः सक्रिय (Activate) करता है। */
const activateClient = async (req, res, next) => {
    const { error, id: clientId } = handleIdValidation(req.params.clientId, 'Client ID');
    if (error) return next(new APIError(error, 400)); 
    
    try {
        // (नकली प्रतिक्रिया (Mock response))
        const activated = { client_id: clientId, is_active: true };
        
        if (!activated) {
            return next(new APIError(`क्लाइंट ID ${clientId} नहीं मिला या पहले से ही सक्रिय है।`, 400)); 
        }
        return res.status(200).json({
            message: `क्लाइंट (ID: ${clientId}) सफलतापूर्वक सक्रिय किया गया।`,
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
    createClient,
    getClientById,
    getAllClients,
    updateClient,
    deactivateClient,
    activateClient,
};