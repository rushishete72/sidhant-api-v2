/*
 * Context Note: यह 'qc_inspection_results' टेबल के लिए API routes को परिभाषित करता है।
 * इसका उपयोग Lot ID के लिए Inspection Result बनाने, पढ़ने और अपडेट करने के लिए किया जाता है।
 * Authentication (JWT) और Authorization ('manage:qc_results') की आवश्यकता है।
 * (पुराने /src/modules/qualityControl/inspectionResults/qcResult.route.js से लिया गया)
 */
const express = require('express');
const router = express.Router();
// मिडलवेयर इम्पोर्ट करें
const { authenticate, authorize } = require('../../../middleware/auth');

// कंट्रोलर फ़ंक्शंस (अभी के लिए प्लेसहोल्डर्स)
const placeholder = (req, res) => res.status(501).json({ 
    message: "Endpoint Not Implemented", 
    path: req.path,
    id: req.params.lotId || null
});

// const qcResultController = require('./qcResult.controller');

// =========================================================================
// Routes Definition
// =========================================================================

// इस मॉड्यूल के सभी रूट्स के लिए प्रमाणीकरण (Authentication) की आवश्यकता है।
router.use(authenticate);

// 1. GET Inspection Results by Lot ID
// (अनुमति: 'read:qc_results' की आवश्यकता है)
router.get('/:lotId', authorize(['read:qc_results', 'qc_inspector', 'admin']), placeholder /* qcResultController.getResultsByLotId */); 

// 2. POST Save/Create Initial Inspection Results for a Lot
// (अनुमति: 'create:qc_results' की आवश्यकता है)
// NOTE: यह Lot की स्थिति (status) को 'IN_INSPECTION' में बदलता है।
router.post('/', authorize(['create:qc_results', 'qc_inspector', 'admin']), placeholder /* qcResultController.saveInspectionResults */);

// 3. PUT Update/Save Progress on Inspection Results for a Lot
// (अनुमति: 'update:qc_results' की आवश्यकता है)
router.put('/:lotId', authorize(['update:qc_results', 'qc_inspector', 'admin']), placeholder /* qcResultController.updateInspectionResults */);

// 4. GET AQL Table lookup (UI Helper) - Plan ID के लिए
// (अनुमति: 'read:qc_plans' की आवश्यकता है)
router.get('/aql-lookup/:planId', authorize(['read:qc_plans', 'qc_inspector', 'admin']), placeholder /* qcResultController.getAqlTableLookup */);


module.exports = router;