import { query } from "../../config/db.js";

function parseSettingValue(value) {
  return JSON.stringify(value);
}

export async function listAuditLogs({ userId, module, dateFrom, dateTo, page = 1, limit = 20 } = {}) {
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
  const params = [];
  const filters = ["1 = 1"];

  if (userId) {
    filters.push("al.user_id = ?");
    params.push(Number(userId));
  }

  if (module) {
    filters.push("al.module = ?");
    params.push(module);
  }

  if (dateFrom) {
    filters.push("DATE(al.created_at) >= ?");
    params.push(String(dateFrom).slice(0, 10));
  }

  if (dateTo) {
    filters.push("DATE(al.created_at) <= ?");
    params.push(String(dateTo).slice(0, 10));
  }

  const countRows = await query(
    `
      SELECT COUNT(*) AS total
      FROM audit_logs al
      WHERE ${filters.join(" AND ")}
    `,
    params
  );

  const rows = await query(
    `
      SELECT
        al.id,
        al.user_id,
        al.action,
        al.module,
        al.ip_address,
        al.metadata_json,
        al.created_at,
        u.full_name,
        u.role_code
      FROM audit_logs al
      LEFT JOIN users u ON u.id = al.user_id
      WHERE ${filters.join(" AND ")}
      ORDER BY al.created_at DESC, al.id DESC
      LIMIT ? OFFSET ?
    `,
    [...params, safeLimit, (safePage - 1) * safeLimit]
  );

  return {
    logs: rows.map((row) => ({
      id: row.id,
      time: row.created_at,
      userId: row.user_id,
      user: row.full_name ?? "System",
      role: row.role_code ?? "SYSTEM",
      action: row.action,
      module: row.module,
      ip: row.ip_address,
      metadata: typeof row.metadata_json === "string" ? JSON.parse(row.metadata_json) : row.metadata_json
    })),
    pagination: {
      page: safePage,
      limit: safeLimit,
      total: Number(countRows[0]?.total ?? 0)
    }
  };
}

export async function getSettings() {
  const rows = await query(
    `
      SELECT setting_key, setting_value
      FROM system_settings
      ORDER BY setting_key ASC
    `
  );

  return rows.reduce((settings, row) => {
    settings[row.setting_key] =
      typeof row.setting_value === "string" ? JSON.parse(row.setting_value) : row.setting_value;
    return settings;
  }, {});
}

export async function updateSettings(userId, payload) {
  const allowedKeys = [
    "companyName",
    "currency",
    "workingDays",
    "annualLeaveDays",
    "sickLeaveDays",
    "casualLeaveDays",
    "maxAdvanceMonths",
    "maxReimbursementPerMonth"
  ];

  for (const key of allowedKeys) {
    if (!Object.prototype.hasOwnProperty.call(payload, key)) {
      continue;
    }

    await query(
      `
        INSERT INTO system_settings (
          setting_key,
          setting_value,
          updated_by_user_id
        )
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE
          setting_value = VALUES(setting_value),
          updated_by_user_id = VALUES(updated_by_user_id)
      `,
      [key, parseSettingValue(payload[key]), userId]
    );
  }

  return getSettings();
}
