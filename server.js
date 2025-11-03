/*
 * Context Note: यह मुख्य एक्सप्रेस सर्वर फ़ाइल है।
 * (UPGRADED: अब 'Procurement Purchase Orders' मॉड्यूल के routes शामिल हैं)
 */

// 1. .env वेरिएबल्स को तुरंत लोड करें
const path = require("path");
const dotenvResult = require("dotenv").config({
  path: path.resolve(__dirname, ".env"),
});

if (dotenvResult.error) {
  console.error("[dotenv] Error loading .env file:", dotenvResult.error);
} else {
  console.log(
    `[dotenv] .env file loaded. ${
      Object.keys(dotenvResult.parsed || {}).length
    } variables injected.`
  );
}

// ---------------------------------------------
// बाकी इम्पोर्ट्स
// ---------------------------------------------
const express = require("express");
const cors = require("cors");

const { errorHandler, notFound } = require("./src/utils/errorHandler");
const userAuthRoutes = require("./src/modules/auth/userAuth/userAuth.route");
const supplierRoutes = require("./src/modules/master/supplier/supplier.route");
const clientRoutes = require("./src/modules/master/client/client.route");
const partRoutes = require("./src/modules/master/parts/part.route");
const uomRoutes = require("./src/modules/master/uoms/uom.route");
const userRoutes = require("./src/modules/master/users/user.route");
const roleRoutes = require("./src/modules/master/roles/role.route");
const qcLotRoutes = require("./src/modules/qualityControl/lots/qcLot.route");
const qcPlanRoutes = require("./src/modules/qualityControl/inspectionPlans/qcPlan.route");
const qcResultRoutes = require("./src/modules/qualityControl/inspectionResults/qcResult.route");
const stockRoutes = require("./src/modules/inventory/stock/stock.route");
const locationRoutes = require("./src/modules/inventory/locations/location.route");
const inventoryMasterRoutes = require("./src/modules/inventory/masterData/inventoryMaster.route");
// ✅ नया इम्पोर्ट
const purchaseOrderRoutes = require("./src/modules/procurement/purchasing/purchaseOrder.route");

const app = express();
const PORT = process.env.PORT || 4000;

// मिडलवेयर
app.use(cors());
app.use(express.json());

// रूट
app.get("/", (req, res) => {
  res.status(200).json({ message: "Sidhant API v2 - Active" });
});

// -------------------------------------------------------------------------
// API मॉड्यूलर रूट्स
// -------------------------------------------------------------------------

// Auth मॉड्यूल रूट्स
app.use("/api/v2/auth", userAuthRoutes);

// Master Data
app.use("/api/v2/master/suppliers", supplierRoutes);
app.use("/api/v2/master/clients", clientRoutes);
app.use("/api/v2/master/parts", partRoutes);
app.use("/api/v2/master/uoms", uomRoutes);
app.use("/api/v2/master/users", userRoutes);
app.use("/api/v2/master/roles", roleRoutes);

// Quality Control
app.use("/api/v2/qualityControl/lots", qcLotRoutes);
app.use("/api/v2/qualityControl/plans", qcPlanRoutes);
app.use("/api/v2/qualityControl/results", qcResultRoutes);

// Inventory
app.use("/api/v2/inventory/stock", stockRoutes);
app.use("/api/v2/inventory/locations", locationRoutes);
app.use("/api/v2/inventory/masters", inventoryMasterRoutes);

// ✅ Procurement
app.use("/api/v2/procurement/purchaseOrders", purchaseOrderRoutes);

// -------------------------------------------------------------------------
// एरर हैंडलिंग (हमेशा सभी रूट्स के बाद)
// -------------------------------------------------------------------------

// 1. 404 Not Found हैंडलर
app.use(notFound);

// 2. ग्लोबल एरर हैंडलर
app.use(errorHandler);
// -------------------------------------------------------------------------
// सर्वर शुरू करें (FINAL FIX: सर्वर ऑब्जेक्ट को कैप्चर करें और Timeout सेट करें)
// -------------------------------------------------------------------------

const server = app.listen(PORT, () => {
  // ✅ FIX 1: 'server' वेरिएबल में असाइन करें
  console.log(`[Server] Server is running on port ${PORT}`);
});

// ✅ FIX 2: ECONNRESET त्रुटियों को रोकने के लिए Keep-Alive Timeout बढ़ाएँ
server.keepAliveTimeout = 65000; // 65 सेकंड (मिलिसेकंड में)
server.headersTimeout = 66000; // KeepAliveTimeout से थोड़ा अधिक सेट करें।
