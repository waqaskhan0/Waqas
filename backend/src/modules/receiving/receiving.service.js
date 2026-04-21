import { getPool, query } from "../../config/db.js";
import { sendGoodsReceivedNotification } from "../notifications/notifications.service.js";
import { getRequisitionByIdForUser } from "../requisitions/requisitions.service.js";
import { ApiError } from "../../utils/apiError.js";

function formatDatePart(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}${month}${day}`;
}

function buildGrnNumber() {
  const today = new Date();
  const datePart = formatDatePart(today);
  const randomPart = Math.floor(1000 + Math.random() * 9000);

  return `GRN-${datePart}-${randomPart}`;
}

function mapReceivingQueueItem(row) {
  return {
    id: row.id,
    poNumber: row.po_number,
    requisitionId: row.requisition_id,
    requisitionNumber: row.requisition_number,
    title: row.title,
    purchaseOrderStatus: row.purchase_order_status,
    requisitionStatus: row.requisition_status,
    orderDate: row.order_date,
    expectedDeliveryDate: row.expected_delivery_date,
    lineCount: Number(row.line_count ?? 0),
    quantityOrdered: Number(row.quantity_ordered ?? 0),
    quantityReceived: Number(row.quantity_received ?? 0),
    quantityOutstanding: Number(row.quantity_outstanding ?? 0),
    vendor: {
      vendorName: row.vendor_name
    },
    requester: {
      fullName: row.requester_name,
      department: row.requester_department
    }
  };
}

export async function listReceivingQueue() {
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
        r.status AS requisition_status,
        requester.full_name AS requester_name,
        requester.department AS requester_department,
        vendor.vendor_name,
        COUNT(pol.id) AS line_count,
        COALESCE(SUM(pol.quantity_ordered), 0) AS quantity_ordered,
        COALESCE(SUM(pol.quantity_received), 0) AS quantity_received,
        COALESCE(SUM(pol.quantity_ordered - pol.quantity_received), 0) AS quantity_outstanding
      FROM purchase_orders po
      INNER JOIN requisitions r ON r.id = po.requisition_id
      INNER JOIN users requester ON requester.id = r.requested_by_user_id
      INNER JOIN vendors vendor ON vendor.id = po.vendor_id
      LEFT JOIN purchase_order_lines pol ON pol.purchase_order_id = po.id
      WHERE po.status IN ('ISSUED', 'PARTIALLY_RECEIVED')
      GROUP BY
        po.id,
        po.po_number,
        po.requisition_id,
        po.status,
        po.order_date,
        po.expected_delivery_date,
        r.requisition_number,
        r.title,
        r.status,
        requester.full_name,
        requester.department,
        vendor.vendor_name
      ORDER BY
        CASE
          WHEN po.status = 'ISSUED' THEN 0
          WHEN po.status = 'PARTIALLY_RECEIVED' THEN 1
          ELSE 2
        END,
        po.order_date DESC,
        po.id DESC
    `
  );

  return rows.map(mapReceivingQueueItem);
}

async function getPurchaseOrderForReceiving(connection, purchaseOrderId) {
  const [rows] = await connection.execute(
    `
      SELECT
        po.id,
        po.po_number,
        po.requisition_id,
        po.status,
        r.requisition_number,
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

async function getPurchaseOrderLinesForReceiving(connection, purchaseOrderId) {
  const [rows] = await connection.execute(
    `
      SELECT
        pol.id,
        pol.requisition_item_id,
        pol.line_number,
        pol.item_description,
        pol.specification,
        pol.unit,
        pol.quantity_ordered,
        pol.quantity_received,
        ia.stock_item_id AS default_stock_item_id
      FROM purchase_order_lines pol
      LEFT JOIN inventory_allocations ia ON ia.id = pol.inventory_allocation_id
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
    specification: row.specification,
    unit: row.unit,
    quantityOrdered: Number(row.quantity_ordered),
    quantityReceived: Number(row.quantity_received),
    defaultStockItemId: row.default_stock_item_id
  }));
}

async function getStockItemsByIds(connection, stockItemIds) {
  if (!stockItemIds.length) {
    return [];
  }

  const placeholders = stockItemIds.map(() => "?").join(", ");
  const [rows] = await connection.execute(
    `
      SELECT
        id,
        sku,
        quantity_on_hand
      FROM inventory_stock
      WHERE id IN (${placeholders})
      FOR UPDATE
    `,
    stockItemIds
  );

  return rows.map((row) => ({
    id: row.id,
    sku: row.sku,
    quantityOnHand: Number(row.quantity_on_hand)
  }));
}

