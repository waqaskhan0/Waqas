import { getPool, query } from "../../config/db.js";
import { sendInventoryProcessingNotification } from "../notifications/notifications.service.js";
import { getRequisitionByIdForUser } from "../requisitions/requisitions.service.js";
import { ApiError } from "../../utils/apiError.js";

function mapStockItem(row) {
  return {
    id: row.id,
    sku: row.sku,
    itemName: row.item_name,
    specification: row.specification,
    unit: row.unit,
    quantityOnHand: Number(row.quantity_on_hand),
    reorderLevel: Number(row.reorder_level)
  };
}

function mapInventoryQueueItem(row) {
  return {
    id: row.id,
    requisitionNumber: row.requisition_number,
    title: row.title,
    status: row.status,
    approvedAt: row.approved_at,
    fulfilledAt: row.fulfilled_at,
    itemCount: Number(row.item_count),
    totalQuantity: Number(row.total_quantity ?? 0),
    requester: {
      id: row.requested_by_user_id,
      fullName: row.requester_name,
      department: row.requester_department
    }
  };
}

export async function listInventoryStock() {
  const rows = await query(
    `
      SELECT
        id,
        sku,
        item_name,
        specification,
        unit,
        quantity_on_hand,
        reorder_level
      FROM inventory_stock
      ORDER BY item_name ASC, specification ASC
    `
  );

  return rows.map(mapStockItem);
}

export async function listInventoryQueue() {
  const rows = await query(
    `
      SELECT
        r.id,
        r.requisition_number,
        r.requested_by_user_id,
        r.title,
        r.status,
        r.approved_at,
        r.fulfilled_at,
        requester.full_name AS requester_name,
        requester.department AS requester_department,
        COUNT(ri.id) AS item_count,
        COALESCE(SUM(ri.quantity_requested), 0) AS total_quantity
      FROM requisitions r
      INNER JOIN users requester ON requester.id = r.requested_by_user_id
      LEFT JOIN requisition_items ri ON ri.requisition_id = r.id
      WHERE r.status IN ('APPROVED', 'PROCUREMENT_PENDING', 'PARTIALLY_FULFILLED', 'FULFILLED')
      GROUP BY
        r.id,
        r.requisition_number,
        r.requested_by_user_id,
        r.title,
        r.status,
        r.approved_at,
        r.fulfilled_at,
        requester.full_name,
        requester.department
      ORDER BY
        CASE
          WHEN r.status = 'APPROVED' THEN 0
          WHEN r.status = 'PARTIALLY_FULFILLED' THEN 1
          WHEN r.status = 'PROCUREMENT_PENDING' THEN 2
          WHEN r.status = 'FULFILLED' THEN 3
          ELSE 4
        END,
        r.approved_at DESC,
        r.id DESC
    `
  );

  return rows.map(mapInventoryQueueItem);
}

async function getApprovedRequisitionForProcessing(connection, requisitionId) {
  const [rows] = await connection.execute(
    `
      SELECT
        r.id,
        r.requisition_number,
        r.requested_by_user_id,
        r.status,
        requester.full_name AS requester_name,
        requester.email AS requester_email
      FROM requisitions r
      INNER JOIN users requester ON requester.id = r.requested_by_user_id
      WHERE r.id = ?
      FOR UPDATE
    `,
    [requisitionId]
  );

  return rows[0] ?? null;
}

async function getRequisitionItemsForProcessing(connection, requisitionId) {
  const [rows] = await connection.execute(
    `
      SELECT
        id,
        line_number,
        item_description,
        specification,
        quantity_requested,
        unit
      FROM requisition_items
      WHERE requisition_id = ?
      ORDER BY line_number ASC
    `,
    [requisitionId]
  );

  return rows.map((row) => ({
    id: row.id,
    lineNumber: row.line_number,
    description: row.item_description,
    specification: row.specification,
    quantityRequested: Number(row.quantity_requested),
    unit: row.unit
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
        item_name,
        specification,
        unit,
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
    itemName: row.item_name,
    specification: row.specification,
    unit: row.unit,
    quantityOnHand: Number(row.quantity_on_hand)
  }));
}

function buildDecisionSummary(allocations) {
  const totalIssued = allocations.reduce(
    (sum, allocation) => sum + allocation.quantityIssued,
    0
  );
  const totalProcurement = allocations.reduce(
    (sum, allocation) => sum + allocation.quantityForProcurement,
    0
  );

  if (totalIssued > 0 && totalProcurement === 0) {
    return {
      requisitionStatus: "FULFILLED",
      logAction: "ISSUED",
      subjectStatus: "fulfilled from stock"
    };
  }

  if (totalIssued > 0) {
    return {
      requisitionStatus: "PARTIALLY_FULFILLED",
      logAction: "PARTIAL_PROCUREMENT",
      subjectStatus: "partially issued with procurement balance"
    };
  }

  return {
    requisitionStatus: "PROCUREMENT_PENDING",
    logAction: "PROCUREMENT_REQUESTED",
    subjectStatus: "routed fully to procurement"
  };
}

