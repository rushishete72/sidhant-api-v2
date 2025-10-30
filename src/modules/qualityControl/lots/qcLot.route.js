/*
 * Context Note: यह 'quality_control_lots' टेबल के लिए API routes को परिभाषित करता है।
 * यह Lot Creation, Status Change, और Inspection flow का प्रवेश द्वार है।
 * Authentication (JWT) और Authorization ('manage:qc_lots') की आवश्यकता है।
 * (पुराने /src/modules/qualityControl/lots/qcLot.route.js से लिया गया)
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

// const qcLotController = require('./qcLot.controller');

// =========================================================================
// Routes Definition
// =========================================================================

// इस मॉड्यूल के सभी रूट्स के लिए प्रमाणीकरण (Authentication) की आवश्यकता है।
router.use(authenticate);

// 1. GET All QC Lots (Paginated, Searchable)
// (अनुमति: 'read:qc_lots' की आवश्यकता है)
router.get('/', authorize(['read:qc_lots', 'qc_inspector', 'admin']), placeholder /* qcLotController.getAllQcLots */); 

// 2. POST Create New QC Lot (Material Receipt या Production Output से बनाया गया)
// (अनुमति: 'create:qc_lots' की आवश्यकता है)
router.post('/', authorize(['create:qc_lots', 'qc_inspector', 'admin']), placeholder /* qcLotController.createQcLot */);

// 3. GET QC Lot by ID (Detailed View)
// (अनुमति: 'read:qc_lots' की आवश्यकता है)
router.get('/:lotId', authorize(['read:qc_lots', 'qc_inspector', 'admin']), placeholder /* qcLotController.getQcLotById */);

// 4. PUT Update QC Lot (Minor Details)
// (अनुमति: 'update:qc_lots' की आवश्यकता है)
router.put('/:lotId', authorize(['update:qc_lots', 'admin']), placeholder /* qcLotController.updateQcLot */);

// 5. PATCH Close/Finalize QC Lot (Final Status: Approved/Rejected)
// (अनुमति: 'finalize:qc_lots' की आवश्यकता है)
router.patch('/status/close/:lotId', authorize(['finalize:qc_lots', 'qc_manager', 'admin']), placeholder /* qcLotController.closeQcLot */);

// 6. GET Pending Lot Count (डैशबोर्ड के लिए)
// (अनुमति: 'read:qc_lots' की आवश्यकता है)
router.get('/pending/count', authorize(['read:qc_lots', 'qc_inspector', 'admin']), placeholder /* qcLotController.getPendingLotCount */);


module.exports = router;