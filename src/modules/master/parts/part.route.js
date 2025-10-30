/*
 * Context Note: यह 'master_parts' टेबल के लिए API routes को परिभाषित करता है।
 * यह 'authenticate' मिडलवेयर द्वारा सुरक्षित है।
 * (पुराने /src/modules/master/parts/part.route.js से लिया गया)
 */
const express = require('express');
const router = express.Router();
// मिडलवेयर इम्पोर्ट करें
const { authenticate, authorize } = require('../../../middleware/auth');

// कंट्रोलर फ़ंक्शंस (अभी के लिए प्लेसहोल्डर्स)
const placeholder = (req, res) => res.status(501).json({ 
    message: "Endpoint Not Implemented", 
    path: req.path,
    id: req.params.partId || null
});

// const partController = require('./part.controller');

// =========================================================================
// Routes Definition
// =========================================================================

// इस मॉड्यूल के सभी रूट्स के लिए प्रमाणीकरण (Authentication) की आवश्यकता है।
router.use(authenticate);

// 1. GET All Parts (Paginated, Searchable)
// (अनुमति: 'read:parts' की आवश्यकता है)
router.get('/', authorize(['read:parts', 'admin']), placeholder /* partController.getAllParts */); 

// 2. POST Create New Part
// (अनुमति: 'create:parts' की आवश्यकता है)
router.post('/', authorize(['create:parts', 'admin']), placeholder /* partController.createPart */);

// 3. GET Part by ID
// (अनुमति: 'read:parts' की आवश्यकता है)
router.get('/:partId', authorize(['read:parts', 'admin']), placeholder /* partController.getPartById */);

// 4. PUT Update Part
// (अनुमति: 'update:parts' की आवश्यकता है)
router.put('/:partId', authorize(['update:parts', 'admin']), placeholder /* partController.updatePart */);

// 5. PATCH Deactivate Part
// (अनुमति: 'delete:parts' की आवश्यकता है)
router.patch('/status/deactivate/:partId', authorize(['delete:parts', 'admin']), placeholder /* partController.deactivatePart */);

// 6. PATCH Activate Part
// (अनुमति: 'delete:parts' की आवश्यकता है)
router.patch('/status/activate/:partId', authorize(['delete:parts', 'admin']), placeholder /* partController.activatePart */);

// (पुराने कोड से अन्य एडवांस्ड रूट्स (routes) यहाँ जोड़े जा सकते हैं,
// जैसे /link-supplier, /link-client, /qc-parameters, आदि)

module.exports = router;