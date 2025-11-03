/**
 * src/utils/emailSender.js - World-Class, Robust SMTP Utility
 * (FINAL VERSION: Correctly maps EMAIL_PASSWORD, uses caching, verification, and clear helpers)
 */
"use strict";

const nodemailer = require("nodemailer");
// Assume ErrorHandler is available in the same utils folder
const ErrorHandler = require("./errorHandler");

// =========================================================================
// ✅ FINAL FIX: Correctly map EMAIL_PASSWORD from process.env to local EMAIL_PASS
// =========================================================================
const EMAIL_HOST = process.env.EMAIL_HOST;
const EMAIL_PORT = process.env.EMAIL_PORT;
const EMAIL_USER = process.env.EMAIL_USER;
// 🛑 CRITICAL FIX: Load from EMAIL_PASSWORD to match the .env file
const EMAIL_PASS = process.env.EMAIL_PASSWORD;
// =========================================================================

// EMAIL_SENDER_NAME का उपयोग करके 'From' एड्रेस को बेहतर बनाएं
const EMAIL_FROM = process.env.EMAIL_SENDER_NAME
  ? `${process.env.EMAIL_SENDER_NAME} <${EMAIL_USER}>`
  : EMAIL_USER;

let transporter = null;
let transporterVerified = false;

/**
 * Create and cache a nodemailer transporter if configuration exists.
 * Returns null if configuration is incomplete.
 */
function getTransporter() {
  if (transporter !== null) return transporter;

  // Check the critical four variables
  if (!EMAIL_HOST || !EMAIL_PORT || !EMAIL_USER || !EMAIL_PASS) {
    console.warn(
      "⚠️ emailSender: Skipping initialization. Missing SMTP credentials."
    );
    return null;
  }

  const portNum = parseInt(EMAIL_PORT, 10) || 587;
  const isSecure = portNum === 465;

  try {
    transporter = nodemailer.createTransport({
      host: EMAIL_HOST,
      port: portNum,
      secure: isSecure,
      auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASS, // ✅ NOW Correctly loaded from EMAIL_PASSWORD
      },
      connectionTimeout: 30_000,
      greetingTimeout: 30_000,
      socketTimeout: 30_000,
      // Production में, self-signed errors से बचने के लिए tls: { rejectUnauthorized: false } को हटा दें
    });
  } catch (e) {
    console.error("emailSender: Transporter initialization failed:", e.message);
    return null;
  }

  return transporter;
}

/**
 * Verify transporter once (best-effort). Logs verification failures but does not throw here.
 */
async function verifyTransporter(t) {
  if (!t || transporterVerified) return;
  try {
    await t.verify();
    transporterVerified = true;
    console.log(
      "✅ emailSender: Transporter connection verified successfully."
    );
  } catch (err) {
    console.warn(
      "emailSender: Transporter verification failed — emails may not send:",
      err && err.message ? err.message : err
    );
  }
}

/**
 * Core function to send an email.
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
    console.warn(
      "[EMAIL SKIP] Service is disabled due to missing SMTP configuration."
    );
    return { skipped: true, reason: "missing_smtp_configuration", to, subject };
  }

  // Verification is best-effort and runs only once
  await verifyTransporter(t);

  const mailOptions = {
    from: EMAIL_FROM,
    to,
    subject,
    text,
    html,
  };

  try {
    const info = await t.sendMail(mailOptions);
    console.log(`[EMAIL SUCCESS] Sent to ${to}. ID: ${info.messageId}`);
    return { skipped: false, info };
  } catch (err) {
    // Wrap and rethrow using project's ErrorHandler (using 502 for SMTP/network errors)
    const message = `Failed to send email to ${
      Array.isArray(to) ? to.join(",") : to
    }: ${err && err.message ? err.message : "unknown error"}`;
    // Assuming ErrorHandler(message, statusCode) constructor pattern
    throw new ErrorHandler(message, 502);
  }
}

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

  return sendEmail({ to, subject, text, html });
}

module.exports = {
  sendEmail,
  sendVerificationEmail,
};
