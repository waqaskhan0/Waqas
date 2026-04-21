import { query } from "../../config/db.js";

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