async function determineRequisitionStatus(connection, requisitionId) {
  const [rows] = await connection.execute(
    `
      SELECT
        ri.id,
        ri.quantity_requested,
        COALESCE(ia.quantity_issued, 0) AS quantity_issued,
        COALESCE(pol.quantity_received, 0) AS quantity_received
      FROM requisition_items ri
      LEFT JOIN inventory_allocations ia ON ia.requisition_item_id = ri.id
      LEFT JOIN purchase_order_lines pol ON pol.requisition_item_id = ri.id
      WHERE ri.requisition_id = ?
      ORDER BY ri.line_number ASC
    `,
    [requisitionId]
  );

  const lineStates = rows.map((row) => ({
    quantityRequested: Number(row.quantity_requested),
    quantityIssued: Number(row.quantity_issued),
    quantityReceived: Number(row.quantity_received)
  }));

  const isFullyFulfilled = lineStates.every(
    (line) => Number((line.quantityIssued + line.quantityReceived).toFixed(2)) >= line.quantityRequested
  );
  const hasAnyFulfillment = lineStates.some(
    (line) => Number((line.quantityIssued + line.quantityReceived).toFixed(2)) > 0
  );

  if (isFullyFulfilled) {
    return "FULFILLED";
  }

  if (hasAnyFulfillment) {
    return "PARTIALLY_FULFILLED";
  }

  return "PROCUREMENT_PENDING";
}

