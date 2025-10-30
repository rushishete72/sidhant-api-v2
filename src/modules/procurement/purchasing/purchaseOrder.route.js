/*
 * Context Note: यह 'procurement_purchase_orders' टेबल के लिए API routes को परिभाषित करता है।
 * यह PO Creation, Status Change, और Line Item management को हैंडल करता है।
 * Authentication (JWT) और Authorization ('manage:purchasing') की आवश्यकता है।
 * (पुराने /src/modules/procurement/purchasing/purchaseOrder.route.js से लिया गया)
 */
const express = require('express');
const router = express.Router();
// मिडलवेयर इम्पोर्ट करें
const { authenticate, authorize } = require('../../../middleware/auth');

// कंट्रोलर फ़ंक्शंस (अभी के लिए प्लेसहोल्डर्स)
const placeholder = (req, res) => res.status(501).json({ 
    message: "Endpoint Not Implemented", 
    path: req.path,
    id: req.params.poId || null
});

// const poController = require('./purchaseOrder.controller');

// =========================================================================
// Routes Definition
// =========================================================================

// इस मॉड्यूल के सभी रूट्स के लिए प्रमाणीकरण (Authentication) की आवश्यकता है।
router.use(authenticate);

// 1. GET All Purchase Orders (Paginated, Searchable)
// (अनुमति: 'read:purchasing' की आवश्यकता है)
router.get('/', authorize(['read:purchasing', 'procurement_user', 'admin']), placeholder /* poController.getAllPurchaseOrders */); 

// 2. POST Create New Purchase Order (Header + Line Items)
// (अनुमति: 'create:purchasing' की आवश्यकता है)
router.post('/', authorize(['create:purchasing', 'procurement_user', 'admin']), placeholder /* poController.createPurchaseOrder */);

// 3. GET Purchase Order by ID (Detailed View)
// (अनुमति: 'read:purchasing' की आवश्यकता है)
router.get('/:poId', authorize(['read:purchasing', 'procurement_user', 'admin']), placeholder /* poController.getPurchaseOrderById */);

// 4. PUT Update Purchase Order (Header/Line Items, केवल PENDING स्थिति में)
// (अनुमति: 'update:purchasing' की आवश्यकता है)
router.put('/:poId', authorize(['update:purchasing', 'procurement_user', 'admin']), placeholder /* poController.updatePurchaseOrder */);

// 5. PATCH Approve/Authorize Purchase Order
// (अनुमति: 'authorize:purchasing' की आवश्यकता है)
router.patch('/status/authorize/:poId', authorize(['authorize:purchasing', 'procurement_manager', 'admin']), placeholder /* poController.authorizePurchaseOrder */);

// 6. PATCH Cancel Purchase Order
// (अनुमति: 'cancel:purchasing' की आवश्यकता है)
router.patch('/status/cancel/:poId', authorize(['cancel:purchasing', 'procurement_manager', 'admin']), placeholder /* poController.cancelPurchaseOrder */);

// 7. GET Purchase Order Items/Lines for a specific PO
// (अनुमति: 'read:purchasing' की आवश्यकता है)
router.get('/items/:poId', authorize(['read:purchasing', 'procurement_user', 'admin']), placeholder /* poController.getPoItemsByPoId */);


module.exports = router;