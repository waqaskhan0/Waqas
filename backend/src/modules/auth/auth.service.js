import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";
import { query } from "../../config/db.js";
import { env } from "../../config/env.js";
import { markSignIn } from "../attendance/attendance.service.js";
import { ApiError } from "../../utils/apiError.js";

function getSessionExpiryDate() {
  const match = String(env.jwtExpiresIn).match(/^(\d+)([smhd])$/i);

  if (!match) {
    return new Date(Date.now() + 8 * 60 * 60 * 1000);
  }

  const value = Number(match[1]);
  const unit = match[2].toLowerCase();
  const multipliers = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000
  };

  return new Date(Date.now() + value * multipliers[unit]);
}

function mapUser(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    role: row.role_code,
    department: row.department,
    employeeCode: row.employee_code,
    managerId: row.manager_id,
    status: row.status
  };
}

async function findUserByEmail(email) {
  const rows = await query(
    `
      SELECT
        id,
        full_name,
        email,
        password_hash,
        role_code,
        department,
        employee_code,
        manager_id,
        status
      FROM users
      WHERE email = ?
      LIMIT 1
    `,
    [email]
  );

  return rows[0] ?? null;
}

async function findUserById(id) {
  const rows = await query(
    `
      SELECT
        id,
        full_name,
        email,
        role_code,
        department,
        employee_code,
        manager_id,
        status
      FROM users
      WHERE id = ?
      LIMIT 1
    `,
    [id]
  );

  return rows[0] ?? null;
}

export async function login({ email, password, ipAddress, userAgent }) {
  const user = await findUserByEmail(email);

  if (!user) {
    throw new ApiError(401, "Invalid email or password.");
  }

  const isPasswordValid = await bcrypt.compare(password, user.password_hash);
  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid email or password.");
  }

  if (user.status !== "ACTIVE") {
    throw new ApiError(403, "This account is inactive. Please contact support.");
  }

  const sessionId = randomUUID();
  const tokenJti = randomUUID();
  const expiresAt = getSessionExpiryDate();

  await query(
    `
      INSERT INTO user_sessions (
        session_id,
        user_id,
        token_jti,
        ip_address,
        user_agent,
        expires_at
      )
      VALUES (?, ?, ?, ?, ?, ?)
    `,
    [sessionId, user.id, tokenJti, ipAddress, userAgent, expiresAt]
  );

  const token = jwt.sign(
    {
      sub: user.id,
      sid: sessionId,
      jti: tokenJti,
      role: user.role_code
    },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn }
  );

  await markSignIn(user.id);

  return {
    token,
    user: mapUser(user)
  };
}

export async function getCurrentUser(userId) {
  const user = await findUserById(userId);

  if (!user || user.status !== "ACTIVE") {
    throw new ApiError(404, "User was not found.");
  }

  return mapUser(user);
}

export async function logout(sessionId) {
  await query(
    `
      UPDATE user_sessions
      SET revoked_at = CURRENT_TIMESTAMP
      WHERE session_id = ?
        AND revoked_at IS NULL
    `,
    [sessionId]
  );
}
