/*
 * Context Note: यह 'qc_inspection_results' टेबल के लिए डेटाबेस तर्क (logic) को संभालता है।
 * यह Lot ID के लिए Inspection Result को बनाता, अपडेट करता और प्राप्त करता है।
 * (पुराने /src/modules/qualityControl/inspectionResults/qcResult.model.js से लिया गया)
 */

// निर्भरताएँ (Dependencies)
// (पाथ फिक्स: 4 लेवल ऊपर)
const { db, pgp } = require('../../../../src/database/db'); 
const { APIError } = require('../../../utils/errorHandler'); 
const RESULTS_TABLE = 'qc_inspection_results'; 
const LOTS_TABLE = 'quality_control_lots';

// --- Helper Functions ---

/** Lot ID द्वारा Results और Lot विवरण प्राप्त करता है। */
const getResultsDetailsByLotId = async (lotId) => {
    const query = `
        SELECT 
            qcir.*, 
            qcl.lot_number, qcl.lot_quantity, qcl.status AS lot_status,
            mp.part_no, mp.part_name
        FROM ${RESULTS_TABLE} qcir
        JOIN ${LOTS_TABLE} qcl ON qcir.lot_id = qcl.lot_id
        JOIN master_parts mp ON qcl.part_id = mp.part_id
        WHERE qcir.lot_id = $1;
    `;
    return db.oneOrNone(query, [lotId]);
};

// =========================================================================
// A. CORE RESULT MANAGEMENT FUNCTIONS
// =========================================================================

/** 1. Initial Inspection Results सेव/क्रिएट करता है। */
const saveInspectionResults = async (data) => {
    const { lot_id, inspected_quantity, results, inspected_by } = data;

    // 1. ट्रांजैक्शन (Transaction) शुरू करें
    return db.tx(async t => {
        // 2. Lot की वर्तमान स्थिति (Status) की जाँच करें
        const lot = await t.oneOrNone('SELECT status FROM $1^ WHERE lot_id = $2', [LOTS_TABLE, lot_id]);
        
        if (!lot) { throw new APIError(`QC Lot ID ${lot_id} नहीं मिला।`, 404); }
        if (lot.status !== 'PENDING') { 
            throw new APIError(`Lot ID ${lot_id} को केवल 'PENDING' स्थिति में ही शुरू किया जा सकता है (वर्तमान स्थिति: ${lot.status})।`, 400); 
        }

        // 3. Lot Status को 'IN_INSPECTION' में अपडेट करें
        await t.none('UPDATE $1^ SET status = \'IN_INSPECTION\', updated_at = NOW() WHERE lot_id = $2', [LOTS_TABLE, lot_id]);

        // 4. Inspection Results INSERT करें
        const insertData = {
            lot_id: Number(lot_id),
            inspected_quantity: Number(inspected_quantity),
            // JSONB डेटा को pg-promise में भेजने के लिए 'pgp.as.json' का उपयोग करें
            results: pgp.as.json(results), 
            inspected_by: inspected_by,
            created_at: new Date(),
            updated_at: new Date()
        };
        
        const cs = new pgp.helpers.ColumnSet(Object.keys(insertData), { table: RESULTS_TABLE });
        const insertQuery = pgp.helpers.insert(insertData, cs) 
                            + ` RETURNING result_id;`;

        const result = await t.one(insertQuery);
        
        // 5. पूरा Result विवरण लौटाएँ
        return getResultsDetailsByLotId(lot_id);
    });
};

/** 2. Inspection Results को अपडेट करता है। */
const updateInspectionResults = async (lotId, data) => {
    const { inspected_quantity, results, updated_by } = data;
    
    // 1. Lot की वर्तमान स्थिति (Status) की जाँच करें
    const lot = await db.oneOrNone('SELECT status FROM $1^ WHERE lot_id = $2', [LOTS_TABLE, lotId]);
    
    if (!lot) { return null; } // Lot नहीं मिला

    if (lot.status !== 'IN_INSPECTION') {
         throw new APIError(`Lot ID ${lotId} को केवल 'IN_INSPECTION' स्थिति में ही अपडेट किया जा सकता है (वर्तमान स्थिति: ${lot.status})।`, 400);
    }

    // 2. अपडेट डेटा तैयार करें
    const updateData = {
        inspected_quantity: Number(inspected_quantity),
        results: pgp.as.json(results), 
        updated_by: updated_by,
        updated_at: new Date()
    };
    
    // 3. Results UPDATE करें
    const updateQuery = pgp.helpers.update(updateData, ['inspected_quantity', 'results', 'updated_by', 'updated_at'], RESULTS_TABLE) 
                        + ` WHERE lot_id = ${lotId} RETURNING result_id;`;

    try {
        const result = await db.oneOrNone(updateQuery);
        if (!result) { return null; } // Lot ID के लिए कोई Result नहीं मिला

        return getResultsDetailsByLotId(lotId);

    } catch (error) {
        console.error('DB Error in updateInspectionResults:', error);
        throw new APIError('Database update failed.', 500);
    }
};

/** 3. Lot ID द्वारा Inspection Results प्राप्त करता है। */
const getResultsByLotId = async (lotId) => {
    return getResultsDetailsByLotId(lotId);
};

/** 4. AQL Table lookup (UI Helper) प्राप्त करता है। */
const getAqlTableLookup = async (planId) => {
    // NOTE: AQL टेबल लॉजिक यहां लागू होता है। सरलता के लिए, हम एक मॉक डेटा लौटाएँगे
    const mockAQLData = {
        plan_id: planId,
        table_version: 'MIL-STD-105E Equivalent',
        lookup_data: [
            { size_range: '2-8', sample_size: 2, accept: 0, reject: 1 },
            { size_range: '9-15', sample_size: 3, accept: 0, reject: 1 },
            { size_range: '16-25', sample_size: 5, accept: 0, reject: 1 },
            { size_range: '26-50', sample_size: 8, accept: 1, reject: 2 },
            // ... और भी बहुत कुछ
        ]
    };
    return mockAQLData;
};


// =========================================================================
// FINAL EXPORTS
// =========================================================================

module.exports = {
    saveInspectionResults,
    updateInspectionResults,
    getResultsByLotId,
    getAqlTableLookup,
};