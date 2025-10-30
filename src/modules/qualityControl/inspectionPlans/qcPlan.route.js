/*
 * Context Note: यह 'qc_inspection_plans' टेबल के लिए API routes को परिभाषित करता है।
 * इसका उपयोग Part ID के आधार पर Inspection Plan बनाने, पढ़ने और अपडेट करने के लिए किया जाता है।
 * Authentication (JWT) और Authorization ('manage:qc_plans') की आवश्यकता है।
 * (पुराने /src/modules/qualityControl/inspectionPlans/qcPlan.route.js से लिया गया)
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

// const qcPlanController = require('./qcPlan.controller');

// =========================================================================
// Routes Definition
// =========================================================================

// इस मॉड्यूल के सभी रूट्स के लिए प्रमाणीकरण (Authentication) की आवश्यकता है।
router.use(authenticate);

// 1. GET Inspection Plan by Part ID
// (अनुमति: 'read:qc_plans' की आवश्यकता है)
router.get('/:partId', authorize(['read:qc_plans', 'qc_inspector', 'admin']), placeholder /* qcPlanController.getPlanByPartId */); 

// 2. POST/PUT Create or Update Inspection Plan for a Part
// (अनुमति: 'manage:qc_plans' की आवश्यकता है)
// NOTE: यदि Plan पहले से मौजूद है, तो यह अपडेट होगा (Upsert-like behavior)
router.post('/', authorize(['manage:qc_plans', 'qc_manager', 'admin']), placeholder /* qcPlanController.createOrUpdatePlan */);

// 3. GET All QC Inspection Plans (Paginated, Searchable)
// (अनुमति: 'read:qc_plans' की आवश्यकता है)
router.get('/', authorize(['read:qc_plans', 'qc_inspector', 'admin']), placeholder /* qcPlanController.getAllQcPlans */); 

// 4. GET Plan Parameters (Parameters की एक सरल सूची)
// (अनुमति: 'read:qc_plans' की आवश्यकता है)
router.get('/parameters/list/:partId', authorize(['read:qc_plans', 'qc_inspector', 'admin']), placeholder /* qcPlanController.getPlanParametersByPartId */);


module.exports = router;