const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../../../db');
const model = require('./userAuth.model');

const SALT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10);
const JWT_SECRET = process.env.JWT_SECRET || 'replace_this_secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';
const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes

async function registerUser({ email, password, name }) {
  // basic pre-check (read)
  const existing = await model.getUserByEmail(db, email);
  if (existing) {
    const err = new Error('Email already registered');
    err.status = 409;
    throw err;
  }

  const id = uuidv4();
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  // generate OTP for email verification
  const otp = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit
  const otpHash = await bcrypt.hash(otp, SALT_ROUNDS);
  const otpExpiresAt = new Date(Date.now() + OTP_TTL_MS);

  // Use tx for critical CUD operation (create user)
  const created = await db.tx(async (t) => {
    return model.createUser(t, {
      id,
      email,
      name: name || null,
      password_hash: passwordHash,
      otp_hash: otpHash,
      otp_expires_at: otpExpiresAt,
    });
  });

  // NOTE: sending OTP via email/sms should happen outside the tx. Return OTP for dev/testing.
  return {
    user: created,
    otp, // remove in production; here to allow integration of a mailer in caller
  };
}

async function verifyOtp({ email, otp }) {
  const user = await model.getUserByEmail(db, email);
  if (!user) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }
  if (user.is_verified) {
    const err = new Error('User already verified');
    err.status = 400;
    throw err;
  }
  if (!user.otp_hash || !user.otp_expires_at) {
    const err = new Error('No OTP present for this account');
    err.status = 400;
    throw err;
  }
  if (new Date(user.otp_expires_at) < new Date()) {
    const err = new Error('OTP expired');
    err.status = 400;
    throw err;
  }

  const matched = await bcrypt.compare(otp, user.otp_hash);
  if (!matched) {
    const err = new Error('Invalid OTP');
    err.status = 401;
    throw err;
  }

  // Use tx to atomically mark verified and clear otp fields
  const updated = await db.tx(async (t) => {
    return model.verifyUserById(t, user.id);
  });

  return updated;
}

async function loginUser({ email, password }) {
  const user = await model.getUserByEmail(db, email);
  if (!user) {
    const err = new Error('Invalid credentials');
    err.status = 401;
    throw err;
  }
  if (!user.is_verified) {
    const err = new Error('Email not verified');
    err.status = 403;
    throw err;
  }
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) {
    const err = new Error('Invalid credentials');
    err.status = 401;
    throw err;
  }

  const payload = { sub: user.id, email: user.email };
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

  // Optionally persist session / token (revocation list or sessions) - lightweight here
  return { user: { id: user.id, email: user.email, name: user.name }, token };
}

async function forgotPassword({ email }) {
  const user = await model.getUserByEmail(db, email);
  if (!user) {
    // For security, do not reveal existence — return success-like response.
    return { ok: true };
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const otpHash = await bcrypt.hash(otp, SALT_ROUNDS);
  const otpExpiresAt = new Date(Date.now() + OTP_TTL_MS);

  await model.setUserOtp(db, user.id, otpHash, otpExpiresAt);

  // In production, send OTP by email/SMS here. Return OTP for dev/testing.
  return { ok: true, otp };
}

async function resetPassword({ email, otp, newPassword }) {
  const user = await model.getUserByEmail(db, email);
  if (!user) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }
  if (!user.otp_hash || !user.otp_expires_at) {
    const err = new Error('No OTP present for this account');
    err.status = 400;
    throw err;
  }
  if (new Date(user.otp_expires_at) < new Date()) {
    const err = new Error('OTP expired');
    err.status = 400;
    throw err;
  }
  const otpOk = await bcrypt.compare(otp, user.otp_hash);
  if (!otpOk) {
    const err = new Error('Invalid OTP');
    err.status = 401;
    throw err;
  }

  const newHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

  // Use tx for critical CUD (password update + clear otp)
  const updated = await db.tx(async (t) => {
    return model.updatePassword(t, user.id, newHash);
  });

  return updated;
}

async function logoutUser({ token }) {
  if (!token) {
    return { ok: true };
  }
  // Persist token to revocation store (no tx required here)
  await model.revokeToken(db, token);
  return { ok: true };
}

module.exports = {
  registerUser,
  verifyOtp,
  loginUser,
  forgotPassword,
  resetPassword,
  logoutUser,
};