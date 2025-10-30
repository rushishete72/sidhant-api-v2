/*
 * Context Note: यह Inventory Receipts (Goods Receipt) के लिए HTTP अनुरोधों को संभालता है।
 * यह PO से GR बनाना, QC स्थिति अपडेट करना और स्टॉक पोस्टिंग को हैंडल करता है।
 */
const receiptModel = require('./receipt.model'); 
const stockModel = require('../../inventory/stock/stock.model'); // Stock Posting के लिए आवश्यक
const { APIError, asyncHandler } = require('../../../utils/errorHandler'); 
const { tr, isNumeric } = require('../../../utils/validation'); 
// NOTE: आपको 'validateGoodsReceipt' फ़ंक्शन को src/utils/validation.js में जोड़ना होगा।

// --- Core Helper Functions ---

/** URL से प्राप्त ID (Receipt ID या Item ID) को मान्य (Validate) करता है। */
const handleIdValidation = (id, paramName = 'ID') => {
    const parsedId = parseInt(id, 10);
    if (isNaN(parsedId) || parsedId <= 0) {
        throw new APIError(`अमान्य (Invalid) ${paramName} URL में प्रदान किया गया है।`, 400);
    }
    return parsedId;
};

// =========================================================================
// A. RECEIPT DOCUMENT MANAGEMENT
// =========================================================================

/** 1. नया Goods Receipt बनाता है। */
const createGoodsReceipt = asyncHandler(async (req, res, next) => {
    const receiverId = req.user.user_id; 
    const receiptData = { 
        ...req.body,
        received_by_user_id: receiverId,
        receipt_date: new Date(),
        status: 'PENDING_QC' // डिफ़ॉल्ट स्थिति
    };
    
    // NOTE: यहाँ 'validateGoodsReceipt' कॉल करें
    // const validationError = validateGoodsReceipt(receiptData); // मान लें कि यह मौजूद है
    // if (validationError) {
    //     return next(new APIError(validationError, 400));
    // }

    // Model लॉजिक को Transaction में चलाएँ
    const newReceiptHeader = await receiptModel.createGoodsReceipt({
        po_id: receiptData.po_id,
        warehouse_id: receiptData.warehouse_id,
        received_by_user_id: receiverId,
        receipt_date: receiptData.receipt_date,
        status: receiptData.status
    });
    
    const receiptId = newReceiptHeader.receipt_id;
    
    // Items के लिए Foreign Key सेट करें
    const itemsToInsert = receiptData.receipt_items.map(item => ({
        ...item,
        receipt_id: receiptId,
        qc_status: 'PENDING',
        is_posted: false
    }));

    // Items को Bulk Insert करें
    await receiptModel.addReceiptItems(itemsToInsert);

    // पूरा GR विवरण लौटाएँ
    const fullReceipt = await receiptModel.getReceiptItemsByReceiptId(receiptId);
    
    return res.status(201).json({ 
        message: `Goods Receipt ID ${receiptId} सफलतापूर्वक बन गया और QC के लिए लंबित है।`, 
        data: { ...newReceiptHeader, items: fullReceipt }
    });
});

/** 2. ID द्वारा Goods Receipt प्राप्त करता है। (Header + Items) */
const getGoodsReceiptById = asyncHandler(async (req, res, next) => {
    const receiptId = handleIdValidation(req.params.receiptId, 'Receipt ID');
    
    const header = await receiptModel.getGoodsReceiptHeaderById(receiptId);
    if (!header) return next(new APIError(`Goods Receipt ID ${receiptId} नहीं मिला।`, 404)); 

    const items = await receiptModel.getReceiptItemsByReceiptId(receiptId);
    
    return res.status(200).json({ 
        data: { ...header, items: items }
    });
});

/** 3. QC के लिए लंबित सभी Receipts प्राप्त करता है। (Dashboard View) */
const getPendingQcReceipts = asyncHandler(async (req, res) => {
    const list = await receiptModel.getPendingQcReceipts(100);
    return res.status(200).json({ 
        message: 'Pending QC Receipts retrieved.',
        data: list 
    });
});


