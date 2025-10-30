/*
 * Context Note: यह 'master_clients' टेबल के लिए API routes को परिभाषित करता है।
 * यह 'authenticate' मिडलवेयर द्वारा सुरक्षित है।
 */
const express = require('express');
const router = express.Router();
// मिडलवेयर इम्पोर्ट करें
const { authenticate, authorize } = require('../../../middleware/auth');

// कंट्रोलर फ़ंक्शंस (अभी के लिए प्लेसहोल्डर्स)
const placeholder = (req, res) => res.status(501).json({ 
    message: "Endpoint Not Implemented", 
    path: req.path,
    id: req.params.clientId || null
});

// const clientController = require('./client.controller');

// =========================================================================
// Routes Definition
// =========================================================================

// इस मॉड्यूल के सभी रूट्स के लिए प्रमाणीकरण (Authentication) की आवश्यकता है।
router.use(authenticate);

// 1. GET All Clients (Paginated, Searchable)
// (अनुमति: 'read:clients' की आवश्यकता है)
router.get('/', authorize(['read:clients', 'admin']), placeholder /* clientController.getAllClients */); 

// 2. POST Create New Client
// (अनुमति: 'create:clients' की आवश्यकता है)
router.post('/', authorize(['create:clients', 'admin']), placeholder /* clientController.createClient */);

// 3. GET Client by ID
// (अनुमति: 'read:clients' की आवश्यकता है)
router.get('/:clientId', authorize(['read:clients', 'admin']), placeholder /* clientController.getClientById */);

// 4. PUT Update Client
// (अनुमति: 'update:clients' की आवश्यकता है)
router.put('/:clientId', authorize(['update:clients', 'admin']), placeholder /* clientController.updateClient */);

// 5. PATCH Deactivate Client
// (अनुमति: 'delete:clients' की आवश्यकता है)
router.patch('/status/deactivate/:clientId', authorize(['delete:clients', 'admin']), placeholder /* clientController.deactivateClient */);

// 6. PATCH Activate Client
// (अनुमति: 'delete:clients' की आवश्यकता है)
router.patch('/status/activate/:clientId', authorize(['delete:clients', 'admin']), placeholder /* clientController.activateClient */);


module.exports = router;