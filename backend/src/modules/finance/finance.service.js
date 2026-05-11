import { getPool, query } from "../../config/db.js";
import { sendFinanceMatchNotification } from "../notifications/notifications.service.js";
import { sendRoleNotification } from "../notifications/notifications.service.js";
import { getRequisitionByIdForUser } from "../requisitions/requisitions.service.js";
import { ApiError } from "../../utils/apiError.js";
import { ROLES } from "../../config/roles.js";

function roundMoney(value) {
  return Number(Number(value).toFixed(2));
}

function amountsMatch(left, right) {
  return roundMoney(left) === roundMoney(right);
}

function mapFinanceQueueItem(row) {
  return {
    id: row.id,
    poNumber: row.po_number,
    requisitionId: row.requisition_id,
    requisitionNumber: row.requisition_number,
    title: row.title,
    purchaseOrderStatus: row.purchase_order_status,
    orderDate: row.order_date,
    expectedDeliveryDate: row.expected_delivery_date,
    receiptCount: Number(row.receipt_count ?? 0),
    poAmount: Number(row.po_amount ?? 0),
    receivedAmount: Number(row.received_amount ?? 0),
    latestFinanceStatus: row.latest_finance_status,
    latestInvoiceNumber: row.latest_invoice_number,
    latestReviewedAt: row.latest_reviewed_at,
    vendor: {
      vendorName: row.vendor_name
    },
    requester: {
      fullName: row.requester_name,
      department: row.requester_department
    }
  };
}

export async function listFinanceQueue() {
  const rows = await query(
    `
      SELECT
        po.id,
        po.po_number,
        po.requisition_id,
        po.status AS purchase_order_status,
        po.order_date,
        po.expected_delivery_date,
        r.requisition_number,
        r.title,
        requester.full_name AS requester_name,
        requester.department AS requester_department,
        vendor.vendor_name,
        (
          SELECT COUNT(*)
          FROM goods_receipts gr
          WHERE gr.purchase_order_id = po.id
        ) AS receipt_count,
        po.subtotal_amount AS po_amount,
        (
          SELECT COALESCE(SUM(pol2.quantity_received * pol2.unit_price), 0)
          FROM purchase_order_lines pol2
          WHERE pol2.purchase_order_id = po.id
        ) AS received_amount,
        latest_match.invoice_number AS latest_invoice_number,
        latest_match.status AS latest_finance_status,
        latest_match.created_at AS latest_reviewed_at
      FROM purchase_orders po
      INNER JOIN requisitions r ON r.id = po.requisition_id
      INNER JOIN users requester ON requester.id = r.requested_by_user_id
      INNER JOIN vendors vendor ON vendor.id = po.vendor_id
      LEFT JOIN finance_matches latest_match ON latest_match.id = (
        SELECT fm2.id
        FROM finance_matches fm2
        WHERE fm2.purchase_order_id = po.id
        ORDER BY fm2.created_at DESC, fm2.id DESC
        LIMIT 1
      )
      WHERE po.status = 'RECEIVED'
        AND NOT EXISTS (
          SELECT 1
          FROM finance_matches fm
          WHERE fm.purchase_order_id = po.id
            AND fm.status = 'MATCHED'
        )
      ORDER BY
        CASE
          WHEN latest_match.status = 'MISMATCH' THEN 0
          ELSE 1
        END,
        po.order_date DESC,
        po.id DESC
    `
  );

  return rows.map(mapFinanceQueueItem);
}

async function getPurchaseOrderForFinance(connection, purchaseOrderId) {
  const [rows] = await connection.execute(
    `
      SELECT
        po.id,
        po.po_number,
        po.requisition_id,
        po.status,
        po.subtotal_amount,
        r.requisition_number,
        r.requested_by_user_id,
        requester.full_name AS requester_name,
        requester.email AS requester_email
      FROM purchase_orders po
      INNER JOIN requisitions r ON r.id = po.requisition_id
      INNER JOIN users requester ON requester.id = r.requested_by_user_id
      WHERE po.id = ?
      FOR UPDATE
    `,
    [purchaseOrderId]
  );

  return rows[0] ?? null;
}