// =========================================================================
// B. QUALITY CONTROL & STOCK POSTING ACTIONS
// =========================================================================

/** 4. एक विशिष्ट Receipt Item (Line) का QC Status अद्यतन करता है। */
const updateItemQcStatus = asyncHandler(async (req, res, next) => {
    const itemId = handleIdValidation(req.params.itemId, 'Receipt Item ID');
    const { qc_status, qc_notes } = req.body; // qc_status: 'PASS' या 'FAIL'

    if (!['PASS', 'FAIL'].includes(qc_status)) {
        return next(new APIError('अमान्य QC स्थिति। केवल PASS या FAIL स्वीकार्य है।', 400));
    }
    
    const updatedItem = await receiptModel.updateItemQcStatus(itemId, qc_status.toUpperCase(), tr(qc_notes));

    if (!updatedItem) return next(new APIError(`Receipt Item ID ${itemId} नहीं मिला।`, 404)); 
    
    // यदि यह QC PASS है, तो स्टॉक में पोस्ट करने के लिए आइटम को तैयार करें।
    // यदि यह QC FAIL है, तो GR को QC_FAILED स्थिति में अपडेट करने के लिए जाँच करें।
    
    return res.status(200).json({
        message: `Receipt Item ${itemId} की QC स्थिति अपडेट हुई: ${updatedItem.qc_status}.`,
        data: updatedItem,
    });
});

/** 5. QC Pass Item को Stock On Hand (SOH) में पोस्ट करता है। */
const postItemToStock = asyncHandler(async (req, res, next) => {
    const itemId = handleIdValidation(req.params.itemId, 'Receipt Item ID');
    const { target_stock_status_id } = req.body;
    
    if (!target_stock_status_id || !isNumeric(target_stock_status_id)) {
        return next(new APIError('वैध target_stock_status_id आवश्यक है।', 400));
    }

    const itemStatus = await receiptModel.getItemQcStatus(itemId);
    
    if (!itemStatus) return next(new APIError(`Receipt Item ID ${itemId} नहीं मिला।`, 404));
    // NOTE: itemStatus में receipt_id नहीं है, इसलिए मॉडल को अपडेट करने की आवश्यकता हो सकती है।
    if (itemStatus.qc_status !== 'PASS') {
        return next(new APIError(`Item ${itemId} QC PASS नहीं है। पोस्टिंग के लिए केवल QC PASS Item स्वीकार्य हैं।`, 400));
    }
    if (itemStatus.is_posted === true) {
        return next(new APIError(`Item ${itemId} पहले ही स्टॉक में पोस्ट हो चुका है।`, 400));
    }
    
    // 1. Transaction Log बनाएँ
    // (NOTE: transactionId बनाने के लिए आवश्यक receipt_id प्राप्त करने के लिए यहां एक अतिरिक्त मॉडल कॉल की आवश्यकता हो सकती है, लेकिन सरलता के लिए जारी रखें)
    const transactionId = 1; // DUMMY VALUE. stockModel.createTransaction लागू करें। 

    // 2. Receipt Item को पोस्ट करें और SOH डेटा प्राप्त करें
    const stockData = await receiptModel.postReceiptItemToStock(
        itemId, transactionId, target_stock_status_id
    );

    if (!stockData) return next(new APIError(`Item ${itemId} पोस्ट नहीं हुआ।`, 500)); 

    // 3. Stock On Hand (SOH) को Upsert करें
    // const sohRecord = await stockModel.upsertStockOnHand(stockData); // stockModel को लागू करें
    const sohRecord = stockData; // DUMMY: model से लौटाया गया डेटा

    
    return res.status(200).json({
        message: `Receipt Item ${itemId} सफलतापूर्वक स्टॉक में पोस्ट हुआ।`,
        data: sohRecord,
    });
});


// =========================================================================
// FINAL EXPORTS
// =========================================================================

module.exports = {
    createGoodsReceipt,
    getGoodsReceiptById,
    getPendingQcReceipts,
    updateItemQcStatus,
    postItemToStock,
};