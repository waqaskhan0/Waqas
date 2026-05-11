import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { query } from "../config/db.js";
import { ApiError } from "../utils/apiError.js";

<<<<<<< HEAD
const LOGIN_BYPASS_ENABLED = true;

async function getDevelopmentUser() {
  const rows = await query(
    `
      SELECT
        employee.id,
        employee.full_name,
        employee.email,
        employee.department,
        employee.employee_code,
        employee.manager_id
      FROM users employee
      WHERE employee.status = 'ACTIVE'
        AND employee.manager_id IS NOT NULL
      ORDER BY employee.id ASC
      LIMIT 1
    `
  );

  const user = rows[0];

  if (!user) {
    throw new ApiError(401, "Development login bypass needs at least one active employee with a manager.");
  }

  return {
    id: user.id,
    fullName: user.full_name,
    email: user.email,
    role: "SUPER_ADMIN",
    department: user.department,
    employeeCode: user.employee_code,
    managerId: user.manager_id,
    isDevelopmentBypass: true
  };
}

export const authenticate = async (req, _res, next) => {
=======
function inferAuditModule(path) {
  return String(path ?? "")
    .split("/")
    .filter(Boolean)[1] ?? "api";
}

export const authenticate = async (req, res, next) => {
>>>>>>> c1f5b2bc2d3fd00af2134e2513677df888304388
  try {
    const authHeader = req.headers.authorization ?? "";
    const [scheme, token] = authHeader.split(" ");

    if (scheme !== "Bearer" || !token) {
      if (LOGIN_BYPASS_ENABLED) {
        req.user = await getDevelopmentUser();
        req.session = {
          id: "development-login-bypass",
          jti: "development-login-bypass"
        };
        return next();
      }

      throw new ApiError(401, "Authentication required.");
    }

    if (LOGIN_BYPASS_ENABLED && token === "development-login-bypass") {
      req.user = await getDevelopmentUser();
      req.session = {
        id: "development-login-bypass",
        jti: "development-login-bypass"
      };
      return next();
    }

    const payload = jwt.verify(token, env.jwtSecret);

    const rows = await query(
      `
        SELECT
          s.session_id,
          s.token_jti,
          s.expires_at,
          s.revoked_at,
          u.id,
          u.full_name,
          u.email,
          u.role_code,
          u.department,
          u.employee_code,
          u.manager_id,
          u.status
        FROM user_sessions s
        INNER JOIN users u ON u.id = s.user_id
        WHERE s.session_id = ?
          AND s.user_id = ?
          AND s.token_jti = ?
        LIMIT 1
      `,
      [payload.sid, payload.sub, payload.jti]
    );

    const session = rows[0];

    if (
      !session ||
      session.revoked_at ||
      session.status !== "ACTIVE" ||
      new Date(session.expires_at) <= new Date()
    ) {
      throw new ApiError(401, "Session is invalid or has expired.");
    }

    await query(
      `
        UPDATE user_sessions
        SET last_used_at = CURRENT_TIMESTAMP
        WHERE session_id = ?
      `,
      [session.session_id]
    );

    req.user = {
      id: session.id,
      fullName: session.full_name,
      email: session.email,
      role: session.role_code,
      department: session.department,
      employeeCode: session.employee_code,
      managerId: session.manager_id
    };
    req.session = {
      id: session.session_id,
      jti: session.token_jti
    };

    if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
      res.on("finish", () => {
        if (res.statusCode >= 400) {
          return;
        }

        query(
          `
            INSERT INTO audit_logs (
              user_id,
              action,
              module,
              ip_address,
              metadata_json
            )
            VALUES (?, ?, ?, ?, ?)
          `,
          [
            req.user.id,
            `${req.method} ${req.originalUrl}`,
            inferAuditModule(req.originalUrl),
            req.ip,
            JSON.stringify({
              params: req.params ?? {},
              query: req.query ?? {}
            })
          ]
        ).catch((auditError) => {
          console.error("[audit-log]", auditError);
        });
      });
    }

    next();
  } catch (error) {
    if (error.name === "JsonWebTokenError" || error.name === "TokenExpiredError") {
      return next(new ApiError(401, "Invalid or expired token."));
    }

    next(error);
  }
};

export const authorizeRoles = (...allowedRoles) => {
  return (req, _res, next) => {
    if (!req.user) {
      return next(new ApiError(401, "Authentication required."));
    }

    if (req.user.isDevelopmentBypass) {
      return next();
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(new ApiError(403, "You do not have access to this resource."));
    }

    next();
  };
};