async function getPurchaseOrderLinesForFinance(connection, purchaseOrderId) {
  const [rows] = await connection.execute(
    `
      SELECT
        pol.id,
        pol.requisition_item_id,
        pol.line_number,
        pol.item_description,
        pol.unit,
        pol.quantity_ordered,
        pol.quantity_received,
        pol.unit_price,
        pol.line_total
      FROM purchase_order_lines pol
      WHERE pol.purchase_order_id = ?
      ORDER BY pol.line_number ASC
      FOR UPDATE
    `,
    [purchaseOrderId]
  );

  return rows.map((row) => ({
    id: row.id,
    requisitionItemId: row.requisition_item_id,
    lineNumber: row.line_number,
    itemDescription: row.item_description,
    unit: row.unit,
    quantityOrdered: Number(row.quantity_ordered),
    quantityReceived: Number(row.quantity_received),
    unitPrice: Number(row.unit_price),
    lineTotal: Number(row.line_total)
  }));
}

async function hasMatchedFinanceRecord(connection, purchaseOrderId) {
  const [rows] = await connection.execute(
    `
      SELECT id
      FROM finance_matches
      WHERE purchase_order_id = ?
        AND status = 'MATCHED'
      LIMIT 1
      FOR UPDATE
    `,
    [purchaseOrderId]
  );

  return Boolean(rows[0]);
}

