// File: src/modules/master/uoms/uom.route.js

const express = require("express");
const router = express.Router();
const { authenticate, authorize } = require("../../../middleware/auth");
const uomController = require("./uom.controller");

// =========================================================================
// Routes Definition
// =========================================================================

// इस मॉड्यूल के सभी रूट्स के लिए प्रमाणीकरण (Authentication) की आवश्यकता है।
router.use(authenticate);

// 1. GET /: Get All UOMs
// 2. POST /: Create New UOM
router
  .route("/")
  .get(authorize(["read:master", "admin"]), uomController.getAllUOMs)
  .post(authorize(["manage:master", "admin"]), uomController.createUOM);

// 3. GET /:uomId: Get UOM by ID
// 4. PUT /:uomId: Update UOM
router
  .route("/:uomId")
  .get(authorize(["read:master", "admin"]), uomController.getUOMById)
  .put(authorize(["manage:master", "admin"]), uomController.updateUOM);

module.exports = router;
