const Joi = require("joi");
const bcrypt = require("bcryptjs");
const { db, pgp } = require("../../../../src/database/db");
const { APIError } = require("../../../utils/errorHandler");
// const emailSender = require("../../../utils/emailSender");
const emailSender = require("../../../utils/emailSender");
const { generateOtp } = require("../../../utils/validation");
const { registerSchema } = require("./userAuth.validation");

const USER_TABLE = "master_users";
const ROLE_TABLE = "master_roles";
const OTP_TABLE = "user_otp";

const DEFAULT_ROLE = "Client";

async function registerUser({
  email,
  full_name,
  password,
  defaultRoleName = DEFAULT_ROLE,
}) {
  // 1) Joi validation
  const { error } = registerSchema.validate(
    { email, full_name, password, defaultRoleName },
    { abortEarly: false }
  );
  if (error) {
    const msg = error.details.map((d) => d.message).join("; ");
    throw new APIError(`Validation failed: ${msg}`, 400);
  }

  const saltRounds = Number(process.env.PASSWORD_SALT_ROUNDS) || 10;
  const otpSaltRounds = Number(process.env.OTP_SALT_ROUNDS) || 10;

  // 2) Hash password & generate OTP (OTP value will be emailed)
  const passwordHash = await bcrypt.hash(password, saltRounds);
  const otpCode = generateOtp();
  const otpHash = await bcrypt.hash(otpCode, otpSaltRounds);
  const otpExpiry = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

  try {
    // 3) All DB CUD ops within a single transaction
    const txResult = await db.tx(async (t) => {
      // ensure role exists
      await t.none(
        `INSERT INTO ${ROLE_TABLE} (role_name) VALUES ($1) ON CONFLICT (role_name) DO NOTHING`,
        [defaultRoleName]
      );

      // fetch role_id
      const roleRow = await t.one(
        `SELECT role_id FROM ${ROLE_TABLE} WHERE role_name = $1`,
        [defaultRoleName]
      );

      // insert user (with password_hash)
      const newUser = await t.one(
        `INSERT INTO ${USER_TABLE} (email, full_name, role_id, password_hash, is_active, created_at)
                 VALUES ($1, $2, $3, $4, TRUE, NOW())
                 RETURNING user_id, email, full_name, role_id`,
        [email.trim(), full_name.trim(), roleRow.role_id, passwordHash]
      );

      // insert OTP (or update if exists) — kept inside same transaction
      await t.one(
        `INSERT INTO ${OTP_TABLE} (user_id, otp_code, expires_at, attempts)
                 VALUES ($1, $2, $3, 0)
                 ON CONFLICT (user_id) DO UPDATE
                 SET otp_code = EXCLUDED.otp_code, expires_at = EXCLUDED.expires_at, attempts = 0
                 RETURNING *`,
        [newUser.user_id, otpHash, otpExpiry]
      );

      // return minimal user info from transaction
      return newUser;
    });

    // 4) Send verification email after successful transaction
    // Assume emailSender exposes sendVerificationEmail({ to, name, otp })
    try {
      if (
        emailSender &&
        typeof emailSender.sendVerificationEmail === "function"
      ) {
        await emailSender.sendVerificationEmail({
          to: txResult.email,
          name: txResult.full_name,
          otp: otpCode,
        });
      } else if (emailSender && typeof emailSender.sendEmail === "function") {
        // fallback if implementation differs
        await emailSender.sendEmail({
          to: txResult.email,
          subject: "Verify your account",
          text: `Hello ${txResult.full_name}, your verification OTP is ${otpCode}`,
        });
      } else {
        // If no usable sender found, log a debug message (do not fail registration)
        console.warn(
          "[Email Sender] No usable email sender found: expected sendVerificationEmail or sendEmail."
        );
      }
    } catch (emailErr) {
      // Email failures should not undo DB transaction — just log and continue
      console.error(
        "[Email Sender] failed to send verification email:",
        emailErr && emailErr.message ? emailErr.message : emailErr
      );
    }

    // 5) Return registered user object (excluding password hash)
    // Fetch canonical user record with role name
    const registeredUser = await db.oneOrNone(
      `SELECT u.user_id, u.email, u.full_name, r.role_name AS role, u.is_active, u.created_at
             FROM ${USER_TABLE} u
             JOIN ${ROLE_TABLE} r ON u.role_id = r.role_id
             WHERE u.user_id = $1`,
      [txResult.user_id]
    );

    if (!registeredUser) {
      throw new APIError(
        "Failed to fetch registered user after creation.",
        500
      );
    }

    return registeredUser;
  } catch (err) {
    // map DB unique constraint to friendly error
    if (err && err.code === "23505") {
      throw new APIError("Registration failed: email already exists.", 409);
    }
    // rethrow APIError or wrap unknown errors
    if (err instanceof APIError) throw err;
    console.error(
      "Registration error:",
      err && err.message ? err.message : err
    );
    throw new APIError("User registration failed.", 500);
  }
}

module.exports = {
  registerUser,
};
