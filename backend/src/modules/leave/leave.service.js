import { getPool, query } from "../../config/db.js";
import { ROLES } from "../../config/roles.js";
import { ApiError } from "../../utils/apiError.js";
import {
  sendRoleNotification,
  sendUserNotification
} from "../notifications/notifications.service.js";

const defaultBalances = {
  "Annual Leave": 20,
  "Sick Leave": 10,
  "Casual Leave": 5,
  "Maternity/Paternity": 0
};

function mapLeave(row) {
  return {
    id: row.id,
    userId: row.user_id,
    managerId: row.manager_id,
    type: row.leave_type,
    startDate: row.start_date,
    endDate: row.end_date,
    days: Number(row.days),
    handoverPerson: row.handover_person,
    reason: row.reason,
    status: row.status,
    managerNote: row.manager_note,
    hrNote: row.hr_note,
    createdAt: row.created_at,
    employee: row.employee_name
      ? {
          id: row.user_id,
          fullName: row.employee_name,
          email: row.employee_email,
          department: row.employee_department
        }
      : undefined,
    manager: row.manager_name
      ? {
          id: row.manager_id,
          fullName: row.manager_name
        }
      : undefined
  };
}

function mapBalance(row) {
  return {
    type: row.leave_type,
    total: Number(row.total_days),
    used: Number(row.used_days),
    remaining: Number((Number(row.total_days) - Number(row.used_days)).toFixed(2))
  };
}

async function ensureBalances(userId) {
  for (const [leaveType, totalDays] of Object.entries(defaultBalances)) {
    await query(
      `
        INSERT INTO leave_balances (
          user_id,
          leave_type,
          total_days,
          used_days
        )
        VALUES (?, ?, ?, 0)
        ON DUPLICATE KEY UPDATE total_days = total_days
      `,
      [userId, leaveType, totalDays]
    );
  }
}

export async function getLeaveBalances(userId) {
  await ensureBalances(userId);
  const rows = await query(
    `
      SELECT leave_type, total_days, used_days
      FROM leave_balances
      WHERE user_id = ?
      ORDER BY FIELD(leave_type, 'Annual Leave', 'Sick Leave', 'Casual Leave', 'Maternity/Paternity')
    `,
    [userId]
  );

  return rows.map(mapBalance);
}

async function hasOverlappingLeave(userId, startDate, endDate) {
  const rows = await query(
    `
      SELECT id
      FROM leave_requests
      WHERE user_id = ?
        AND status IN ('PENDING_MANAGER', 'PENDING_HR', 'APPROVED')
        AND start_date <= ?
        AND end_date >= ?
      LIMIT 1
    `,
    [userId, endDate, startDate]
  );

  return Boolean(rows[0]);
}

