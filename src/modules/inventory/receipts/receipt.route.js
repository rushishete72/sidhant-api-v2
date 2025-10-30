/*
 * Context Note: यह Inventory Receipts के लिए API routes को परिभाषित करता है।
 * Authentication (JWT) और Authorization ('manage:inventory') की आवश्यकता है।
 */
const express = require('express');
const router = express.Router();
// मिडलवेयर इम्पोर्ट करें
const { authenticate, authorize } = require('../../../middleware/auth');
const receiptController = require('./receipt.controller');

// इस मॉड्यूल के सभी रूट्स के लिए प्रमाणीकरण (Authentication) की आवश्यकता है।
router.use(authenticate);

// =========================================================================
// A. RECEIPT DOCUMENT MANAGEMENT (READ/WRITE)
// =========================================================================

// 1. POST Create New Goods Receipt (Header + Items) - PO से
// अनुमति: 'create:goods_receipt' की आवश्यकता है
router.post(
    '/', 
    authorize(['create:goods_receipt', 'inventory_user', 'admin']), 
    receiptController.createGoodsReceipt
); 

// 2. GET Goods Receipt by ID (Detailed View)
// अनुमति: 'read:goods_receipt' की आवश्यकता है
router.get(
    '/:receiptId', 
    authorize(['read:goods_receipt', 'inventory_user', 'admin']), 
    receiptController.getGoodsReceiptById
);

// 3. GET Pending QC Receipts List (QC Dashboard)
// अनुमति: 'read:quality_control' की आवश्यकता है
router.get(
    '/status/pending-qc', 
    authorize(['read:quality_control', 'qc_user', 'admin']), 
    receiptController.getPendingQcReceipts
);


// =========================================================================
// B. QC & STOCK POSTING ACTIONS (UPDATE/PATCH)
// =========================================================================

// 4. PATCH Update Receipt Item QC Status ('PASS'/'FAIL')
// अनुमति: 'process:qc_receipt' की आवश्यकता है
router.patch(
    '/items/qc-status/:itemId', 
    authorize(['process:qc_receipt', 'qc_user', 'admin']), 
    receiptController.updateItemQcStatus
);

// 5. PATCH Post QC Passed Item to Stock
// अनुमति: 'post:goods_receipt_stock' की आवश्यकता है
router.patch(
    '/items/post-stock/:itemId', 
    authorize(['post:goods_receipt_stock', 'inventory_manager', 'admin']), 
    receiptController.postItemToStock
);

module.exports = router;