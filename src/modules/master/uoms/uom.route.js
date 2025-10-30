/*
 * Context Note: यह 'master_uoms' (Units of Measurement) टेबल के लिए API routes को परिभाषित करता है।
 * यह 'authenticate' मिडलवेयर द्वारा सुरक्षित है।
 * (पुराने /src/modules/masterData/uom/uom.route.js से लिया गया)
 */
const express = require('express');
const router = express.Router();
// मिडलवेयर इम्पोर्ट करें
const { authenticate, authorize } = require('../../../middleware/auth');

// कंट्रोलर फ़ंक्शंस (अभी के लिए प्लेसहोल्डर्स)
const placeholder = (req, res) => res.status(501).json({ 
    message: "Endpoint Not Implemented", 
    path: req.path,
    id: req.params.uomId || null
});

// const uomController = require('./uom.controller');

// =========================================================================
// Routes Definition
// =========================================================================

// इस मॉड्यूल के सभी रूट्स के लिए प्रमाणीकरण (Authentication) की आवश्यकता है।
router.use(authenticate);

// 1. GET All UOMs (Paginated, Searchable)
// (अनुमति: 'read:uoms' की आवश्यकता है)
router.get('/', authorize(['read:uoms', 'admin']), placeholder /* uomController.getAllUoms */); 

// 2. POST Create New UOM
// (अनुमति: 'create:uoms' की आवश्यकता है)
router.post('/', authorize(['create:uoms', 'admin']), placeholder /* uomController.createUom */);

// 3. GET UOM by ID
// (अनुमति: 'read:uoms' की आवश्यकता है)
router.get('/:uomId', authorize(['read:uoms', 'admin']), placeholder /* uomController.getUomById */);

// 4. PUT Update UOM
// (अनुमति: 'update:uoms' की आवश्यकता है)
router.put('/:uomId', authorize(['update:uoms', 'admin']), placeholder /* uomController.updateUom */);

// 5. PATCH Deactivate UOM
// (अनुमति: 'delete:uoms' की आवश्यकता है)
router.patch('/status/deactivate/:uomId', authorize(['delete:uoms', 'admin']), placeholder /* uomController.deactivateUom */);

// 6. PATCH Activate UOM
// (अनुमति: 'delete:uoms' की आवश्यकता है)
router.patch('/status/activate/:uomId', authorize(['delete:uoms', 'admin']), placeholder /* uomController.activateUom */);


module.exports = router;