export async function receivePurchaseOrder(receivingUser, purchaseOrderId, payload) {
  const pool = getPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const purchaseOrder = await getPurchaseOrderForReceiving(connection, purchaseOrderId);

    if (!purchaseOrder) {
      throw new ApiError(404, "Purchase order was not found.");
    }

    if (!["ISSUED", "PARTIALLY_RECEIVED"].includes(purchaseOrder.status)) {
      throw new ApiError(
        409,
        "Only issued or partially received purchase orders can be received."
      );
    }

    const purchaseOrderLines = await getPurchaseOrderLinesForReceiving(connection, purchaseOrderId);

    if (!purchaseOrderLines.length) {
      throw new ApiError(409, "This purchase order has no lines to receive.");
    }

    const lineMap = new Map(purchaseOrderLines.map((line) => [line.id, line]));
    const seenLineIds = new Set();

    for (const line of payload.lines) {
      const purchaseOrderLine = lineMap.get(line.purchaseOrderLineId);

      if (!purchaseOrderLine) {
        throw new ApiError(
          400,
          `Purchase order line ${line.purchaseOrderLineId} does not belong to this purchase order.`
        );
      }

      if (seenLineIds.has(line.purchaseOrderLineId)) {
        throw new ApiError(400, "Each purchase order line can only be received once per GRN.");
      }

      seenLineIds.add(line.purchaseOrderLineId);

      const outstandingQuantity = Number(
        (purchaseOrderLine.quantityOrdered - purchaseOrderLine.quantityReceived).toFixed(2)
      );

      if (line.quantityReceived > outstandingQuantity) {
        throw new ApiError(
          400,
          `Received quantity for line ${purchaseOrderLine.lineNumber} cannot exceed the outstanding balance.`
        );
      }
    }

    const stockItemIds = [...new Set(payload.lines.map((line) => line.stockItemId))];
    const stockItems = await getStockItemsByIds(connection, stockItemIds);
    const stockItemMap = new Map(stockItems.map((item) => [item.id, item]));

    if (stockItems.length !== stockItemIds.length) {
      throw new ApiError(400, "One or more selected stock items were not found.");
    }

    const grnNumber = buildGrnNumber();
    const [receiptResult] = await connection.execute(
      `
        INSERT INTO goods_receipts (
          grn_number,
          purchase_order_id,
          received_by_user_id,
          delivery_note_number,
          remarks
        )
        VALUES (?, ?, ?, ?, ?)
      `,
      [
        grnNumber,
        purchaseOrderId,
        receivingUser.id,
        payload.deliveryNoteNumber,
        payload.remarks
      ]
    );

    const goodsReceiptId = receiptResult.insertId;
    const updatedReceivedByLineId = new Map(
      purchaseOrderLines.map((line) => [line.id, line.quantityReceived])
    );

    for (const line of payload.lines) {
      const purchaseOrderLine = lineMap.get(line.purchaseOrderLineId);
      const stockItem = stockItemMap.get(line.stockItemId);

      await connection.execute(
        `
          INSERT INTO goods_receipt_lines (
            goods_receipt_id,
            purchase_order_line_id,
            stock_item_id,
            quantity_received
          )
          VALUES (?, ?, ?, ?)
        `,
        [goodsReceiptId, line.purchaseOrderLineId, line.stockItemId, line.quantityReceived]
      );

      await connection.execute(
        `
          UPDATE purchase_order_lines
          SET quantity_received = quantity_received + ?
          WHERE id = ?
        `,
        [line.quantityReceived, line.purchaseOrderLineId]
      );

      await connection.execute(
        `
          UPDATE inventory_stock
          SET quantity_on_hand = quantity_on_hand + ?
          WHERE id = ?
        `,
        [line.quantityReceived, line.stockItemId]
      );

      await connection.execute(
        `
          INSERT INTO inventory_transactions (
            stock_item_id,
            requisition_id,
            requisition_item_id,
            actor_user_id,
            transaction_type,
            quantity,
            notes
          )
          VALUES (?, ?, ?, ?, 'RECEIPT', ?, ?)
        `,
        [
          line.stockItemId,
          purchaseOrder.requisition_id,
          purchaseOrderLine.requisitionItemId,
          receivingUser.id,
          line.quantityReceived,
          `${grnNumber} received into ${stockItem.sku}. ${payload.remarks}`.trim()
        ]
      );

      updatedReceivedByLineId.set(
        line.purchaseOrderLineId,
        Number(
          (updatedReceivedByLineId.get(line.purchaseOrderLineId) + line.quantityReceived).toFixed(2)
        )
      );
    }

    const purchaseOrderStatus = purchaseOrderLines.every((line) => {
      const nextReceived = updatedReceivedByLineId.get(line.id) ?? 0;
      return nextReceived >= line.quantityOrdered;
    })
      ? "RECEIVED"
      : "PARTIALLY_RECEIVED";

    await connection.execute(
      `
        UPDATE purchase_orders
        SET status = ?
        WHERE id = ?
      `,
      [purchaseOrderStatus, purchaseOrderId]
    );

    const requisitionStatus = await determineRequisitionStatus(
      connection,
      purchaseOrder.requisition_id
    );

    await connection.execute(
      `
        UPDATE requisitions
        SET status = ?,
            fulfilled_at = CASE
              WHEN ? = 'FULFILLED' THEN CURRENT_TIMESTAMP
              ELSE fulfilled_at
            END
        WHERE id = ?
      `,
      [requisitionStatus, requisitionStatus, purchaseOrder.requisition_id]
    );

    await connection.execute(
      `
        INSERT INTO approval_logs (
          requisition_id,
          actor_user_id,
          action,
          remarks
        )
        VALUES (?, ?, ?, ?)
      `,
      [
        purchaseOrder.requisition_id,
        receivingUser.id,
        purchaseOrderStatus === "RECEIVED" ? "RECEIVED" : "PARTIAL_RECEIPT",
        `${grnNumber} recorded against ${purchaseOrder.po_number}. ${payload.remarks}`.trim()
      ]
    );

    await connection.commit();

    const requisitionDetail = await getRequisitionByIdForUser(
      purchaseOrder.requisition_id,
      receivingUser
    );
    const notification = await sendGoodsReceivedNotification({
      requisitionNumber: purchaseOrder.requisition_number,
      poNumber: purchaseOrder.po_number,
      grnNumber,
      recipientEmail: purchaseOrder.requester_email,
      recipientName: purchaseOrder.requester_name,
      receiverName: receivingUser.fullName,
      purchaseOrderStatus
    });

    return {
      requisition: requisitionDetail,
      notification
    };
  } catch (error) {
    await connection.rollback();

    if (error.code === "ER_DUP_ENTRY") {
      throw new ApiError(409, "A GRN number collision occurred. Please retry.");
    }

    throw error;
  } finally {
    connection.release();
  }
}
