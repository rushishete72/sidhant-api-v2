/*
 * Context Note: यह केंद्रीय (central) डेटाबेस कनेक्शन फ़ाइल है।
 * (UPGRADED: 'undefined' जाँच को जोड़ा गया ताकि 'includes' त्रुटि न आए)
 */

const pgp = require('pg-promise')({
    query(e) {
        // console.log('QUERY:', e.query);
    }
});

// .env से कनेक्शन स्ट्रिंग लोड करें
const DATABASE_URL = process.env.DATABASE_URL;
const NODE_ENV = process.env.NODE_ENV || 'development';

if (!DATABASE_URL) {
    console.error('---------------------------------');
    console.error('CRITICAL ERROR: DATABASE_URL is not set in .env file.');
    console.error('Please set it, e.g: postgres://USER:PASSWORD@HOST:PORT/DATABASE');
    console.error('---------------------------------');
}

// -------------------------------------------------------------------------
// SSL कॉन्फ़िगरेशन (Render.com/Heroku के लिए)
// -------------------------------------------------------------------------
let connectionOptions;

// ✅ फिक्स: जाँच करें कि DATABASE_URL मौजूद है *before* .includes() का उपयोग करने से पहले
const isProduction = (NODE_ENV === 'production');
const isRenderDb = (DATABASE_URL && DATABASE_URL.includes('render.com')); // यहाँ जाँच करें

if (isProduction || isRenderDb) {
    // प्रोडक्शन (Production) या Render.com के लिए SSL/TLS की आवश्यकता है
    connectionOptions = {
        connectionString: DATABASE_URL,
        ssl: {
            rejectUnauthorized: false
        }
    };
    console.log('[DB] Production/Render.com SSL (rejectUnauthorized: false) के साथ कनेक्ट हो रहा है।');
} else {
    // लोकल डेवलपमेंट (Local Development)
    connectionOptions = {
        // यदि DATABASE_URL सेट नहीं है, तो एक डिफ़ॉल्ट (default) मान का उपयोग करें
        connectionString: DATABASE_URL || 'postgres://user:pass@localhost:5432/sidhantdb'
    };
    if (!DATABASE_URL) {
        console.warn('[DB] Warning: DATABASE_URL नहीं मिला। डिफ़ॉल्ट लोकलहोस्ट का उपयोग किया जा रहा है।');
    }
}
// -------------------------------------------------------------------------

// डेटाबेस इंस्टेंस बनाएँ
const db = pgp(connectionOptions);

// कनेक्शन का परीक्षण करें
db.connect()
    .then(obj => {
        console.log('[DB] सफलतापूर्वक डेटाबेस से कनेक्ट हुआ:', obj.client.database);
        obj.done(); // कनेक्शन को पूल में वापस रिलीज़ करें
    })
    .catch(error => {
        console.error('[DB] ERROR connecting to database:', error.message || error);
    });

module.exports = {
    db,    // डेटाबेस कनेक्शन इंस्टेंस
    pgp    // pg-promise लाइब्रेरी
};