export async function processInventoryDecision(inventoryUser, requisitionId, payload) {
  const pool = getPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const requisition = await getApprovedRequisitionForProcessing(connection, requisitionId);

    if (!requisition) {
      throw new ApiError(404, "Requisition was not found.");
    }

    if (requisition.status !== "APPROVED") {
      throw new ApiError(
        409,
        "Only approved requisitions can be processed by inventory."
      );
    }

    const requisitionItems = await getRequisitionItemsForProcessing(connection, requisitionId);

    if (payload.lines.length !== requisitionItems.length) {
      throw new ApiError(
        400,
        "Inventory decisions must be provided for every requisition item."
      );
    }

    const requisitionItemMap = new Map(
      requisitionItems.map((item) => [item.id, item])
    );
    const seenItemIds = new Set();

    for (const line of payload.lines) {
      if (!requisitionItemMap.has(line.requisitionItemId)) {
        throw new ApiError(
          400,
          `Requisition item ${line.requisitionItemId} does not belong to this requisition.`
        );
      }

      if (seenItemIds.has(line.requisitionItemId)) {
        throw new ApiError(400, "Each requisition item can only be processed once.");
      }

      seenItemIds.add(line.requisitionItemId);
    }

    const stockItemIds = [...new Set(payload.lines.map((line) => line.stockItemId).filter(Boolean))];
    const stockItems = await getStockItemsByIds(connection, stockItemIds);
    const stockItemMap = new Map(stockItems.map((item) => [item.id, item]));

    if (stockItems.length !== stockItemIds.length) {
      throw new ApiError(400, "One or more selected stock items were not found.");
    }

    const stockUsage = new Map();
    const allocations = payload.lines.map((line) => {
      const requisitionItem = requisitionItemMap.get(line.requisitionItemId);

      if (line.quantityIssued > requisitionItem.quantityRequested) {
        throw new ApiError(
          400,
          `Issued quantity for line ${requisitionItem.lineNumber} cannot exceed the requested quantity.`
        );
      }

      if (line.quantityIssued > 0 && !line.stockItemId) {
        throw new ApiError(
          400,
          `Line ${requisitionItem.lineNumber} needs a stock item when issuing quantity from inventory.`
        );
      }

      if (line.quantityIssued === 0 && line.stockItemId) {
        throw new ApiError(
          400,
          `Line ${requisitionItem.lineNumber} should not include a stock item when nothing is being issued.`
        );
      }

      if (line.stockItemId) {
        stockUsage.set(
          line.stockItemId,
          Number((stockUsage.get(line.stockItemId) ?? 0) + line.quantityIssued)
        );
      }

      const quantityForProcurement = Number(
        (requisitionItem.quantityRequested - line.quantityIssued).toFixed(2)
      );

      return {
        requisitionItem,
        stockItemId: line.stockItemId,
        quantityIssued: line.quantityIssued,
        quantityForProcurement,
        resolution:
          line.quantityIssued === requisitionItem.quantityRequested
            ? "ISSUED"
            : line.quantityIssued > 0
              ? "PARTIAL_PROCUREMENT"
              : "PROCUREMENT_ONLY"
      };
    });

    for (const [stockItemId, usedQuantity] of stockUsage.entries()) {
      const stockItem = stockItemMap.get(stockItemId);

      if (usedQuantity > stockItem.quantityOnHand) {
        throw new ApiError(
          400,
          `Selected stock item ${stockItem.sku} does not have enough quantity on hand.`
        );
      }
    }

    for (const [stockItemId, usedQuantity] of stockUsage.entries()) {
      await connection.execute(
        `
          UPDATE inventory_stock
          SET quantity_on_hand = quantity_on_hand - ?
          WHERE id = ?
        `,
        [usedQuantity, stockItemId]
      );
    }

    for (const allocation of allocations) {
      await connection.execute(
        `
          INSERT INTO inventory_allocations (
            requisition_item_id,
            stock_item_id,
            processed_by_user_id,
            quantity_requested,
            quantity_issued,
            quantity_for_procurement,
            resolution,
            remarks
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          allocation.requisitionItem.id,
          allocation.stockItemId,
          inventoryUser.id,
          allocation.requisitionItem.quantityRequested,
          allocation.quantityIssued,
          allocation.quantityForProcurement,
          allocation.resolution,
          payload.remarks
        ]
      );

      if (allocation.quantityIssued > 0) {
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
            VALUES (?, ?, ?, ?, 'ISSUE', ?, ?)
          `,
          [
            allocation.stockItemId,
            requisitionId,
            allocation.requisitionItem.id,
            inventoryUser.id,
            allocation.quantityIssued,
            payload.remarks
          ]
        );
      }
    }

    const summary = buildDecisionSummary(allocations);
    const fulfilledAt =
      summary.requisitionStatus === "FULFILLED" ? "CURRENT_TIMESTAMP" : "NULL";

    await connection.execute(
      `
        UPDATE requisitions
        SET status = ?,
            fulfilled_at = ${fulfilledAt}
        WHERE id = ?
      `,
      [summary.requisitionStatus, requisitionId]
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
      [requisitionId, inventoryUser.id, summary.logAction, payload.remarks]
    );

    await connection.commit();

    const requisitionDetail = await getRequisitionByIdForUser(requisitionId, inventoryUser);
    const notification = await sendInventoryProcessingNotification({
      requisitionNumber: requisition.requisition_number,
      status: summary.requisitionStatus,
      recipientEmail: requisition.requester_email,
      recipientName: requisition.requester_name,
      inventoryOfficerName: inventoryUser.fullName,
      remarks: payload.remarks
    });

    return {
      requisition: requisitionDetail,
      notification
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
