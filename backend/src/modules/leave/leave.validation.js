import { ApiError } from "../../utils/apiError.js";

const allowedTypes = new Set([
  "Annual Leave",
  "Sick Leave",
  "Casual Leave",
  "Maternity/Paternity"
]);

function parseDate(value, fieldName) {
  const normalized = String(value ?? "").slice(0, 10);
  const date = new Date(`${normalized}T00:00:00`);

  if (!normalized || Number.isNaN(date.getTime())) {
    throw new ApiError(400, `${fieldName} must be a valid date.`);
  }

  return normalized;
}

export function parseLeaveRequestPayload(payload) {
  const leaveType = String(payload.type ?? payload.leaveType ?? "").trim();
  const startDate = parseDate(payload.start ?? payload.startDate, "Start date");
  const endDate = parseDate(payload.end ?? payload.endDate, "End date");
  const reason = String(payload.reason ?? "").trim();
  const handoverPerson = String(payload.handover ?? payload.handoverPerson ?? "").trim();
  const days = Number(payload.days ?? 0);

  if (!allowedTypes.has(leaveType)) {
    throw new ApiError(400, "Leave type is invalid.");
  }

  if (new Date(`${endDate}T00:00:00`) < new Date(`${startDate}T00:00:00`)) {
    throw new ApiError(400, "End date cannot be earlier than start date.");
  }

  if (!Number.isFinite(days) || days <= 0) {
    throw new ApiError(400, "Leave days must be greater than zero.");
  }

  if (!reason || reason.length > 1000) {
    throw new ApiError(400, "Reason is required and must be 1000 characters or fewer.");
  }

  return {
    leaveType,
    startDate,
    endDate,
    days: Number(days.toFixed(2)),
    reason,
    handoverPerson: handoverPerson || null
  };
}

export function parseLeaveDecisionPayload(payload) {
  const action = String(payload.action ?? "").trim().toLowerCase();
  const note = String(payload.note ?? payload.remarks ?? "").trim();

  if (!["approve", "reject"].includes(action)) {
    throw new ApiError(400, "Action must be approve or reject.");
  }

  if (action === "reject" && !note) {
    throw new ApiError(400, "A rejection reason is required.");
  }

  if (note.length > 500) {
    throw new ApiError(400, "Decision note must be 500 characters or fewer.");
  }

  return { action, note: note || null };
}
