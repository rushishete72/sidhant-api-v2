/*
 * Context Note: यह 'master_locations' (Warehouse/Shelf Locations) के लिए HTTP अनुरोधों को संभालता है।
 * यह model को business logic से जोड़ता है।
 * (पुराने /src/modules/inventory/locations/location.controller.js से लिया गया)
 */

// निर्भरताएँ (Dependencies)
const locationModel = require('./location.model'); // (इसे हम अगले चरण में बनाएँगे)
const { APIError } = require('../../../utils/errorHandler'); 
// validateLocationCreation, validateLocationUpdate, tr को validation.js से इम्पोर्ट करें
const { validateLocationCreation, validateLocationUpdate, tr } = require('../../../utils/validation'); 

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

/** 1. नया Location बनाता है। */
const createLocation = async (req, res, next) => {
    // 1. उपयोगकर्ता को JWT (req.user) से प्राप्त करें
    const creatorId = req.user.user_id; 
    
    const locationData = { 
        ...req.body,
        created_by: creatorId // created_by को auth टोकन से जोड़ें
    };

    // 2. वैलिडेशन (यह validation.js में जोड़ा जाएगा)
    const validationError = validateLocationCreation(locationData); 
    if (validationError) {
        return next(new APIError(validationError, 400));
    }

    // 3. मॉडल को कॉल करें
    try {
        const newLocation = await locationModel.createLocation(locationData);

        return res.status(201).json({ 
            message: `लोकेशन '${newLocation.location_code}' सफलतापूर्वक बन गई।`, 
            data: newLocation 
        });
    } catch (error) {
        if (error.code === '23505') { // Unique constraint violation (location_code)
            error.status = 409; 
            error.message = 'यह लोकेशन कोड (Location Code) पहले से मौजूद है।';
        }
        return next(error); 
    }
};

/** 2. ID द्वारा Location को प्राप्त करता है। */
const getLocationById = async (req, res, next) => {
    const { error, id: locationId } = handleIdValidation(req.params.locationId, 'Location ID');
    if (error) return next(new APIError(error, 400)); 

    try {
        const location = await locationModel.getLocationById(locationId);
        
        if (!location) return next(new APIError(`लोकेशन ID ${locationId} नहीं मिली।`, 404)); 
        return res.status(200).json({ data: location });
    } catch (error) {
        return next(error); 
    }
};

/** 3. सभी Locations को प्राप्त करता है (Paginated)। */
const getAllLocations = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 25;
        const search = tr(req.query.search);
        const isActive = req.query.isActive === 'false' ? false : (req.query.isActive === 'true' ? true : null);
        const offset = (page - 1) * limit;
        
        const { data: locations, total_count } = await locationModel.getAllLocations({
            limit, offset, search, isActive,
        });

        const totalPages = Math.ceil(total_count / limit);

        return res.status(200).json({ 
            message: 'Master Locations retrieved successfully.', 
            pagination: {
                total_records: total_count, total_pages: totalPages,
                current_page: page, limit: limit,
            },
            data: locations 
        });
    } catch (error) {
        return next(error); 
    }
};

/** 4. Location डेटा को अपडेट करता है। */
const updateLocation = async (req, res, next) => {
    const { error, id: locationId } = handleIdValidation(req.params.locationId, 'Location ID');
    if (error) return next(new APIError(error, 400)); 

    const updateData = req.body;
    
    const validationError = validateLocationUpdate(updateData); 
    if (validationError) return next(new APIError(validationError, 400)); 

    try {
        const updatedLocation = await locationModel.updateLocation(locationId, updateData);

        if (!updatedLocation) return next(new APIError(`लोकेशन ID ${locationId} नहीं मिली।`, 404)); 
        return res.status(200).json({ 
            message: `लोकेशन '${updatedLocation.location_code}' सफलतापूर्वक अपडेट हुई।`, 
            data: updatedLocation 
        });
    } catch (error) {
        if (error.code === '23505') {
            error.status = 409; 
            error.message = 'अपडेट विफल: यह लोकेशन कोड (Location Code) पहले से मौजूद है।';
        }
        return next(error); 
    }
};

/** 5. Location को निष्क्रिय (Deactivate) करता है। */
const deactivateLocation = async (req, res, next) => {
    const { error, id: locationId } = handleIdValidation(req.params.locationId, 'Location ID');
    if (error) return next(new APIError(error, 400)); 
    
    try {
        const deactivated = await locationModel.deactivateLocation(locationId);
        
        if (!deactivated) {
            return next(new APIError(`लोकेशन ID ${locationId} नहीं मिली या पहले से ही निष्क्रिय है।`, 400)); 
        }
        return res.status(200).json({
            message: `लोकेशन (ID: ${locationId}) सफलतापूर्वक निष्क्रिय किया गया।`,
            data: deactivated,
        });
    } catch (error) {
        return next(error);
    }
};


// =========================================================================
// FINAL EXPORTS
// =========================================================================

module.exports = {
    createLocation,
    getLocationById,
    getAllLocations,
    updateLocation,
    deactivateLocation,
};