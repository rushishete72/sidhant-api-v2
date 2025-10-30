/*
 * Context Note: यह 'master_stock_types' और 'master_stock_statuses' टेबल के लिए API routes को परिभाषित करता है।
 * Authentication (JWT) और Authorization ('manage:stock_masters') की आवश्यकता है।
 * (पुराने /src/modules/inventory/masterData/inventoryMaster.route.js से लिया गया)
 */
const express = require('express');
const router = express.Router();
// मिडलवेयर इम्पोर्ट करें
const { authenticate, authorize } = require('../../../middleware/auth');

// कंट्रोलर फ़ंक्शंस (अभी के लिए प्लेसहोल्डर्स)
const placeholder = (req, res) => res.status(501).json({ 
    message: "Endpoint Not Implemented", 
    path: req.path,
    id: req.params.id || null
});

// const inventoryMasterController = require('./inventoryMaster.controller');

// =========================================================================
// Routes Definition
// =========================================================================

// इस मॉड्यूल के सभी रूट्स के लिए प्रमाणीकरण (Authentication) की आवश्यकता है।
router.use(authenticate);

// ---------------------------------------------
// A. Stock Types (master_stock_types)
// ---------------------------------------------

// 1. GET All Stock Types
router.get('/types', authorize(['read:stock_masters', 'admin']), placeholder /* inventoryMasterController.getAllStockTypes */); 

// 2. POST Create New Stock Type
router.post('/types', authorize(['manage:stock_masters', 'admin']), placeholder /* inventoryMasterController.createStockType */);

// 3. PUT Update Stock Type
router.put('/types/:typeId', authorize(['manage:stock_masters', 'admin']), placeholder /* inventoryMasterController.updateStockType */);


// ---------------------------------------------
// B. Stock Statuses (master_stock_statuses)
// ---------------------------------------------

// 4. GET All Stock Statuses
router.get('/statuses', authorize(['read:stock_masters', 'admin']), placeholder /* inventoryMasterController.getAllStockStatuses */); 

// 5. POST Create New Stock Status
router.post('/statuses', authorize(['manage:stock_masters', 'admin']), placeholder /* inventoryMasterController.createStockStatus */);

// 6. PUT Update Stock Status
router.put('/statuses/:statusId', authorize(['manage:stock_masters', 'admin']), placeholder /* inventoryMasterController.updateStockStatus */);


module.exports = router;