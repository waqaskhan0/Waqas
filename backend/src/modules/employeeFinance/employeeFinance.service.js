import { query } from "../../config/db.js";
import { ApiError } from "../../utils/apiError.js";
import { sendUserNotification } from "../notifications/notifications.service.js";

function parsePositiveMoney(value, fieldName) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new ApiError(400, `${fieldName} must be greater than zero.`);
  }

  return Number(parsed.toFixed(2));
}

function normalizeText(value, fieldName, maxLength) {
  const normalized = String(value ?? "").trim();

  if (!normalized || normalized.length > maxLength) {
    throw new ApiError(400, `${fieldName} is required and must be ${maxLength} characters or fewer.`);
  }

  return normalized;
}

function mapAdvance(row) {
  return {
    id: row.id,
    userId: row.user_id,
    employee: row.full_name,
    amount: Number(row.amount),
    approvedAmount: row.approved_amount === null ? null : Number(row.approved_amount),
    reason: row.reason,
    repaymentMonths: row.repayment_months,
    repayment: `${row.repayment_months} months`,
    status: String(row.status).toLowerCase(),
    financeNote: row.finance_note,
    createdAt: row.created_at
  };
}

function mapReimbursement(row) {
  return {
    id: row.id,
    userId: row.user_id,
    employee: row.full_name,
    type: row.claim_type,
    amount: Number(row.amount),
    expenseDate: row.expense_date,
    date: row.expense_date,
    description: row.description,
    receiptReference: row.receipt_reference,
    receiptFilePath: row.receipt_file_path,
    status: String(row.status).toLowerCase(),
    financeNote: row.finance_note,
    createdAt: row.created_at
  };
}

export async function createAdvanceRequest(user, payload) {
  const amount = parsePositiveMoney(payload.amount, "Amount");
  const reason = normalizeText(payload.reason, "Reason", 1000);
  const repaymentMonths = Number(payload.repaymentMonths ?? payload.repayment ?? 1);

  if (!Number.isInteger(repaymentMonths) || repaymentMonths <= 0 || repaymentMonths > 60) {
    throw new ApiError(400, "Repayment months must be between 1 and 60.");
  }

  const result = await query(
    `
      INSERT INTO advance_requests (
        user_id,
        amount,
        reason,
        repayment_months
      )
      VALUES (?, ?, ?, ?)
    `,
    [user.id, amount, reason, repaymentMonths]
  );

  return getAdvanceById(result.insertId);
}

async function getAdvanceById(id) {
  const rows = await query(
    `
      SELECT ar.*, u.full_name
      FROM advance_requests ar
      INNER JOIN users u ON u.id = ar.user_id
      WHERE ar.id = ?
      LIMIT 1
    `,
    [id]
  );

  return rows[0] ? mapAdvance(rows[0]) : null;
}

export async function listMyAdvances(userId) {
  const rows = await query(
    `
      SELECT ar.*, u.full_name
      FROM advance_requests ar
      INNER JOIN users u ON u.id = ar.user_id
      WHERE ar.user_id = ?
      ORDER BY ar.created_at DESC, ar.id DESC
    `,
    [userId]
  );

  return rows.map(mapAdvance);
}

export async function listAllAdvances() {
  const rows = await query(
    `
      SELECT ar.*, u.full_name
      FROM advance_requests ar
      INNER JOIN users u ON u.id = ar.user_id
      ORDER BY
        CASE ar.status WHEN 'PENDING' THEN 0 ELSE 1 END,
        ar.created_at DESC
    `
  );

  return rows.map(mapAdvance);
}

export async function decideAdvance(financeUser, advanceId, payload) {
  const action = String(payload.action ?? "").trim().toLowerCase();
  const note = String(payload.note ?? payload.remarks ?? "").trim();

  if (!["approve", "reject"].includes(action)) {
    throw new ApiError(400, "Action must be approve or reject.");
  }

  if (action === "reject" && !note) {
    throw new ApiError(400, "A rejection reason is required.");
  }

  const rows = await query(
    `
      SELECT ar.*, u.full_name
      FROM advance_requests ar
      INNER JOIN users u ON u.id = ar.user_id
      WHERE ar.id = ?
      LIMIT 1
    `,
    [advanceId]
  );
  const advance = rows[0];

  if (!advance) {
    throw new ApiError(404, "Advance request was not found.");
  }

  if (advance.status !== "PENDING") {
    throw new ApiError(409, "Only pending advance requests can be processed.");
  }

  const approvedAmount =
    action === "approve"
      ? parsePositiveMoney(payload.approvedAmount ?? advance.amount, "Approved amount")
      : null;

  await query(
    `
      UPDATE advance_requests
      SET status = ?,
          approved_amount = ?,
          finance_note = ?,
          processed_by_user_id = ?,
          processed_at = NOW()
      WHERE id = ?
    `,
    [action === "approve" ? "APPROVED" : "REJECTED", approvedAmount, note || null, financeUser.id, advanceId]
  );

  await sendUserNotification({
    userId: advance.user_id,
    subject:
      action === "approve"
        ? "Your advance request was approved"
        : "Your advance request was rejected",
    message:
      action === "approve"
        ? `Your advance request of PKR ${Number(approvedAmount).toLocaleString()} has been approved.`
        : note,
    eventType: action === "approve" ? "ADVANCE_APPROVED" : "ADVANCE_REJECTED",
    entityType: "ADVANCE",
    entityId: advanceId,
    triggeredByUserId: financeUser.id
  });

  return getAdvanceById(advanceId);
}

