/*
 * Context Note: यह 'users' टेबल के लिए API routes को परिभाषित करता है।
 * इसका उपयोग केवल Admin/Managers द्वारा उपयोगकर्ता डेटा को बनाने/अपडेट करने के लिए किया जाता है।
 * Authentication (JWT) और Authorization (manage:users) की आवश्यकता है।
 */
const express = require('express');
const router = express.Router();
// मिडलवेयर इम्पोर्ट करें
const { authenticate, authorize } = require('../../../middleware/auth');

// कंट्रोलर फ़ंक्शंस (अभी के लिए प्लेसहोल्डर्स)
const placeholder = (req, res) => res.status(501).json({ 
    message: "Endpoint Not Implemented", 
    path: req.path,
    id: req.params.userId || null
});

// const userController = require('./user.controller');

// =========================================================================
// Routes Definition
// =========================================================================

// इस मॉड्यूल के सभी रूट्स के लिए प्रमाणीकरण (Authentication) की आवश्यकता है।
router.use(authenticate);

// 1. GET All Users (Paginated, Searchable)
// (अनुमति: 'read:users' या 'manage:users' की आवश्यकता है)
router.get('/', authorize(['read:users', 'manage:users', 'admin']), placeholder /* userController.getAllUsers */); 

// 2. POST Create New User (Admin द्वारा मैन्युअल रूप से बनाया गया)
// (अनुमति: 'manage:users' की आवश्यकता है)
router.post('/', authorize(['manage:users', 'admin']), placeholder /* userController.createUser */);

// 3. GET User by ID (Detailed View)
// (अनुमति: 'read:users' या 'manage:users' की आवश्यकता है)
router.get('/:userId', authorize(['read:users', 'manage:users', 'admin']), placeholder /* userController.getUserById */);

// 4. PUT Update User Details (Name, Email, etc.)
// (अनुमति: 'manage:users' की आवश्यकता है)
router.put('/:userId', authorize(['manage:users', 'admin']), placeholder /* userController.updateUser */);

// 5. PATCH Change User Role
// (अनुमति: 'manage:users' की आवश्यकता है)
router.patch('/role/:userId', authorize(['manage:users', 'admin']), placeholder /* userController.changeUserRole */);

// 6. PATCH Reset User Password (Admin द्वारा)
// (अनुमति: 'manage:users' की आवश्यकता है)
router.patch('/password/reset/:userId', authorize(['manage:users', 'admin']), placeholder /* userController.resetUserPassword */);

// 7. PATCH Deactivate User
// (अनुमति: 'manage:users' की आवश्यकता है)
router.patch('/status/deactivate/:userId', authorize(['manage:users', 'admin']), placeholder /* userController.deactivateUser */);

// 8. PATCH Activate User
// (अनुमति: 'manage:users' की आवश्यकता है)
router.patch('/status/activate/:userId', authorize(['manage:users', 'admin']), placeholder /* userController.activateUser */);


module.exports = router;