"use strict";

const nodemailer = require("nodemailer");
const ErrorHandler = require("./errorHandler");

const {
  EMAIL_HOST,
  EMAIL_PORT,
  EMAIL_USER,
  EMAIL_PASS,
  EMAIL_FROM, // optional
} = process.env;

let transporter = null;
let transporterVerified = false;

/**
 * Create and cache a nodemailer transporter if configuration exists.
 * Returns null if configuration is incomplete.
 */
function getTransporter() {
  if (transporter !== null) return transporter;

  if (!EMAIL_HOST || !EMAIL_PORT || !EMAIL_USER || !EMAIL_PASS) {
    // Intentionally do not throw here; higher-level logic will decide to skip sending.
    return null;
  }

  const portNum = parseInt(EMAIL_PORT, 10) || 587;
  const isSecure = portNum === 465;

  transporter = nodemailer.createTransport({
    host: EMAIL_HOST,
    port: portNum,
    secure: isSecure,
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_PASS,
    }, // sensible defaults; users can override via env if they wire up nodemailer differently
    connectionTimeout: 30_000,
    greetingTimeout: 30_000,
    socketTimeout: 30_000,
  });

  return transporter;
}

/**
 * Verify transporter once (best-effort). Logs verification failures but does not throw here.
 */
async function verifyTransporter(t) {
  if (!t || transporterVerified) return;
  try {
    // nodemailer verify supports callback or Promise
    await t.verify();
    transporterVerified = true;
  } catch (err) {
    // Verification failed — still keep transporter to allow retries, but log a warning.
    console.warn(
      "emailSender: transporter verification failed — emails may not send:",
      err && err.message ? err.message : err
    );
  }
}

/**
 * sendEmail({ to, subject, text, html })
 * - to: string or array of recipients
 * - subject: string
 * - text: plain text body
 * - html: html body
 *
 * If SMTP env vars are missing, the function will skip sending and log a warning.
 * Network/SMTP errors will be wrapped/thrown using the project's ErrorHandler.
 */
async function sendEmail({ to, subject, text, html } = {}) {
  // Basic parameter validation
  if (!to) {
    throw new Error('sendEmail: "to" parameter is required');
  }
  if (!subject) {
    throw new Error('sendEmail: "subject" parameter is required');
  }
  if (!text && !html) {
    throw new Error('sendEmail: either "text" or "html" body must be provided');
  }

  const t = getTransporter();
  if (!t) {
    // Missing configuration — do not attempt to send. Log and return a skipped result.
    console.warn(
      "emailSender: SMTP environment variables (EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASS) are not all set. Skipping email send."
    );
    return {
      skipped: true,
      reason: "missing_smtp_configuration",
      to,
      subject,
    };
  }

  await verifyTransporter(t);

  const fromAddress = EMAIL_FROM || EMAIL_USER;

  const mailOptions = {
    from: fromAddress,
    to,
    subject,
    text,
    html,
  };

  try {
    const info = await t.sendMail(mailOptions); // nodemailer returns an info object with messageId and envelope, include it for callers
    return {
      skipped: false,
      info,
    };
  } catch (err) {
    // Wrap and rethrow using project's ErrorHandler. Preserve original error where possible.
    // Common ErrorHandler signature in projects: new ErrorHandler(message, statusCode)
    // We try to preserve the original message and provide a 502 (Bad Gateway) status for SMTP/network errors.
    const message = `Failed to send email to ${
      Array.isArray(to) ? to.join(",") : to
    }: ${err && err.message ? err.message : "unknown error"}`;
    try {
      // If ErrorHandler is a constructor/class
      if (typeof ErrorHandler === "function") {
        // Some ErrorHandler implementations accept (message, statusCode)
        // Use 502 as a common network/SMTP error code mapping.
        const wrapped = new ErrorHandler(message, 502); // If environment supports Error.cause, attach original error
        if (
          typeof wrapped === "object" &&
          "cause" in Error.prototype === false
        ) {
          wrapped.cause = err;
        }
        throw wrapped;
      }
    } catch (wrapErr) {
      // Fall through to generic throw below if ErrorHandler usage failed.
    } // Fallback: throw a generic Error with original error attached

    const generic = new Error(message);
    generic.originalError = err;
    throw generic;
  }
}

// --- FIX: Added specific wrapper function for verification email ---
/**
 * sendVerificationEmail({ to, name, otp })
 * Helper function to structure the verification email data and call sendEmail.
 */
async function sendVerificationEmail({ to, name, otp }) {
  if (!to || !otp) {
    throw new Error(
      'sendVerificationEmail: "to" and "otp" parameters are required.'
    );
  }

  const subject = "Verify your Account / OTP for Login";
  const html = `
        <h1>Hello ${name || to},</h1>
        <p>Your One-Time Password (OTP) for account verification is:</p>
        <h2 style="color:#007bff;">${otp}</h2>
        <p>This code is valid for 5 minutes.</p>
        <p>Thank you.</p>
    `;
  const text = `Hello ${
    name || to
  }, your OTP is ${otp}. This code is valid for 5 minutes.`;

  // Delegate the actual sending to the core sendEmail function
  return sendEmail({ to, subject, text, html });
}
// --- END FIX ---

// --- FIX: Exporting both sendEmail and the new helper function ---
module.exports = {
  sendEmail,
  sendVerificationEmail,
};
