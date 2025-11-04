// File: src/utils/emailSender.js
const nodemailer = require("nodemailer");
const CustomError = require("./errorHandler");

// 1. Configure Transporter using Environment Variables (Security First)
let transporter;

// Safely parse port number
const port = parseInt(process.env.EMAIL_PORT, 10);
const isSecure = port === 465;

if (
  process.env.EMAIL_HOST &&
  process.env.EMAIL_USER &&
  process.env.EMAIL_PASS
) {
  transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: port,
    secure: isSecure, // true for 465 (SSL), false for 587 (STARTTLS)
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    // CRITICAL FIX FOR ECONNRESET/TIMEOUTS:
    tls: {
      // Reject self-signed certs (Production standard)
      rejectUnauthorized: true,
    },
    // ENHANCE CONNECTION STABILITY:
    pool: true, // Use connection pooling
    maxConnections: 5,
    maxMessages: 100,
    // Setting a command timeout (ms)
    timeout: 15000,
    // Set connection timeout (ms)
    connectionTimeout: 10000,
    // The socket should be kept alive
    keepAlive: true,
  });

  // 2. Transporter Verification (Check connection status on startup)
  transporter.verify((error, success) => {
    if (error) {
      console.error("❌ Email service connection failed:", error.message);
      console.warn(
        `   => CRITICAL: Mode: ${
          isSecure ? "SSL (465)" : "STARTTLS (587)"
        }. Check credentials (must be App Password for Gmail) and firewall settings.`
      );
    } else {
      console.log(
        `✅ Email service connected successfully. Mode: ${
          isSecure ? "SSL (465)" : "STARTTLS (587)"
        }.`
      );
    }
  });
} else {
  console.warn(
    "⚠️ Email service skipped: Missing critical EMAIL_HOST, EMAIL_USER, or EMAIL_PASS environment variables."
  );
}

// ... sendOtp and sendAdminNotification functions remain the same as the previous correct version ...
/**
 * Sends a dynamically generated OTP email.
 * @param {string} toEmail - Recipient email address.
 * @param {string} otpCode - The 6-digit OTP.
 * @param {string} type - 'registration', 'login', or 'reset'.
 */
const sendOtp = async (toEmail, otpCode, type = "registration") => {
  if (!transporter) {
    console.warn(`Email skipped for ${toEmail}. Transporter not configured.`);
    return;
  }

  const subjectMap = {
    registration: "Account Verification OTP (Time Sensitive)",
    login: "Two-Factor Login Code (Time Sensitive)",
    reset: "Password Reset Code (Time Sensitive)",
  };

  const subject = subjectMap[type] || subjectMap.registration;

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
      <h2 style="color: #0056b3;">${subject}</h2>
      <p>Dear User,</p>
      <p>Your one-time password (OTP) is:</p>
      <div style="text-align: center; margin: 20px 0;">
        <span style="font-size: 24px; font-weight: bold; color: #d9534f; background-color: #f9f9f9; padding: 10px 20px; border-radius: 5px; border: 1px dashed #d9534f;">${otpCode}</span>
      </div>
      <p>This code is valid for 10 minutes. Please do not share this code with anyone.</p>
      <p>If you did not request this, please ignore this email.</p>
      <p>Regards,<br>The JIT/QC System Admin Team</p>
    </div>
  `;

  const mailOptions = {
    from: `${process.env.EMAIL_SENDER_NAME || "JIT/QC System Admin"} <${
      process.env.EMAIL_USER
    }>`,
    to: toEmail,
    subject: subject,
    html: htmlContent,
    text: `Your OTP is: ${otpCode}. Valid for 10 minutes.`,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(
      `[Email] OTP sent to ${toEmail}. Message ID: ${info.messageId}`
    );
    return info;
  } catch (error) {
    console.error(
      `[Email Error] Failed to send email to ${toEmail}:`,
      error.message
    );
    throw new CustomError(
      "Email service failed to send OTP. Check server logs for details.",
      503
    );
  }
};

/**
 * Sends a notification to the system admin for critical events (e.g., New User Verified).
 */
const sendAdminNotification = async (subject, message) => {
  if (!transporter || !process.env.ADMIN_CRITICAL_EMAIL) {
    console.warn(
      "Admin notification skipped. Transporter or ADMIN_CRITICAL_EMAIL not configured."
    );
    return;
  }

  const mailOptions = {
    from: `${process.env.EMAIL_SENDER_NAME || "JIT/QC System Admin"} <${
      process.env.EMAIL_USER
    }>`,
    to: process.env.ADMIN_CRITICAL_EMAIL,
    subject: `[ADMIN ALERT] ${subject}`,
    text: message,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(
      `[Email] Admin Alert sent to ${process.env.ADMIN_CRITICAL_EMAIL}`
    );
  } catch (error) {
    console.error(
      `[Email Error] Failed to send admin notification:`,
      error.message
    );
  }
};

module.exports = {
  sendOtp,
  sendAdminNotification,
};