export async function createFinanceMatch(financeUser, purchaseOrderId, payload) {
  const pool = getPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const purchaseOrder = await getPurchaseOrderForFinance(connection, purchaseOrderId);

    if (!purchaseOrder) {
      throw new ApiError(404, "Purchase order was not found.");
    }

    if (purchaseOrder.status !== "RECEIVED") {
      throw new ApiError(
        409,
        "Only fully received purchase orders are ready for finance 3-way matching."
      );
    }

    if (await hasMatchedFinanceRecord(connection, purchaseOrderId)) {
      throw new ApiError(409, "This purchase order is already matched in finance.");
    }

    const purchaseOrderLines = await getPurchaseOrderLinesForFinance(connection, purchaseOrderId);

    if (!purchaseOrderLines.length) {
      throw new ApiError(409, "This purchase order has no lines to match.");
    }

    if (payload.lines.length !== purchaseOrderLines.length) {
      throw new ApiError(
        400,
        "Finance match lines must be provided for every purchase order line."
      );
    }

    const purchaseOrderLineMap = new Map(
      purchaseOrderLines.map((line) => [line.id, line])
    );
    const seenLineIds = new Set();
    const lineResults = [];

    for (const line of payload.lines) {
      const purchaseOrderLine = purchaseOrderLineMap.get(line.purchaseOrderLineId);

      if (!purchaseOrderLine) {
        throw new ApiError(
          400,
          `Purchase order line ${line.purchaseOrderLineId} does not belong to this purchase order.`
        );
      }

      if (seenLineIds.has(line.purchaseOrderLineId)) {
        throw new ApiError(400, "Each purchase order line can only appear once.");
      }

      seenLineIds.add(line.purchaseOrderLineId);

      const lineTotal = roundMoney(line.quantityBilled * line.unitPrice);
      const expectedLineTotal = roundMoney(
        purchaseOrderLine.quantityReceived * purchaseOrderLine.unitPrice
      );
      const lineStatus =
        amountsMatch(line.quantityBilled, purchaseOrderLine.quantityReceived) &&
        amountsMatch(line.unitPrice, purchaseOrderLine.unitPrice) &&
        amountsMatch(lineTotal, expectedLineTotal)
          ? "MATCHED"
          : "MISMATCH";

      lineResults.push({
        purchaseOrderLineId: line.purchaseOrderLineId,
        lineNumber: purchaseOrderLine.lineNumber,
        quantityBilled: line.quantityBilled,
        unitPrice: line.unitPrice,
        lineTotal,
        expectedQuantity: purchaseOrderLine.quantityReceived,
        expectedUnitPrice: purchaseOrderLine.unitPrice,
        expectedLineTotal,
        status: lineStatus
      });
    }

    const invoiceAmount = roundMoney(
      lineResults.reduce((total, line) => total + line.lineTotal, 0)
    );
    const poAmount = roundMoney(
      purchaseOrderLines.reduce((total, line) => total + line.lineTotal, 0)
    );
    const receivedAmount = roundMoney(
      purchaseOrderLines.reduce(
        (total, line) => total + line.quantityReceived * line.unitPrice,
        0
      )
    );
    const varianceAmount = roundMoney(invoiceAmount - receivedAmount);
    const status =
      lineResults.every((line) => line.status === "MATCHED") &&
      amountsMatch(invoiceAmount, poAmount) &&
      amountsMatch(invoiceAmount, receivedAmount)
        ? "MATCHED"
        : "MISMATCH";

    const [matchResult] = await connection.execute(
      `
        INSERT INTO finance_matches (
          purchase_order_id,
          finance_user_id,
          invoice_number,
          invoice_date,
          invoice_amount,
          po_amount,
          received_amount,
          variance_amount,
          status,
          remarks
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        purchaseOrderId,
        financeUser.id,
        payload.invoiceNumber,
        payload.invoiceDate,
        invoiceAmount,
        poAmount,
        receivedAmount,
        varianceAmount,
        status,
        payload.remarks
      ]
    );

    const financeMatchId = matchResult.insertId;

    for (const line of lineResults) {
      await connection.execute(
        `
          INSERT INTO finance_match_lines (
            finance_match_id,
            purchase_order_line_id,
            line_number,
            quantity_billed,
            unit_price,
            line_total,
            expected_quantity,
            expected_unit_price,
            expected_line_total,
            status
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          financeMatchId,
          line.purchaseOrderLineId,
          line.lineNumber,
          line.quantityBilled,
          line.unitPrice,
          line.lineTotal,
          line.expectedQuantity,
          line.expectedUnitPrice,
          line.expectedLineTotal,
          line.status
        ]
      );
    }

    await connection.execute(
      `
        INSERT INTO approval_logs (
          requisition_id,
          actor_user_id,
          action,
          remarks
        )
        VALUES (?, ?, 'COMMENTED', ?)
      `,
      [
        purchaseOrder.requisition_id,
        financeUser.id,
        `Finance ${status.toLowerCase()} invoice ${payload.invoiceNumber} against ${purchaseOrder.po_number}. ${payload.remarks}`.trim()
      ]
    );

    await connection.commit();

    const requisition = await getRequisitionByIdForUser(purchaseOrder.requisition_id, financeUser);
    const financeMatch =
      requisition.financeMatches.find((match) => match.id === financeMatchId) ?? null;
    const notification = await sendFinanceMatchNotification({
      requisitionId: purchaseOrder.requisition_id,
      requisitionNumber: purchaseOrder.requisition_number,
      poId: purchaseOrderId,
      poNumber: purchaseOrder.po_number,
      invoiceNumber: payload.invoiceNumber,
      status,
      recipientUserId: purchaseOrder.requested_by_user_id,
      recipientEmail: purchaseOrder.requester_email,
      recipientName: purchaseOrder.requester_name,
      financeUserId: financeUser.id,
      financeUserName: financeUser.fullName,
      varianceAmount
    });

    return {
      requisition,
      financeMatch,
      notification
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

function mapPendingPayment(row) {
  return {
    id: row.id,
    poNumber: row.po_number,
    vendor: row.vendor_name,
    vendorName: row.vendor_name,
    grnReceivedAt: row.latest_grn_at,
    totalAmount: Number(row.subtotal_amount),
    status: row.status,
    paymentStatus: row.payment_id ? "paid" : "pending"
  };
}

export async function listPendingPayments() {
  const rows = await query(
    `
      SELECT
        po.id,
        po.po_number,
        po.status,
        po.subtotal_amount,
        vendor.vendor_name,
        MAX(gr.received_at) AS latest_grn_at,
        MAX(vp.id) AS payment_id
      FROM purchase_orders po
      INNER JOIN vendors vendor ON vendor.id = po.vendor_id
      INNER JOIN goods_receipts gr ON gr.purchase_order_id = po.id
      LEFT JOIN vendor_payments vp ON vp.purchase_order_id = po.id
      WHERE po.status = 'RECEIVED'
      GROUP BY po.id, po.po_number, po.status, po.subtotal_amount, vendor.vendor_name
      HAVING payment_id IS NULL
      ORDER BY latest_grn_at ASC, po.id ASC
    `
  );

  return rows.map(mapPendingPayment);
}

export async function listPaymentHistory() {
  const rows = await query(
    `
      SELECT
        vp.id,
        vp.payment_date,
        vp.reference,
        vp.amount,
        po.po_number,
        vendor.vendor_name,
        payer.full_name AS paid_by_name
      FROM vendor_payments vp
      INNER JOIN purchase_orders po ON po.id = vp.purchase_order_id
      INNER JOIN vendors vendor ON vendor.id = po.vendor_id
      INNER JOIN users payer ON payer.id = vp.paid_by_user_id
      ORDER BY vp.payment_date DESC, vp.id DESC
    `
  );

  return rows.map((row) => ({
    id: row.id,
    date: row.payment_date,
    category: "Vendor",
    reference: row.reference || row.po_number,
    poNumber: row.po_number,
    payee: row.vendor_name,
    amount: Number(row.amount),
    paidBy: row.paid_by_name,
    status: "paid"
  }));
}

export async function releasePoPayment(financeUser, purchaseOrderId, payload) {
  const amount = Number(payload.amount);
  const paymentDate = String(payload.paymentDate ?? new Date().toISOString().slice(0, 10)).slice(0, 10);
  const reference = String(payload.reference ?? "").trim();

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new ApiError(400, "Payment amount must be greater than zero.");
  }

  if (!reference) {
    throw new ApiError(400, "Payment reference is required.");
  }

  const rows = await query(
    `
      SELECT
        po.id,
        po.po_number,
        po.status,
        po.subtotal_amount,
        vendor.vendor_name
      FROM purchase_orders po
      INNER JOIN vendors vendor ON vendor.id = po.vendor_id
      WHERE po.id = ?
      LIMIT 1
    `,
    [purchaseOrderId]
  );
  const po = rows[0];

  if (!po) {
    throw new ApiError(404, "Purchase order was not found.");
  }

  if (po.status !== "RECEIVED") {
    throw new ApiError(409, "Only fully received purchase orders can be paid.");
  }

  const existing = await query(
    `SELECT id FROM vendor_payments WHERE purchase_order_id = ? LIMIT 1`,
    [purchaseOrderId]
  );

  if (existing[0]) {
    throw new ApiError(409, "Payment has already been released for this purchase order.");
  }

  await query(
    `
      INSERT INTO vendor_payments (
        purchase_order_id,
        paid_by_user_id,
        amount,
        payment_date,
        reference
      )
      VALUES (?, ?, ?, ?, ?)
    `,
    [purchaseOrderId, financeUser.id, Number(amount.toFixed(2)), paymentDate, reference]
  );

  await query(`UPDATE purchase_orders SET status = 'PAID' WHERE id = ?`, [purchaseOrderId]);

  await sendRoleNotification({
    role: ROLES.PROCUREMENT_OFFICER,
    subject: `Payment released for PO ${po.po_number}`,
    message: `Payment of PKR ${Number(amount).toLocaleString()} released for ${po.po_number}.`,
    eventType: "PO_PAYMENT_RELEASED",
    entityType: "PURCHASE_ORDER",
    entityId: purchaseOrderId,
    triggeredByUserId: financeUser.id
  });

  return {
    id: purchaseOrderId,
    poNumber: po.po_number,
    vendorName: po.vendor_name,
    amount: Number(amount.toFixed(2)),
    paymentDate,
    reference,
    status: "PAID"
  };
}

