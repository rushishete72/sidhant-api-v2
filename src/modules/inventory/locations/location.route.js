/*
 * Context Note: यह 'master_locations' (Warehouse/Shelf Locations) टेबल के लिए API routes को परिभाषित करता है।
 * Authentication (JWT) और Authorization ('manage:locations') की आवश्यकता है।
 * (पुराने /src/modules/inventory/locations/location.route.js से लिया गया)
 */
const express = require('express');
const router = express.Router();
// मिडलवेयर इम्पोर्ट करें
const { authenticate, authorize } = require('../../../middleware/auth');

// कंट्रोलर फ़ंक्शंस (अभी के लिए प्लेसहोल्डर्स)
const placeholder = (req, res) => res.status(501).json({ 
    message: "Endpoint Not Implemented", 
    path: req.path,
    id: req.params.locationId || null
});

// const locationController = require('./location.controller');

// =========================================================================
// Routes Definition
// =========================================================================

// इस मॉड्यूल के सभी रूट्स के लिए प्रमाणीकरण (Authentication) की आवश्यकता है।
router.use(authenticate);

// 1. GET All Locations (Paginated, Searchable)
// (अनुमति: 'read:locations' की आवश्यकता है)
router.get('/', authorize(['read:locations', 'inventory_user', 'admin']), placeholder /* locationController.getAllLocations */); 

// 2. POST Create New Location
// (अनुमति: 'manage:locations' की आवश्यकता है)
router.post('/', authorize(['manage:locations', 'inventory_manager', 'admin']), placeholder /* locationController.createLocation */);

// 3. GET Location by ID
// (अनुमति: 'read:locations' की आवश्यकता है)
router.get('/:locationId', authorize(['read:locations', 'inventory_user', 'admin']), placeholder /* locationController.getLocationById */);

// 4. PUT Update Location Details
// (अनुमति: 'manage:locations' की आवश्यकता है)
router.put('/:locationId', authorize(['manage:locations', 'inventory_manager', 'admin']), placeholder /* locationController.updateLocation */);

// 5. PATCH Deactivate Location
// (अनुमति: 'manage:locations' की आवश्यकता है)
router.patch('/status/deactivate/:locationId', authorize(['manage:locations', 'admin']), placeholder /* locationController.deactivateLocation */);


module.exports = router;