export async function createLeaveRequest(user, payload) {
  if (!user.managerId) {
    throw new ApiError(400, "Your account must have a line manager before applying for leave.");
  }

  if (await hasOverlappingLeave(user.id, payload.startDate, payload.endDate)) {
    throw new ApiError(409, "You already have a leave request overlapping these dates.");
  }

  const balances = await getLeaveBalances(user.id);
  const balance = balances.find((item) => item.type === payload.leaveType);

  if (balance && payload.days > balance.remaining) {
    throw new ApiError(400, "Leave request exceeds the available balance.");
  }

  const result = await query(
    `
      INSERT INTO leave_requests (
        user_id,
        manager_id,
        leave_type,
        start_date,
        end_date,
        days,
        handover_person,
        reason
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      user.id,
      user.managerId,
      payload.leaveType,
      payload.startDate,
      payload.endDate,
      payload.days,
      payload.handoverPerson,
      payload.reason
    ]
  );

  await sendUserNotification({
    userId: user.managerId,
    subject: `Leave approval needed from ${user.fullName}`,
    message: `${user.fullName} requested ${payload.days} day(s) of ${payload.leaveType}.`,
    eventType: "LEAVE_SUBMITTED",
    entityType: "LEAVE",
    entityId: result.insertId,
    triggeredByUserId: user.id
  });

  return getLeaveById(result.insertId);
}

async function getLeaveById(leaveId) {
  const rows = await query(
    `
      SELECT
        lr.*,
        employee.full_name AS employee_name,
        employee.email AS employee_email,
        employee.department AS employee_department,
        manager.full_name AS manager_name
      FROM leave_requests lr
      INNER JOIN users employee ON employee.id = lr.user_id
      LEFT JOIN users manager ON manager.id = lr.manager_id
      WHERE lr.id = ?
      LIMIT 1
    `,
    [leaveId]
  );

  return rows[0] ? mapLeave(rows[0]) : null;
}

export async function listMyLeaves(userId) {
  const rows = await query(
    `
      SELECT
        lr.*,
        employee.full_name AS employee_name,
        employee.email AS employee_email,
        employee.department AS employee_department,
        manager.full_name AS manager_name
      FROM leave_requests lr
      INNER JOIN users employee ON employee.id = lr.user_id
      LEFT JOIN users manager ON manager.id = lr.manager_id
      WHERE lr.user_id = ?
      ORDER BY lr.created_at DESC, lr.id DESC
    `,
    [userId]
  );

  return rows.map(mapLeave);
}

export async function listTeamLeaves(managerId) {
  const rows = await query(
    `
      SELECT
        lr.*,
        employee.full_name AS employee_name,
        employee.email AS employee_email,
        employee.department AS employee_department,
        manager.full_name AS manager_name
      FROM leave_requests lr
      INNER JOIN users employee ON employee.id = lr.user_id
      LEFT JOIN users manager ON manager.id = lr.manager_id
      WHERE lr.manager_id = ?
      ORDER BY
        CASE lr.status
          WHEN 'PENDING_MANAGER' THEN 0
          WHEN 'PENDING_HR' THEN 1
          ELSE 2
        END,
        lr.created_at DESC
    `,
    [managerId]
  );

  return rows.map(mapLeave);
}

export async function listAllLeaves({ status, search } = {}) {
  const params = [];
  const filters = ["1 = 1"];

  if (status) {
    filters.push("lr.status = ?");
    params.push(status);
  }

  if (search) {
    filters.push("employee.full_name LIKE ?");
    params.push(`%${search}%`);
  }

  const rows = await query(
    `
      SELECT
        lr.*,
        employee.full_name AS employee_name,
        employee.email AS employee_email,
        employee.department AS employee_department,
        manager.full_name AS manager_name
      FROM leave_requests lr
      INNER JOIN users employee ON employee.id = lr.user_id
      LEFT JOIN users manager ON manager.id = lr.manager_id
      WHERE ${filters.join(" AND ")}
      ORDER BY
        CASE lr.status
          WHEN 'PENDING_HR' THEN 0
          WHEN 'PENDING_MANAGER' THEN 1
          ELSE 2
        END,
        lr.created_at DESC
    `,
    params
  );

  return rows.map(mapLeave);
}

async function getLeaveForUpdate(connection, leaveId) {
  const [rows] = await connection.execute(
    `
      SELECT
        lr.*,
        employee.full_name AS employee_name,
        employee.email AS employee_email
      FROM leave_requests lr
      INNER JOIN users employee ON employee.id = lr.user_id
      WHERE lr.id = ?
      FOR UPDATE
    `,
    [leaveId]
  );

  return rows[0] ?? null;
}

export async function decideLeaveAsManager(managerUser, leaveId, { action, note }) {
  const pool = getPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const leave = await getLeaveForUpdate(connection, leaveId);

    if (!leave) {
      throw new ApiError(404, "Leave request was not found.");
    }

    if (leave.manager_id !== managerUser.id) {
      throw new ApiError(403, "This leave request is not assigned to you.");
    }

    if (leave.status !== "PENDING_MANAGER") {
      throw new ApiError(409, "Only manager-pending leave can be processed here.");
    }

    const nextStatus = action === "approve" ? "PENDING_HR" : "REJECTED";
    await connection.execute(
      `
        UPDATE leave_requests
        SET status = ?,
            manager_note = ?,
            manager_action_by = ?,
            manager_action_at = NOW()
        WHERE id = ?
      `,
      [nextStatus, note, managerUser.id, leaveId]
    );

    await connection.commit();

    if (action === "approve") {
      await sendRoleNotification({
        role: ROLES.HR_OFFICER,
        subject: `Final leave approval needed for ${leave.employee_name}`,
        message: `${managerUser.fullName} approved a ${leave.leave_type} request. HR final action is required.`,
        eventType: "LEAVE_PENDING_HR",
        entityType: "LEAVE",
        entityId: leaveId,
        triggeredByUserId: managerUser.id
      });
    } else {
      await sendUserNotification({
        userId: leave.user_id,
        subject: "Your leave request was rejected",
        message: note,
        eventType: "LEAVE_REJECTED",
        entityType: "LEAVE",
        entityId: leaveId,
        triggeredByUserId: managerUser.id
      });
    }

    return getLeaveById(leaveId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function decideLeaveAsHr(hrUser, leaveId, { action, note }) {
  const pool = getPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const leave = await getLeaveForUpdate(connection, leaveId);

    if (!leave) {
      throw new ApiError(404, "Leave request was not found.");
    }

    if (leave.status !== "PENDING_HR") {
      throw new ApiError(409, "Only HR-pending leave can be processed here.");
    }

    const nextStatus = action === "approve" ? "APPROVED" : "REJECTED";
    await connection.execute(
      `
        UPDATE leave_requests
        SET status = ?,
            hr_note = ?,
            hr_action_by = ?,
            hr_action_at = NOW()
        WHERE id = ?
      `,
      [nextStatus, note, hrUser.id, leaveId]
    );

    if (action === "approve") {
      await connection.execute(
        `
          INSERT INTO leave_balances (
            user_id,
            leave_type,
            total_days,
            used_days
          )
          VALUES (?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE used_days = used_days + VALUES(used_days)
        `,
        [
          leave.user_id,
          leave.leave_type,
          defaultBalances[leave.leave_type] ?? 0,
          Number(leave.days)
        ]
      );

      await connection.execute(
        `
          INSERT INTO attendance (
            user_id,
            attendance_date,
            status,
            source
          )
          SELECT ?, calendar_date, 'ON_LEAVE', 'LEAVE'
          FROM (
            SELECT DATE_ADD(?, INTERVAL ones.n + tens.n * 10 DAY) AS calendar_date
            FROM
              (SELECT 0 n UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9) ones
              CROSS JOIN
              (SELECT 0 n UNION SELECT 1 UNION SELECT 2 UNION SELECT 3) tens
          ) dates
          WHERE calendar_date BETWEEN ? AND ?
          ON DUPLICATE KEY UPDATE status = 'ON_LEAVE', updated_at = CURRENT_TIMESTAMP
        `,
        [leave.user_id, leave.start_date, leave.start_date, leave.end_date]
      );
    }

    await connection.commit();

    await sendUserNotification({
      userId: leave.user_id,
      subject: action === "approve" ? "Your leave request was approved" : "Your leave request was rejected",
      message:
        action === "approve"
          ? "Your leave request has been approved. Enjoy your time off!"
          : note,
      eventType: action === "approve" ? "LEAVE_APPROVED" : "LEAVE_REJECTED",
      entityType: "LEAVE",
      entityId: leaveId,
      triggeredByUserId: hrUser.id
    });

    return getLeaveById(leaveId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
