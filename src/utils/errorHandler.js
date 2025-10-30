/*
 * Context Note: यह एक केंद्रीय (central) एरर हैंडलिंग मिडलवेयर है।
 * यह 'APIError' क्लास को परिभाषित करता है ताकि हम HTTP स्टेटस कोड के साथ एरर फेंक सकें।
 */

/**
 * 1. कस्टम APIError क्लास
 * (पुराने /src/utils/errorHandler.js से)
 */
class APIError extends Error {
    /**
     * @param {string} message - एरर का विवरण।
     * @param {number} statusCode - HTTP स्टेटस कोड (जैसे 400, 404, 500)।
     */
    constructor(message, statusCode = 500) {
        super(message);
        this.statusCode = statusCode;
        this.name = 'APIError'; // एरर के प्रकार की पहचान के लिए
        this.isOperational = true; // यह इंगित करता है कि यह एक ज्ञात एरर है

        // स्टैक ट्रेस (stack trace) को कैप्चर करें
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, this.constructor);
        }
    }
}

/**
 * 2. ग्लोबल एरर हैंडलर मिडलवेयर
 * (पुराने /src/utils/errorHandler.js से)
 * इसे server.js में सभी रूट्स के बाद जोड़ा जाएगा।
 */
const errorHandler = (err, req, res, next) => {
    console.error('---------------------------------');
    console.error('[Global Error Handler]:', err.name);
    console.error('Path:', req.path);
    console.error('Message:', err.message);
    // console.error('Stack:', err.stack); // (डेवलपमेंट में डिबगिंग के लिए उपयोगी)
    console.error('---------------------------------');

    // यदि यह हमारा ज्ञात APIError है, तो उसका उपयोग करें
    if (err instanceof APIError || err.isOperational) {
        return res.status(err.statusCode).json({
            message: err.message,
            code: err.code || `HTTP_${err.statusCode}`
        });
    }

    // pg-promise से ज्ञात डेटाबेस एरर
    if (err.code && typeof err.code === 'string' && err.code.length === 5 && err.code.startsWith('23')) {
        // (जैसे 23505 = unique_violation, 23503 = foreign_key_violation)
        return res.status(409).json({
            message: 'Database Conflict. यह डेटा पहले से मौजूद हो सकता है या किसी अन्य रिकॉर्ड पर निर्भर है।',
            code: `DB_${err.code}`
        });
    }

    // अज्ञात (Unknown) या अप्रत्याशित (unexpected) एरर
    return res.status(500).json({
        message: 'Internal Server Error. कुछ गलत हो गया है।',
        code: 'SERVER_UNEXPECTED'
    });
};

/**
 * 3. 404 Not Found हैंडलर
 * (पुराने /src/app.js से)
 * इसे server.js में सभी API रूट्स के बाद, लेकिन errorHandler से पहले जोड़ा जाएगा।
 */
const notFound = (req, res, next) => {
    const error = new APIError(`Route not found: ${req.method} ${req.originalUrl}`, 404);
    next(error); // इसे ग्लोबल एरर हैंडलर को भेजें
};

module.exports = {
    APIError,
    errorHandler,
    notFound
};