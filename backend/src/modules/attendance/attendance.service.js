import { query } from "../../config/db.js";

function toDateOnly(value) {
  if (!value) {
    return new Date().toISOString().slice(0, 10);
  }

  return String(value).slice(0, 10);
}

function mapAttendance(row) {
  return {
    id: row.id,
    userId: row.user_id,
    date: row.attendance_date,
    signInAt: row.sign_in_at,
    signOutAt: row.sign_out_at,
    status: row.status,
    user: row.full_name
      ? {
          id: row.user_id,
          fullName: row.full_name,
          email: row.email,
          department: row.department,
          role: row.role_code
        }
      : undefined
  };
}

export async function markSignIn(userId) {
  await query(
    `
      INSERT INTO attendance (
        user_id,
        attendance_date,
        sign_in_at,
        status,
        source
      )
      VALUES (?, CURRENT_DATE(), NOW(), 'PRESENT', 'LOGIN')
      ON DUPLICATE KEY UPDATE
        sign_in_at = COALESCE(sign_in_at, VALUES(sign_in_at)),
        status = 'PRESENT',
        updated_at = CURRENT_TIMESTAMP
    `,
    [userId]
  );
}

export async function signOutToday(userId) {
  await query(
    `
      INSERT INTO attendance (
        user_id,
        attendance_date,
        sign_in_at,
        sign_out_at,
        status,
        source
      )
      VALUES (?, CURRENT_DATE(), NOW(), NOW(), 'PRESENT', 'MANUAL')
      ON DUPLICATE KEY UPDATE
        sign_out_at = NOW(),
        status = 'PRESENT',
        updated_at = CURRENT_TIMESTAMP
    `,
    [userId]
  );

  const rows = await query(
    `
      SELECT id, user_id, attendance_date, sign_in_at, sign_out_at, status
      FROM attendance
      WHERE user_id = ?
        AND attendance_date = CURRENT_DATE()
      LIMIT 1
    `,
    [userId]
  );

  return mapAttendance(rows[0]);
}

export async function listMyAttendance(userId, days = 60) {
  const rows = await query(
    `
      SELECT id, user_id, attendance_date, sign_in_at, sign_out_at, status
      FROM attendance
      WHERE user_id = ?
        AND attendance_date >= DATE_SUB(CURRENT_DATE(), INTERVAL ? DAY)
      ORDER BY attendance_date DESC
    `,
    [userId, Number(days) || 60]
  );

  return rows.map(mapAttendance);
}

export async function listAttendanceForUsers({ date, department, userId }) {
  const attendanceDate = toDateOnly(date);
  const params = [attendanceDate];
  const filters = ["u.status = 'ACTIVE'"];

  if (department) {
    filters.push("u.department = ?");
    params.push(department);
  }

  if (userId) {
    filters.push("u.id = ?");
    params.push(userId);
  }

  const rows = await query(
    `
      SELECT
        a.id,
        u.id AS user_id,
        ? AS attendance_date,
        a.sign_in_at,
        a.sign_out_at,
        COALESCE(a.status, 'ABSENT') AS status,
        u.full_name,
        u.email,
        u.department,
        u.role_code
      FROM users u
      LEFT JOIN attendance a
        ON a.user_id = u.id
       AND a.attendance_date = ?
      WHERE ${filters.join(" AND ")}
      ORDER BY u.department ASC, u.full_name ASC
    `,
    [attendanceDate, ...params]
  );

  return rows.map(mapAttendance);
}
