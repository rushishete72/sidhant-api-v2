/*
 * Context Note: यह 'qc_inspection_plans' टेबल के लिए डेटाबेस तर्क (logic) को संभालता है।
 * यह Part ID के आधार पर Inspection Plan को बनाता, अपडेट करता और प्राप्त करता है।
 * (पुराने /src/modules/qualityControl/inspectionPlans/qcPlan.model.js से लिया गया)
 */

// निर्भरताएँ (Dependencies)
// (पाथ फिक्स: 4 लेवल ऊपर)
const { db, pgp } = require('../../../../src/database/db'); 
const { APIError } = require('../../../utils/errorHandler'); 
const TABLE_NAME = 'qc_inspection_plans'; 

// --- Helper Functions ---

/** Plan ID द्वारा Plan और उससे जुड़े Part विवरण प्राप्त करता है। */
const getPlanDetailsById = async (planId) => {
    const query = `
        SELECT 
            qcip.*, 
            mp.part_no, mp.part_name
        FROM ${TABLE_NAME} qcip
        JOIN master_parts mp ON qcip.part_id = mp.part_id
        WHERE qcip.plan_id = $1;
    `;
    return db.oneOrNone(query, [planId]);
};

/** Plan को उसकी Part ID द्वारा प्राप्त करता है। */
const getPlanByPartId = async (partId) => {
    const query = `
        SELECT 
            qcip.*, 
            mp.part_no, mp.part_name
        FROM ${TABLE_NAME} qcip
        JOIN master_parts mp ON qcip.part_id = mp.part_id
        WHERE qcip.part_id = $1;
    `;
    return db.oneOrNone(query, [partId]);
};

// =========================================================================
// A. CORE PLAN MANAGEMENT FUNCTIONS
// =========================================================================

/** 1. Inspection Plan बनाता या अपडेट करता है (Upsert Logic)। */
const createOrUpdatePlan = async (data) => {
    const { 
        part_id, sample_size_aql, inspection_type, parameters, created_by 
    } = data;
    
    const insertData = {
        part_id: Number(part_id), 
        sample_size_aql: sample_size_aql,
        inspection_type: inspection_type, 
        // JSONB डेटा को pg-promise में भेजने के लिए 'pgp.as.json' का उपयोग करें
        parameters: pgp.as.json(parameters), 
        created_by: created_by,
        updated_by: created_by, // अपडेट/क्रिएट दोनों के लिए
        created_at: new Date(),
        updated_at: new Date()
    };
    
    // केवल वे फ़ील्ड्स जिन्हें अपडेट किया जा सकता है
    const updateColumns = ['sample_size_aql', 'inspection_type', 'parameters', 'updated_by', 'updated_at'];
    
    const cs = new pgp.helpers.ColumnSet(Object.keys(insertData), { table: TABLE_NAME });

    const insertQuery = pgp.helpers.insert(insertData, cs) 
                        + ` ON CONFLICT (part_id) DO UPDATE SET 
                            sample_size_aql = EXCLUDED.sample_size_aql, 
                            inspection_type = EXCLUDED.inspection_type, 
                            parameters = EXCLUDED.parameters, 
                            updated_by = EXCLUDED.updated_by, 
                            updated_at = EXCLUDED.updated_at 
                            RETURNING plan_id;`;

    try {
        const result = await db.one(insertQuery);
        return getPlanDetailsById(result.plan_id);
        
    } catch (error) {
        if (error.code === '23503') { // Foreign Key Violation (Invalid Part ID)
            throw new APIError('अमान्य पार्ट ID प्रदान की गई है।', 400);
        }
        console.error('Database Error in createOrUpdatePlan:', error);
        throw new APIError('Database operation failed.', 500); 
    }
};

/** 2. ID द्वारा Plan प्राप्त करता है। (Controller द्वारा उपयोग नहीं किया जाता) */
const getPlanById = async (planId) => {
    return getPlanDetailsById(planId);
};

/** 3. सभी QC Inspection Plans को फ़िल्टर, सर्च और पेजिंग के साथ प्राप्त करता है। */
const getAllQcPlans = async ({ limit, offset, search }) => {
    const params = {};
    let whereConditions = '';
    
    if (search) {
        // (Part No या Part Name द्वारा खोजें)
        whereConditions += ' AND (mp."part_no" ILIKE $<searchPattern> OR mp."part_name" ILIKE $<searchPattern>)';
        params.searchPattern = `%${search}%`;
    }

    const baseQuery = `
        FROM ${TABLE_NAME} qcip
        JOIN master_parts mp ON qcip.part_id = mp.part_id
        WHERE 1=1 ${whereConditions}
    `;
    
    const countQuery = `SELECT COUNT(*) FROM ${TABLE_NAME} qcip JOIN master_parts mp ON qcip.part_id = mp.part_id WHERE 1=1 ${whereConditions}`;
    
    const dataQuery = `
        SELECT 
            qcip.plan_id, qcip.part_id, qcip.inspection_type, qcip.sample_size_aql, qcip.created_at, 
            mp.part_no, mp.part_name
        ${baseQuery}
        ORDER BY qcip.created_at DESC
        LIMIT $<limit> OFFSET $<offset>
    `;

    params.limit = limit;
    params.offset = offset;

    const [dataResult, countResult] = await db.tx(t => {
        return Promise.all([
            t.any(dataQuery, params),
            t.one(countQuery, params)
        ]);
    });

    return {
        data: dataResult,
        total_count: parseInt(countResult.count, 10),
    };
};

/** 4. Plan Parameters की एक सरल सूची प्राप्त करता है। */
const getPlanParametersByPartId = async (partId) => {
    const query = 'SELECT parameters FROM ${TABLE_NAME} WHERE part_id = $1';
    const result = await db.oneOrNone(query, [partId]);
    
    if (!result) return [];
    
    // JSONB पैरामीटर्स ऐरे को वापस लौटाएँ
    return result.parameters || [];
};


// =========================================================================
// FINAL EXPORTS
// =========================================================================

module.exports = {
    createOrUpdatePlan,
    getPlanByPartId,
    getAllQcPlans,
    getPlanParametersByPartId,
};