const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const model = require('./userAuth.model');

// pg-promise DB instance (adjust path if your project places db elsewhere)
const db = require('../../../db');

const SALT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS) || 12;
const OTP_TTL_MS = Number(process.env.OTP_TTL_MS) || 10 * 60 * 1000; // 10 minutes
const JWT_SECRET = process.env.JWT_SECRET || 'replace-me';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';

function generateOtp() {
  return `${Math.floor(100000 + Math.random() * 900000)}`; // 6-digit OTP
}

async function registerUser({ email, password }) {
  const otp = generateOtp();
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const otpHash = await bcrypt.hash(otp, SALT_ROUNDS);
  const otpExpires = new Date(Date.now() + OTP_TTL_MS);

  try {
    const result = await db.tx(async (t) => {
      const existing = await model.getUserByEmail(t, email);
      if (existing) {
        const err = new Error('User already exists');
        err.status = 409;
        throw err;
      }

      const created = await model.createUser(t, {
        email,
        passwordHash,
        otpHash,
        otpExpires,
      });

      // In production send OTP via email/SMS. Returning OTP is for testing/dev only.
      return { user: created, otp };
    });

    return result;
  } catch (err) {
    throw err;
  }
}

async function verifyOtp({ email, otp }) {
  try {
    const result = await db.tx(async (t) => {
      const user = await model.getUserByEmail(t, email);
      if (!user) {
        const err = new Error('User not found');
        err.status = 404;
        throw err;
      }

      if (!user.otp_hash || !user.otp_expires) {
        const err = new Error('No OTP available for this user');
        err.status = 400;
        throw err;
      }

      if (new Date(user.otp_expires) < new Date()) {
        const err = new Error('OTP expired');
        err.status = 400;
        throw err;
      }

      const match = await bcrypt.compare(otp, user.otp_hash);
      if (!match) {
        const err = new Error('Invalid OTP');
        err.status = 400;
        throw err;
      }

      const updated = await model.verifyOtp(t, user.id);
      return updated;
    });

    return result;
  } catch (err) {
    throw err;
  }
}

async function loginUser({ email, password }) {
  // Read-only: no tx required
  const user = await db.oneOrNone(...model.getUserByEmailQuery(email));
  if (!user) {
    const err = new Error('Invalid credentials');
    err.status = 401;
    throw err;
  }

  if (!user.verified) {
    const err = new Error('Account not verified');
    err.status = 403;
    throw err;
  }

  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) {
    const err = new Error('Invalid credentials');
    err.status = 401;
    throw err;
  }

  const payload = { sub: user.id, email: user.email };
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

  return {
    user: { id: user.id, email: user.email },
    token,
  };
}

async function forgotPassword({ email }) {
  const otp = generateOtp();
  const otpHash = await bcrypt.hash(otp, SALT_ROUNDS);
  const otpExpires = new Date(Date.now() + OTP_TTL_MS);

  try {
    const result = await db.tx(async (t) => {
      const user = await model.getUserByEmail(t, email);
      if (!user) {
        // For security, do not reveal whether the email exists; behave as success.
        return { sent: true };
      }

      await model.setOtpForUser(t, email, otpHash, otpExpires);

      // In production: send OTP via email/SMS. Returning OTP is for testing/dev only.
      return { sent: true, otp };
    });

    return result;
  } catch (err) {
    throw err;
  }
}

async function resetPassword({ email, otp, newPassword }) {
  const newPasswordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

  try {
    const result = await db.tx(async (t) => {
      const user = await model.getUserByEmail(t, email);
      if (!user) {
        const err = new Error('User not found');
        err.status = 404;
        throw err;
      }

      if (!user.otp_hash || !user.otp_expires) {
        const err = new Error('No OTP available for this user');
        err.status = 400;
        throw err;
      }

      if (new Date(user.otp_expires) < new Date()) {
        const err = new Error('OTP expired');
        err.status = 400;
        throw err;
      }

      const match = await bcrypt.compare(otp, user.otp_hash);
      if (!match) {
        const err = new Error('Invalid OTP');
        err.status = 400;
        throw err;
      }

      const updated = await model.updatePassword(t, user.id, newPasswordHash);
      await model.clearOtp(t, user.id);
      return updated;
    });

    return result;
  } catch (err) {
    throw err;
  }
}

async function logoutUser({ token }) {
  try {
    const decoded = jwt.decode(token) || {};
    const expiresAt = decoded.exp ? new Date(decoded.exp * 1000) : new Date(Date.now() + 60 * 60 * 1000);

    const result = await db.tx(async (t) => {
      const inserted = await model.insertRevokedToken(t, token, expiresAt);
      return inserted;
    });

    return result;
  } catch (err) {
    throw err;
  }
}

module.exports = {
  registerUser,
  verifyOtp,
  loginUser,
  forgotPassword,
  resetPassword,
  logoutUser,
};