export async function createReimbursementClaim(user, payload) {
  const amount = parsePositiveMoney(payload.amount, "Amount");
  const claimType = normalizeText(payload.type ?? payload.claimType, "Claim type", 80);
  const description = normalizeText(payload.description, "Description", 1200);
  const expenseDate = String(payload.date ?? payload.expenseDate ?? "").slice(0, 10) || null;
  const receiptReference = String(payload.receipt ?? payload.receiptReference ?? "").trim() || null;
  const receiptFilePath = String(payload.receiptFilePath ?? "").trim() || null;

  const result = await query(
    `
      INSERT INTO reimbursement_claims (
        user_id,
        claim_type,
        amount,
        expense_date,
        description,
        receipt_reference,
        receipt_file_path
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    [user.id, claimType, amount, expenseDate, description, receiptReference, receiptFilePath]
  );

  return getReimbursementById(result.insertId);
}

async function getReimbursementById(id) {
  const rows = await query(
    `
      SELECT rc.*, u.full_name
      FROM reimbursement_claims rc
      INNER JOIN users u ON u.id = rc.user_id
      WHERE rc.id = ?
      LIMIT 1
    `,
    [id]
  );

  return rows[0] ? mapReimbursement(rows[0]) : null;
}

export async function listMyReimbursements(userId) {
  const rows = await query(
    `
      SELECT rc.*, u.full_name
      FROM reimbursement_claims rc
      INNER JOIN users u ON u.id = rc.user_id
      WHERE rc.user_id = ?
      ORDER BY rc.created_at DESC, rc.id DESC
    `,
    [userId]
  );

  return rows.map(mapReimbursement);
}

export async function listAllReimbursements() {
  const rows = await query(
    `
      SELECT rc.*, u.full_name
      FROM reimbursement_claims rc
      INNER JOIN users u ON u.id = rc.user_id
      ORDER BY
        CASE rc.status WHEN 'PENDING' THEN 0 ELSE 1 END,
        rc.created_at DESC
    `
  );

  return rows.map(mapReimbursement);
}

export async function decideReimbursement(financeUser, claimId, payload) {
  const action = String(payload.action ?? "").trim().toLowerCase();
  const note = String(payload.note ?? payload.remarks ?? "").trim();

  if (!["approve", "reject"].includes(action)) {
    throw new ApiError(400, "Action must be approve or reject.");
  }

  if (action === "reject" && !note) {
    throw new ApiError(400, "A rejection reason is required.");
  }

  const rows = await query(
    `
      SELECT rc.*, u.full_name
      FROM reimbursement_claims rc
      INNER JOIN users u ON u.id = rc.user_id
      WHERE rc.id = ?
      LIMIT 1
    `,
    [claimId]
  );
  const claim = rows[0];

  if (!claim) {
    throw new ApiError(404, "Reimbursement claim was not found.");
  }

  if (claim.status !== "PENDING") {
    throw new ApiError(409, "Only pending reimbursement claims can be processed.");
  }

  await query(
    `
      UPDATE reimbursement_claims
      SET status = ?,
          finance_note = ?,
          processed_by_user_id = ?,
          processed_at = NOW()
      WHERE id = ?
    `,
    [action === "approve" ? "APPROVED" : "REJECTED", note || null, financeUser.id, claimId]
  );

  await sendUserNotification({
    userId: claim.user_id,
    subject:
      action === "approve"
        ? "Your reimbursement was approved"
        : "Your reimbursement was rejected",
    message:
      action === "approve"
        ? `Your reimbursement claim of PKR ${Number(claim.amount).toLocaleString()} has been approved.`
        : note,
    eventType: action === "approve" ? "REIMBURSEMENT_APPROVED" : "REIMBURSEMENT_REJECTED",
    entityType: "REIMBURSEMENT",
    entityId: claimId,
    triggeredByUserId: financeUser.id
  });

  return getReimbursementById(claimId);
}
