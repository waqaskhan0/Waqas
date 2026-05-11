import { query } from "../../config/db.js";
import { ApiError } from "../../utils/apiError.js";

const columnMap = {
  todo: "TODO",
  pending: "IN_PROGRESS",
  "in-progress": "IN_PROGRESS",
  in_progress: "IN_PROGRESS",
  done: "DONE"
};

function normalizeColumn(value) {
  return columnMap[String(value ?? "todo").trim().toLowerCase()] ?? "TODO";
}

function mapColumn(value) {
  if (value === "IN_PROGRESS") {
    return "pending";
  }

  return String(value ?? "TODO").toLowerCase();
}

function mapTask(row) {
  return {
    id: row.id,
    title: row.title,
    col: mapColumn(row.column_key),
    column: row.column_key,
    due: row.due_date,
    dueDate: row.due_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function parseTaskPayload(payload, partial = false) {
  const title = String(payload.title ?? "").trim();
  const column = normalizeColumn(payload.column ?? payload.col);
  const dueDate = String(payload.dueDate ?? payload.due ?? "").slice(0, 10) || null;

  if (!partial || title) {
    if (!title || title.length > 180) {
      throw new ApiError(400, "Task title is required and must be 180 characters or fewer.");
    }
  }

  return {
    title: title || null,
    column,
    dueDate
  };
}

export async function listMyTasks(userId) {
  const rows = await query(
    `
      SELECT id, title, column_key, due_date, created_at, updated_at
      FROM work_tasks
      WHERE user_id = ?
      ORDER BY
        CASE column_key
          WHEN 'TODO' THEN 0
          WHEN 'IN_PROGRESS' THEN 1
          WHEN 'DONE' THEN 2
          ELSE 3
        END,
        COALESCE(due_date, '9999-12-31') ASC,
        created_at DESC
    `,
    [userId]
  );

  return rows.map(mapTask);
}

export async function createTask(userId, rawPayload) {
  const payload = parseTaskPayload(rawPayload);
  const result = await query(
    `
      INSERT INTO work_tasks (
        user_id,
        title,
        column_key,
        due_date
      )
      VALUES (?, ?, ?, ?)
    `,
    [userId, payload.title, payload.column, payload.dueDate]
  );

  const rows = await query(
    `
      SELECT id, title, column_key, due_date, created_at, updated_at
      FROM work_tasks
      WHERE id = ?
        AND user_id = ?
      LIMIT 1
    `,
    [result.insertId, userId]
  );

  return mapTask(rows[0]);
}

export async function updateTask(userId, taskId, rawPayload) {
  const payload = parseTaskPayload(rawPayload, true);
  const rows = await query(
    `
      SELECT id
      FROM work_tasks
      WHERE id = ?
        AND user_id = ?
      LIMIT 1
    `,
    [taskId, userId]
  );

  if (!rows[0]) {
    throw new ApiError(404, "Task was not found.");
  }

  await query(
    `
      UPDATE work_tasks
      SET title = COALESCE(?, title),
          column_key = ?,
          due_date = ?
      WHERE id = ?
        AND user_id = ?
    `,
    [payload.title, payload.column, payload.dueDate, taskId, userId]
  );

  const updatedRows = await query(
    `
      SELECT id, title, column_key, due_date, created_at, updated_at
      FROM work_tasks
      WHERE id = ?
        AND user_id = ?
      LIMIT 1
    `,
    [taskId, userId]
  );

  return mapTask(updatedRows[0]);
}

export async function deleteTask(userId, taskId) {
  await query(
    `
      DELETE FROM work_tasks
      WHERE id = ?
        AND user_id = ?
    `,
    [taskId, userId]
  );
}