function parsePayrollPeriod(payload) {
  const month = Number(payload.month ?? payload.payrollMonth ?? new Date().getMonth() + 1);
  const year = Number(payload.year ?? payload.payrollYear ?? new Date().getFullYear());

  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new ApiError(400, "Payroll month must be between 1 and 12.");
  }

  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new ApiError(400, "Payroll year is invalid.");
  }

  return { month, year };
}

function mapPayroll(row) {
  return {
    id: row.id,
    userId: row.user_id,
    employee: row.full_name,
    department: row.department,
    month: row.payroll_month,
    year: row.payroll_year,
    basic: Number(row.basic),
    allowances: Number(row.allowances),
    deductions: Number(row.deductions),
    netPay: Number(row.net_pay),
    status: String(row.status).toLowerCase(),
    paidAt: row.paid_at
  };
}

export async function listPayroll(payload = {}) {
  const { month, year } = parsePayrollPeriod(payload);
  const rows = await query(
    `
      SELECT pe.*, u.full_name, u.department
      FROM payroll_entries pe
      INNER JOIN users u ON u.id = pe.user_id
      WHERE pe.payroll_month = ?
        AND pe.payroll_year = ?
      ORDER BY u.full_name ASC
    `,
    [month, year]
  );

  return rows.map(mapPayroll);
}

