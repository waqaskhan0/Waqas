import { getPool, query } from "../../config/db.js";
import { sendFinanceMatchNotification } from "../notifications/notifications.service.js";
import { getRequisitionByIdForUser } from "../requisitions/requisitions.service.js";
import { ApiError } from "../../utils/apiError.js";

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
