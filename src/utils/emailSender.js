// File: src/utils/emailSender.js

// Using 'nodemailer' as the standard library.
// Mocking the 'nodemailer' transport for simplicity in this code block.
const nodemailer = require("nodemailer");
const UserAuthModel = require("../modules/auth/userAuth/userAuth.model");

// --- Configuration (Should ideally be in a separate config/env file) ---
const EMAIL_TRANSPORT_CONFIG = {
  host: process.env.EMAIL_HOST || "smtp.example.com",
  port: process.env.EMAIL_PORT || 587,
  secure: process.env.EMAIL_SECURE === "true", // Use TLS/SSL
  auth: {
    user: process.env.EMAIL_USER || "noreply@example.com",
    pass: process.env.EMAIL_PASS || "password123",
  },
};

const SENDER_EMAIL = process.env.SENDER_EMAIL || "noreply@sidhant.com";

const transporter = nodemailer.createTransport(EMAIL_TRANSPORT_CONFIG);

/**
 * Sends an email with support for dynamic Admin/SuperAdmin recipient lookup
 * for critical notifications.
 * @param {object} options
 * @param {string} options.to - The primary recipient email address.
 * @param {string} options.subject - The subject line.
 * @param {string} options.text - The plain text body.
 * @param {boolean} [options.isCritical=false] - If true, send a copy to all Admin/SuperAdmin emails.
 */
const sendEmail = async ({ to, subject, text, isCritical = false }) => {
  let finalRecipients = [to];
  let ccRecipients = [];

  if (isCritical) {
    try {
      // Fetch all Admin/SuperAdmin emails from the database
      const adminEmails = await UserAuthModel.findAdminEmails();

      // Filter out the primary recipient if they are also an admin, to avoid duplicate sends
      ccRecipients = adminEmails.filter((email) => email !== to);

      // If the primary recipient (to) is not a critical user (e.g., system user)
      // and the email is critical, ensure all admins get it in the main 'to' field
      // if 'to' was a placeholder like 'admin_list_lookup_is_internal'.
      // For simplicity, we just add admins to CC/BCC.
      if (ccRecipients.length > 0) {
        console.log(
          `Critical email to ${to}. Also CC'ing admins: ${ccRecipients.join(
            ", "
          )}`
        );
      } else {
        console.warn(
          "Critical email requested but no admin emails found in DB."
        );
      }
    } catch (error) {
      console.error(
        "Failed to fetch admin emails for critical notification:",
        error.message
      );
      // Non-fatal error: proceed with sending to the primary recipient only
    }
  }

  const mailOptions = {
    from: SENDER_EMAIL,
    to: finalRecipients.join(","),
    cc: ccRecipients.join(","), // Admins go here if critical
    subject: isCritical ? `[CRITICAL] ${subject}` : subject,
    text: text,
    // html: `<h1>${subject}</h1><p>${text}</p>` // Add HTML body in production
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    // In a real system, you would log info.messageId or check response status
    console.log(`Email sent: ${info.response} to ${mailOptions.to}`);
    return info;
  } catch (error) {
    console.error("Email send failed:", error);
    // Non-fatal error for the API flow, but critical for monitoring
    // A robust solution would enqueue a retry mechanism (e.g., using a message queue)
    throw new Error("Email sending failed due to server error.");
  }
};

module.exports = { sendEmail };
