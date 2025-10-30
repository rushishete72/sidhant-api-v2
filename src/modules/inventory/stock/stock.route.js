/*
 * Context Note: यह 'inventory_stock' (Current Stock Levels) और 'inventory_movements' के लिए API routes को परिभाषित करता है।
 * Authentication (JWT) और Authorization ('read:stock', 'manage:stock') की आवश्यकता है।
 * (पुराने /src/modules/inventory/stock/stock.route.js से लिया गया)
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

// const stockController = require('./stock.controller');

// =========================================================================
// Routes Definition
// =========================================================================

// इस मॉड्यूल के सभी रूट्स के लिए प्रमाणीकरण (Authentication) की आवश्यकता है।
router.use(authenticate);

// 1. GET Current Stock Levels (Paginated, Searchable, by Part/Location)
// (अनुमति: 'read:stock' की आवश्यकता है)
router.get('/', authorize(['read:stock', 'inventory_user', 'admin']), placeholder /* stockController.getCurrentStock */); 

// 2. GET Stock Details by Part ID (Locations, Statuses द्वारा ब्रेकडाउन)
// (अनुमति: 'read:stock' की आवश्यकता है)
router.get('/part/:partId', authorize(['read:stock', 'inventory_user', 'admin']), placeholder /* stockController.getStockByPartId */);

// 3. GET Stock History/Movements for a Part (Audit Trail)
// (अनुमति: 'read:stock_movements' की आवश्यकता है)
router.get('/history/:partId', authorize(['read:stock_movements', 'admin']), placeholder /* stockController.getStockHistory */);

// 4. POST Create Manual Stock Adjustment (Consumption/Correction)
// (अनुमति: 'manage:stock' की आवश्यकता है)
// NOTE: यह Lot/Location/Status में बदलाव करता है
router.post('/adjust', authorize(['manage:stock', 'inventory_manager', 'admin']), placeholder /* stockController.createStockAdjustment */);

// 5. GET Stock by Location (Warehouse/Shelf view)
// (अनुमति: 'read:stock' की आवश्यकता है)
router.get('/location/:locationId', authorize(['read:stock', 'inventory_user', 'admin']), placeholder /* stockController.getStockByLocation */);


module.exports = router;