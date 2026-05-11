import bcrypt from "bcryptjs";
import { query } from "../../config/db.js";
import { ROLES } from "../../config/roles.js";
import { ApiError } from "../../utils/apiError.js";

function mapUser(row) {
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

export async function listUsers() {
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
      ORDER BY full_name ASC
    `
  );

  return rows.map(mapUser);
}

export async function listManagers() {
  const rows = await query(
    `
      SELECT
        id,
        full_name,
        email,
        department,
        employee_code
      FROM users
      WHERE role_code = 'LINE_MANAGER'
        AND status = 'ACTIVE'
      ORDER BY full_name ASC
    `
  );

  return rows.map((row) => ({
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    department: row.department,
    employeeCode: row.employee_code
  }));
}

function normalizeUserPayload(payload, { partial = false } = {}) {
  const fullName = String(payload.fullName ?? payload.full_name ?? "").trim();
  const email = String(payload.email ?? "").trim().toLowerCase();
  const password = String(payload.password ?? "").trim();
  const role = String(payload.role ?? payload.roleCode ?? (partial ? "" : ROLES.EMPLOYEE)).trim();
  const department = String(payload.department ?? "").trim();
  const hasManagerId = Object.prototype.hasOwnProperty.call(payload, "managerId");
  const managerId =
    payload.managerId === null || payload.managerId === "" || payload.managerId === undefined
      ? null
      : Number(payload.managerId);
  const basicSalary =
    payload.basicSalary === undefined || payload.basicSalary === ""
      ? partial
        ? null
        : 50000
      : Number(payload.basicSalary);

  if (!partial || fullName) {
    if (!fullName || fullName.length > 120) {
      throw new ApiError(400, "Full name is required and must be 120 characters or fewer.");
    }
  }

  if (!partial || email) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new ApiError(400, "A valid email address is required.");
    }
  }

  if (!partial || role) {
    if (!Object.values(ROLES).includes(role)) {
      throw new ApiError(400, "Role is invalid.");
    }
  }

  if (!partial || department) {
    if (!department || department.length > 100) {
      throw new ApiError(400, "Department is required and must be 100 characters or fewer.");
    }
  }

  if (managerId !== null && (!Number.isInteger(managerId) || managerId <= 0)) {
    throw new ApiError(400, "Manager id must be a valid user id.");
  }

  if (basicSalary !== null && (!Number.isFinite(basicSalary) || basicSalary < 0)) {
    throw new ApiError(400, "Basic salary must be zero or greater.");
  }

  return {
    fullName,
    email,
    password,
    role,
    department,
    hasManagerId,
    managerId,
    basicSalary
  };
}

async function buildEmployeeCode(role) {
  const prefix =
    {
      [ROLES.EMPLOYEE]: "EMP",
      [ROLES.LINE_MANAGER]: "MGR",
      [ROLES.HR_OFFICER]: "HR",
      [ROLES.FINANCE]: "FIN",
      [ROLES.INVENTORY_OFFICER]: "INV",
      [ROLES.PROCUREMENT_OFFICER]: "PROC",
      [ROLES.SUPER_ADMIN]: "ADM"
    }[role] ?? "USR";
  const rows = await query(`SELECT COUNT(*) AS total FROM users WHERE employee_code LIKE ?`, [
    `${prefix}-%`
  ]);

  return `${prefix}-${String(Number(rows[0]?.total ?? 0) + 1).padStart(3, "0")}`;
}

export async function createUser(payload) {
  const user = normalizeUserPayload(payload);

  if (!user.password || user.password.length < 8) {
    throw new ApiError(400, "Password is required and must be at least 8 characters long.");
  }

  const employeeCode = String(payload.employeeCode ?? "").trim() || (await buildEmployeeCode(user.role));
  const passwordHash = await bcrypt.hash(user.password, 10);

  try {
    const result = await query(
      `
        INSERT INTO users (
          employee_code,
          full_name,
          email,
          password_hash,
          role_code,
          department,
          manager_id,
          basic_salary,
          joined_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_DATE())
      `,
      [
        employeeCode,
        user.fullName,
        user.email,
        passwordHash,
        user.role,
        user.department,
        user.managerId,
        user.basicSalary
      ]
    );

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
      [result.insertId]
    );

    return mapUser(rows[0]);
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      throw new ApiError(409, "A user with that email or employee code already exists.");
    }

    throw error;
  }
}

export async function updateUser(userId, payload) {
  const user = normalizeUserPayload(payload, { partial: true });

  await query(
    `
      UPDATE users
      SET full_name = COALESCE(NULLIF(?, ''), full_name),
          email = COALESCE(NULLIF(?, ''), email),
          role_code = COALESCE(NULLIF(?, ''), role_code),
          department = COALESCE(NULLIF(?, ''), department),
          manager_id = CASE WHEN ? THEN ? ELSE manager_id END,
          basic_salary = COALESCE(?, basic_salary)
      WHERE id = ?
    `,
    [
      user.fullName,
      user.email,
      user.role,
      user.department,
      user.hasManagerId,
      user.managerId,
      user.basicSalary,
      userId
    ]
  );

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
    [userId]
  );

  if (!rows[0]) {
    throw new ApiError(404, "User was not found.");
  }

  return mapUser(rows[0]);
}

export async function setUserStatus(userId, status) {
  await query(`UPDATE users SET status = ? WHERE id = ?`, [status, userId]);
}

export async function changeUserRole(userId, role) {
  if (!Object.values(ROLES).includes(role)) {
    throw new ApiError(400, "Role is invalid.");
  }

  await query(`UPDATE users SET role_code = ? WHERE id = ?`, [role, userId]);
}
