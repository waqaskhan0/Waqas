import { getPool, query } from "../../config/db.js";
import {
  sendInventoryProcessingNotification,
  sendRoleNotification
} from "../notifications/notifications.service.js";
import { getRequisitionByIdForUser } from "../requisitions/requisitions.service.js";
import { ApiError } from "../../utils/apiError.js";
import { ROLES } from "../../config/roles.js";

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

function mapTransaction(row) {
  return {
    id: row.id,
    stockItemId: row.stock_item_id,
    itemName: row.item_name,
    sku: row.sku,
    type: row.transaction_type,
    quantity: Number(row.quantity),
    reference: row.requisition_number ?? row.notes,
    notes: row.notes,
    createdAt: row.created_at,
    actor: {
      id: row.actor_user_id,
      fullName: row.actor_name
    }
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

export async function createStockItem(payload) {
  const sku = String(payload.sku ?? "").trim();
  const itemName = String(payload.itemName ?? payload.name ?? "").trim();
  const specification = String(payload.specification ?? "").trim() || null;
  const unit = String(payload.unit ?? "pcs").trim();
  const quantityOnHand = Number(payload.quantityOnHand ?? payload.quantity ?? 0);
  const reorderLevel = Number(payload.reorderLevel ?? payload.minLevel ?? payload.min ?? 0);

  if (!sku || !itemName || !unit) {
    throw new ApiError(400, "SKU, item name, and unit are required.");
  }

  if (![quantityOnHand, reorderLevel].every((value) => Number.isFinite(value) && value >= 0)) {
    throw new ApiError(400, "Stock quantities must be zero or greater.");
  }

  try {
    const result = await query(
      `
        INSERT INTO inventory_stock (
          sku,
          item_name,
          specification,
          unit,
          quantity_on_hand,
          reorder_level
        )
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      [sku, itemName, specification, unit, quantityOnHand, reorderLevel]
    );

    const rows = await query(
      `
        SELECT id, sku, item_name, specification, unit, quantity_on_hand, reorder_level
        FROM inventory_stock
        WHERE id = ?
        LIMIT 1
      `,
      [result.insertId]
    );

    return mapStockItem(rows[0]);
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      throw new ApiError(409, "A stock item with this SKU already exists.");
    }

    throw error;
  }
}

export async function updateStockItem(stockItemId, payload) {
  const sku = String(payload.sku ?? "").trim();
  const itemName = String(payload.itemName ?? payload.name ?? "").trim();
  const specification = String(payload.specification ?? "").trim() || null;
  const unit = String(payload.unit ?? "pcs").trim();
  const reorderLevel = Number(payload.reorderLevel ?? payload.minLevel ?? payload.min ?? 0);

  if (!sku || !itemName || !unit) {
    throw new ApiError(400, "SKU, item name, and unit are required.");
  }

  if (!Number.isFinite(reorderLevel) || reorderLevel < 0) {
    throw new ApiError(400, "Reorder level must be zero or greater.");
  }

  await query(
    `
      UPDATE inventory_stock
      SET sku = ?,
          item_name = ?,
          specification = ?,
          unit = ?,
          reorder_level = ?
      WHERE id = ?
    `,
    [sku, itemName, specification, unit, reorderLevel, stockItemId]
  );

  const rows = await query(
    `
      SELECT id, sku, item_name, specification, unit, quantity_on_hand, reorder_level
      FROM inventory_stock
      WHERE id = ?
      LIMIT 1
    `,
    [stockItemId]
  );

  if (!rows[0]) {
    throw new ApiError(404, "Stock item was not found.");
  }

  return mapStockItem(rows[0]);
}

export async function stockIn(inventoryUser, payload) {
  const stockItemId = Number(payload.inventoryItemId ?? payload.stockItemId);
  const quantity = Number(payload.quantity);
  const reference = String(payload.reference ?? "").trim();
  const note = String(payload.note ?? payload.notes ?? "").trim();

  if (!Number.isInteger(stockItemId) || stockItemId <= 0) {
    throw new ApiError(400, "A valid stock item id is required.");
  }

  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new ApiError(400, "Stock-in quantity must be greater than zero.");
  }

  await query(
    `
      UPDATE inventory_stock
      SET quantity_on_hand = quantity_on_hand + ?
      WHERE id = ?
    `,
    [quantity, stockItemId]
  );

  await query(
    `
      INSERT INTO inventory_transactions (
        stock_item_id,
        actor_user_id,
        transaction_type,
        quantity,
        notes
      )
      VALUES (?, ?, 'ADJUSTMENT_IN', ?, ?)
    `,
    [stockItemId, inventoryUser.id, quantity, [reference, note].filter(Boolean).join(" | ") || null]
  );

  const rows = await query(
    `
      SELECT id, sku, item_name, specification, unit, quantity_on_hand, reorder_level
      FROM inventory_stock
      WHERE id = ?
      LIMIT 1
    `,
    [stockItemId]
  );

  return mapStockItem(rows[0]);
}

export async function listLowStockItems() {
  const rows = await query(
    `
      SELECT id, sku, item_name, specification, unit, quantity_on_hand, reorder_level
      FROM inventory_stock
      WHERE quantity_on_hand <= reorder_level
      ORDER BY quantity_on_hand ASC, item_name ASC
    `
  );

  return rows.map(mapStockItem);
}

export async function listInventoryTransactions({ dateFrom, dateTo } = {}) {
  const params = [];
  const filters = ["1 = 1"];

  if (dateFrom) {
    filters.push("DATE(t.created_at) >= ?");
    params.push(String(dateFrom).slice(0, 10));
  }

  if (dateTo) {
    filters.push("DATE(t.created_at) <= ?");
    params.push(String(dateTo).slice(0, 10));
  }

  const rows = await query(
    `
      SELECT
        t.*,
        stock.item_name,
        stock.sku,
        actor.full_name AS actor_name,
        r.requisition_number
      FROM inventory_transactions t
      INNER JOIN inventory_stock stock ON stock.id = t.stock_item_id
      INNER JOIN users actor ON actor.id = t.actor_user_id
      LEFT JOIN requisitions r ON r.id = t.requisition_id
      WHERE ${filters.join(" AND ")}
      ORDER BY t.created_at DESC, t.id DESC
    `,
    params
  );

  return rows.map(mapTransaction);
}

async function notifyProcurementForLowStock(stockItemIds) {
  if (!stockItemIds.length) {
    return;
  }

  const placeholders = stockItemIds.map(() => "?").join(", ");
  const rows = await query(
    `
      SELECT item_name, quantity_on_hand, reorder_level
      FROM inventory_stock
      WHERE id IN (${placeholders})
        AND quantity_on_hand <= reorder_level
    `,
    stockItemIds
  );

  for (const item of rows) {
    await sendRoleNotification({
      role: ROLES.PROCUREMENT_OFFICER,
      subject: `Low stock alert: ${item.item_name}`,
      message: `${item.item_name} has ${Number(item.quantity_on_hand)} remaining. Minimum level is ${Number(item.reorder_level)}.`,
      eventType: "LOW_STOCK_ALERT",
      entityType: "INVENTORY",
      triggeredByUserId: null
    });
  }
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

    await notifyProcurementForLowStock([...stockUsage.keys()]);

    const requisitionDetail = await getRequisitionByIdForUser(requisitionId, inventoryUser);
    const notification = await sendInventoryProcessingNotification({
      requisitionId,
      requisitionNumber: requisition.requisition_number,
      status: summary.requisitionStatus,
      recipientUserId: requisition.requested_by_user_id,
      recipientEmail: requisition.requester_email,
      recipientName: requisition.requester_name,
      inventoryOfficerName: inventoryUser.fullName,
      inventoryOfficerUserId: inventoryUser.id,
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