export async function generatePayroll(payload = {}) {
  const { month, year } = parsePayrollPeriod(payload);
  const users = await query(
    `
      SELECT id, basic_salary
      FROM users
      WHERE status = 'ACTIVE'
      ORDER BY full_name ASC
    `
  );

  for (const user of users) {
    const basic = Number(user.basic_salary ?? 50000);
    await query(
      `
        INSERT INTO payroll_entries (
          user_id,
          payroll_month,
          payroll_year,
          basic,
          allowances,
          deductions,
          net_pay
        )
        VALUES (?, ?, ?, ?, 0, 0, ?)
        ON DUPLICATE KEY UPDATE
          basic = basic,
          net_pay = net_pay
      `,
      [user.id, month, year, basic, basic]
    );
  }

  return listPayroll({ month, year });
}

export async function updatePayrollEntry(payrollId, payload) {
  const basic = Number(payload.basic ?? 0);
  const allowances = Number(payload.allowances ?? 0);
  const deductions = Number(payload.deductions ?? 0);

  if (![basic, allowances, deductions].every((value) => Number.isFinite(value) && value >= 0)) {
    throw new ApiError(400, "Payroll amounts must be zero or greater.");
  }

  await query(
    `
      UPDATE payroll_entries
      SET basic = ?,
          allowances = ?,
          deductions = ?,
          net_pay = ?
      WHERE id = ?
    `,
    [basic, allowances, deductions, Number((basic + allowances - deductions).toFixed(2)), payrollId]
  );

  const rows = await query(
    `
      SELECT pe.*, u.full_name, u.department
      FROM payroll_entries pe
      INNER JOIN users u ON u.id = pe.user_id
      WHERE pe.id = ?
      LIMIT 1
    `,
    [payrollId]
  );

  if (!rows[0]) {
    throw new ApiError(404, "Payroll entry was not found.");
  }

  return mapPayroll(rows[0]);
}

export async function markPayrollPaid(payrollId) {
  await query(
    `
      UPDATE payroll_entries
      SET status = 'PAID',
          paid_at = NOW()
      WHERE id = ?
    `,
    [payrollId]
  );

  const rows = await query(
    `
      SELECT pe.*, u.full_name, u.department
      FROM payroll_entries pe
      INNER JOIN users u ON u.id = pe.user_id
      WHERE pe.id = ?
      LIMIT 1
    `,
    [payrollId]
  );

  if (!rows[0]) {
    throw new ApiError(404, "Payroll entry was not found.");
  }

  return mapPayroll(rows[0]);
}
