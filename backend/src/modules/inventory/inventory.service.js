import { getPool, query } from "../../config/db.js";
import {
  sendInventoryProcessingNotification,
  sendRoleNotification
} from "../notifications/notifications.service.js";
import { getRequisitionByIdForUser } from "../requisitions/requisitions.service.js";
import { ApiError } from "../../utils/apiError.js";
import { ROLES } from "../../config/roles.js";

function mapStockItem(row) {
  const metadata = parsePipeMetadata(row.specification);

  return {
    id: row.id,
    sku: row.sku,
    itemName: row.item_name,
    specification: row.specification,
    itemId: metadata["item id"] || row.sku,
    itemType: metadata.type || row.specification || "Not specified",
    itemCategory: metadata.category || inferInventoryCategory(row),
    defaultLocation: metadata.location || metadata["default storage location"] || "Main store",
    unit: row.unit,
    quantityOnHand: Number(row.quantity_on_hand),
    reservedQuantity: Number(row.reserved_quantity ?? 0),
    availableQuantity: Math.max(
      0,
      Number((Number(row.quantity_on_hand) - Number(row.reserved_quantity ?? 0)).toFixed(2))
    ),
    reorderLevel: Number(row.reorder_level),
    isDiscontinued: metadata.status?.toLowerCase() === "discontinued",
    linkedRequests: row.linked_requests ?? [],
    linkedPurchaseOrders: row.linked_purchase_orders ?? []
  };
}

function inferInventoryCategory(row) {
  const text = `${row.sku ?? ""} ${row.item_name ?? ""} ${row.specification ?? ""}`.toLowerCase();

  if (text.includes("progressive")) {
    return "PROGRESSIVE";
  }

  if (text.includes("stationary") || text.includes("stationery")) {
    return "Stationary";
  }

  if (text.includes("rwhu")) {
    return "RWHU";
  }

  return "RWHU";
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

function mapDashboardRequest(row) {
  return {
    id: row.id,
    requisitionNumber: row.requisition_number,
    title: row.title,
    department: row.requester_department,
    requestedBy: row.requester_name,
    submittedAt: row.submitted_at,
    approvalStatus: row.approval_status,
    issuanceStatus: row.issuance_status
  };
}

function mapProcurementAlert(row) {
  return {
    id: row.id,
    requisitionNumber: row.requisition_number,
    title: row.title,
    department: row.requester_department,
    quantityForProcurement: Number(row.quantity_for_procurement ?? 0),
    processedAt: row.processed_at,
    status: row.status
  };
}

function mapDashboardActivity(row) {
  return {
    id: `${row.activity_type}-${row.reference_id}`,
    type: row.activity_type,
    title: row.title,
    reference: row.reference,
    actor: row.actor_name,
    occurredAt: row.occurred_at
  };
}

function parsePipeMetadata(value) {
  return String(value ?? "")
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((metadata, part) => {
      const separatorIndex = part.indexOf(":");

      if (separatorIndex === -1) {
        return metadata;
      }

      const key = part.slice(0, separatorIndex).trim().toLowerCase();
      const parsedValue = part.slice(separatorIndex + 1).trim();

      return {
        ...metadata,
        [key]: parsedValue
      };
    }, {});
}

function mapInventoryRequest(row) {
  const requestMetadata = parsePipeMetadata(row.justification);
  const itemMetadata = parsePipeMetadata(row.specification);

  return {
    id: `${row.id}-${row.item_id}`,
    requisitionId: row.id,
    requisitionItemId: row.item_id,
    requestId: row.requisition_number,
    requestDate: requestMetadata["request date"] || row.submitted_at,
    submittedAt: row.submitted_at,
    department: requestMetadata.department || row.requester_department,
    location: requestMetadata.location || "Not provided",
    requestedBy: row.requester_name,
    requesterEmail: row.requester_email,
    requesterEmployeeCode: row.requester_employee_code,
    itemId: itemMetadata["item id"] || `Line ${row.line_number}`,
    itemName: row.item_description,
    itemType: itemMetadata.type || itemMetadata.category || "Not specified",
    itemCategory: itemMetadata.category || "Not specified",
    itemSpecification: row.specification,
    quantityRequested: Number(row.quantity_requested ?? 0),
    unit: row.unit,
    manager: {
      fullName: row.manager_name,
      email: row.manager_email
    },
    approvalStatus: row.approval_status,
    issuanceStatus: row.issuance_status,
    notes: itemMetadata.notes || row.justification,
    decisionRemarks: row.decision_remarks,
    inventoryRemarks: row.inventory_remarks,
    approvedAt: row.approved_at,
    rejectedAt: row.rejected_at,
    fulfilledAt: row.fulfilled_at,
    issuedQuantity: Number(row.quantity_issued ?? 0),
    procurementQuantity: Number(row.quantity_for_procurement ?? 0),
    stockItem: row.stock_item_id
      ? {
          id: row.stock_item_id,
          sku: row.stock_sku,
          itemName: row.stock_item_name,
          quantityOnHand: Number(row.stock_quantity_on_hand ?? 0),
          unit: row.stock_unit
        }
      : null
  };
}

export async function listInventoryStock() {
  const [stockRows, requestRows, purchaseOrderRows] = await Promise.all([
    query(
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
    ),
    query(
      `
        SELECT
          r.id AS requisition_id,
          r.requisition_number,
          r.status,
          r.approved_at,
          ri.id AS requisition_item_id,
          ri.item_description,
          ri.specification,
          ri.quantity_requested,
          ia.stock_item_id,
          ia.quantity_issued
        FROM requisitions r
        INNER JOIN requisition_items ri ON ri.requisition_id = r.id
        LEFT JOIN inventory_allocations ia ON ia.requisition_item_id = ri.id
        WHERE r.status IN ('APPROVED', 'PROCUREMENT_PENDING', 'PARTIALLY_FULFILLED', 'FULFILLED')
        ORDER BY r.approved_at DESC, r.id DESC
      `
    ),
    query(
      `
        SELECT
          po.id AS purchase_order_id,
          po.po_number,
          po.status,
          po.order_date,
          pol.requisition_item_id,
          pol.item_description,
          pol.specification,
          pol.quantity_ordered,
          ia.stock_item_id
        FROM purchase_orders po
        INNER JOIN purchase_order_lines pol ON pol.purchase_order_id = po.id
        LEFT JOIN inventory_allocations ia ON ia.id = pol.inventory_allocation_id
        ORDER BY po.order_date DESC, po.id DESC
      `
    )
  ]);

  const stockById = new Map(stockRows.map((row) => [row.id, row]));
  const stockBySku = new Map(stockRows.map((row) => [String(row.sku).toLowerCase(), row]));

  for (const row of stockRows) {
    row.reserved_quantity = 0;
    row.linked_requests = [];
    row.linked_purchase_orders = [];
  }

  for (const request of requestRows) {
    const metadata = parsePipeMetadata(request.specification);
    const itemId = String(metadata["item id"] ?? "").toLowerCase();
    const stockRow = request.stock_item_id
      ? stockById.get(request.stock_item_id)
      : stockBySku.get(itemId);

    if (!stockRow) {
      continue;
    }

    stockRow.linked_requests.push({
      id: request.requisition_id,
      requisitionItemId: request.requisition_item_id,
      requestId: request.requisition_number,
      status: request.status,
      quantity: Number(request.quantity_requested ?? 0)
    });

    if (request.status === "APPROVED" && Number(request.quantity_issued ?? 0) === 0) {
      stockRow.reserved_quantity = Number(
        (Number(stockRow.reserved_quantity ?? 0) + Number(request.quantity_requested ?? 0)).toFixed(2)
      );
    }
  }

  for (const purchaseOrder of purchaseOrderRows) {
    const metadata = parsePipeMetadata(purchaseOrder.specification);
    const itemId = String(metadata["item id"] ?? "").toLowerCase();
    const stockRow = purchaseOrder.stock_item_id
      ? stockById.get(purchaseOrder.stock_item_id)
      : stockBySku.get(itemId);

    if (!stockRow) {
      continue;
    }

    stockRow.linked_purchase_orders.push({
      id: purchaseOrder.purchase_order_id,
      poNumber: purchaseOrder.po_number,
      status: purchaseOrder.status,
      quantity: Number(purchaseOrder.quantity_ordered ?? 0)
    });
  }

  return stockRows.map(mapStockItem);
}

export async function createStockItem(payload) {
  const itemId = String(payload.itemId ?? payload.sku ?? "").trim();
  const itemName = String(payload.itemName ?? payload.name ?? "").trim();
  const itemType = String(payload.itemType ?? payload.type ?? payload.specification ?? "General").trim();
  const itemCategory = String(payload.itemCategory ?? payload.category ?? "RWHU").trim();
  const defaultLocation = String(payload.defaultLocation ?? payload.location ?? "Main store").trim() || "Main store";
  const unit = String(payload.unit ?? "unit").trim() || "unit";
  const quantityOnHand = Number(payload.quantityOnHand ?? payload.quantity ?? 0);
  const reorderLevel = Number(payload.reorderLevel ?? payload.minLevel ?? payload.min ?? 10);

  if (!itemId || !itemName || !itemType || !itemCategory) {
    throw new ApiError(400, "Item ID, item name, type, and category are required.");
  }

  if (![quantityOnHand, reorderLevel].every((value) => Number.isFinite(value) && value >= 0)) {
    throw new ApiError(400, "Stock quantities must be zero or greater.");
  }

  const existingRows = await query(
    `
      SELECT id
      FROM inventory_stock
      WHERE LOWER(sku) = LOWER(?)
      LIMIT 1
    `,
    [itemId]
  );

  if (existingRows.length) {
    throw new ApiError(409, "An item with this Item ID already exists.");
  }

  const specification = [
    `Item ID: ${itemId}`,
    `Type: ${itemType}`,
    `Category: ${itemCategory}`,
    `Location: ${defaultLocation}`
  ].join(" | ");

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
    [itemId, itemName, specification, unit, quantityOnHand, reorderLevel]
  );

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
      WHERE id = ?
    `,
    [result.insertId]
  );

  return mapStockItem({
    ...rows[0],
    reserved_quantity: 0,
    linked_requests: [],
    linked_purchase_orders: []
  });
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

export async function listInventoryRequests() {
  const rows = await query(
    `
      SELECT
        r.id,
        r.requisition_number,
        r.title,
        r.justification,
        r.status,
        r.submitted_at,
        r.approved_at,
        r.rejected_at,
        r.fulfilled_at,
        requester.full_name AS requester_name,
        requester.email AS requester_email,
        requester.department AS requester_department,
        requester.employee_code AS requester_employee_code,
        manager.full_name AS manager_name,
        manager.email AS manager_email,
        ri.id AS item_id,
        ri.line_number,
        ri.item_description,
        ri.specification,
        ri.quantity_requested,
        ri.unit,
        ia.quantity_issued,
        ia.quantity_for_procurement,
        ia.remarks AS inventory_remarks,
        stock.id AS stock_item_id,
        stock.sku AS stock_sku,
        stock.item_name AS stock_item_name,
        stock.quantity_on_hand AS stock_quantity_on_hand,
        stock.unit AS stock_unit,
        (
          SELECT l.remarks
          FROM approval_logs l
          WHERE l.requisition_id = r.id
            AND l.action IN ('APPROVED', 'REJECTED')
          ORDER BY l.created_at DESC, l.id DESC
          LIMIT 1
        ) AS decision_remarks,
        CASE
          WHEN r.status = 'SUBMITTED' THEN 'Pending manager approval'
          WHEN r.status = 'REJECTED' THEN 'Rejected'
          ELSE 'Approved'
        END AS approval_status,
        CASE
          WHEN r.status = 'FULFILLED' THEN 'Issued'
          WHEN r.status = 'PARTIALLY_FULFILLED' THEN 'Partially issued'
          WHEN r.status = 'PROCUREMENT_PENDING' THEN 'Sent to procurement'
          WHEN r.status = 'APPROVED' THEN 'Awaiting inventory'
          WHEN r.status = 'REJECTED' THEN 'Not issued'
          ELSE 'Not issued'
        END AS issuance_status
      FROM requisitions r
      INNER JOIN users requester ON requester.id = r.requested_by_user_id
      INNER JOIN users manager ON manager.id = r.manager_id
      INNER JOIN requisition_items ri ON ri.requisition_id = r.id
      LEFT JOIN inventory_allocations ia ON ia.requisition_item_id = ri.id
      LEFT JOIN inventory_stock stock ON stock.id = ia.stock_item_id
      ORDER BY r.submitted_at DESC, r.id DESC, ri.line_number ASC
    `
  );

  return rows.map(mapInventoryRequest);
}

export async function getInventoryDashboard() {
  const [requestStatsRows, stockStatsRows, recentRequestRows, pendingApprovalRows, procurementAlertRows, activityRows] =
    await Promise.all([
      query(
        `
          SELECT
            COUNT(*) AS total_requests,
            SUM(CASE WHEN status = 'SUBMITTED' THEN 1 ELSE 0 END) AS pending_approvals,
            SUM(CASE WHEN status IN ('APPROVED', 'PROCUREMENT_PENDING', 'PARTIALLY_FULFILLED', 'FULFILLED') THEN 1 ELSE 0 END) AS approved_requests,
            SUM(CASE WHEN status = 'REJECTED' THEN 1 ELSE 0 END) AS rejected_requests
          FROM requisitions
        `
      ),
      query(
        `
          SELECT
            SUM(CASE WHEN quantity_on_hand > 0 AND quantity_on_hand <= reorder_level THEN 1 ELSE 0 END) AS low_stock_items,
            SUM(CASE WHEN quantity_on_hand <= 0 THEN 1 ELSE 0 END) AS out_of_stock_items
          FROM inventory_stock
        `
      ),
      query(
        `
          SELECT
            r.id,
            r.requisition_number,
            r.title,
            r.status,
            r.submitted_at,
            requester.full_name AS requester_name,
            requester.department AS requester_department,
            CASE
              WHEN r.status = 'SUBMITTED' THEN 'Pending manager approval'
              WHEN r.status = 'APPROVED' THEN 'Approved'
              WHEN r.status IN ('PROCUREMENT_PENDING', 'PARTIALLY_FULFILLED', 'FULFILLED') THEN 'Approved'
              WHEN r.status = 'REJECTED' THEN 'Rejected'
              ELSE r.status
            END AS approval_status,
            CASE
              WHEN r.status = 'FULFILLED' THEN 'Issued'
              WHEN r.status = 'PARTIALLY_FULFILLED' THEN 'Partially issued'
              WHEN r.status = 'PROCUREMENT_PENDING' THEN 'Sent to procurement'
              WHEN r.status = 'APPROVED' THEN 'Awaiting inventory'
              ELSE 'Not issued'
            END AS issuance_status
          FROM requisitions r
          INNER JOIN users requester ON requester.id = r.requested_by_user_id
          ORDER BY r.submitted_at DESC, r.id DESC
          LIMIT 8
        `
      ),
      query(
        `
          SELECT
            r.id,
            r.requisition_number,
            r.title,
            r.status,
            r.submitted_at,
            requester.full_name AS requester_name,
            requester.department AS requester_department,
            'Pending manager approval' AS approval_status,
            'Not issued' AS issuance_status
          FROM requisitions r
          INNER JOIN users requester ON requester.id = r.requested_by_user_id
          WHERE r.status = 'SUBMITTED'
          ORDER BY r.submitted_at ASC, r.id ASC
          LIMIT 8
        `
      ),
      query(
        `
          SELECT
            r.id,
            r.requisition_number,
            r.title,
            r.status,
            requester.department AS requester_department,
            SUM(ia.quantity_for_procurement) AS quantity_for_procurement,
            MAX(ia.processed_at) AS processed_at
          FROM requisitions r
          INNER JOIN users requester ON requester.id = r.requested_by_user_id
          INNER JOIN requisition_items ri ON ri.requisition_id = r.id
          INNER JOIN inventory_allocations ia ON ia.requisition_item_id = ri.id
          LEFT JOIN purchase_orders po ON po.requisition_id = r.id
          WHERE ia.quantity_for_procurement > 0
            AND po.id IS NULL
          GROUP BY
            r.id,
            r.requisition_number,
            r.title,
            r.status,
            requester.department
          ORDER BY processed_at DESC, r.id DESC
          LIMIT 8
        `
      ),
      query(
        `
          SELECT *
          FROM (
            SELECT
              'request_submitted' AS activity_type,
              r.id AS reference_id,
              CONCAT('Request submitted by ', requester.full_name) AS title,
              r.requisition_number AS reference,
              requester.full_name AS actor_name,
              r.submitted_at AS occurred_at
            FROM requisitions r
            INNER JOIN users requester ON requester.id = r.requested_by_user_id

            UNION ALL

            SELECT
              'request_approved' AS activity_type,
              r.id AS reference_id,
              CONCAT('Request approved for ', requester.department) AS title,
              r.requisition_number AS reference,
              manager.full_name AS actor_name,
              r.approved_at AS occurred_at
            FROM requisitions r
            INNER JOIN users requester ON requester.id = r.requested_by_user_id
            INNER JOIN users manager ON manager.id = r.manager_id
            WHERE r.approved_at IS NOT NULL

            UNION ALL

            SELECT
              'item_issued' AS activity_type,
              it.id AS reference_id,
              CONCAT('Issued ', it.quantity, ' ', stock.unit, ' of ', stock.item_name) AS title,
              r.requisition_number AS reference,
              actor.full_name AS actor_name,
              it.created_at AS occurred_at
            FROM inventory_transactions it
            INNER JOIN inventory_stock stock ON stock.id = it.stock_item_id
            LEFT JOIN requisitions r ON r.id = it.requisition_id
            INNER JOIN users actor ON actor.id = it.actor_user_id
            WHERE it.transaction_type = 'ISSUE'

            UNION ALL

            SELECT
              'grn_received' AS activity_type,
              gr.id AS reference_id,
              CONCAT('GRN received for ', po.po_number) AS title,
              gr.grn_number AS reference,
              receiver.full_name AS actor_name,
              gr.received_at AS occurred_at
            FROM goods_receipts gr
            INNER JOIN purchase_orders po ON po.id = gr.purchase_order_id
            INNER JOIN users receiver ON receiver.id = gr.received_by_user_id

            UNION ALL

            SELECT
              'po_created' AS activity_type,
              po.id AS reference_id,
              CONCAT('Purchase order created for ', vendor.vendor_name) AS title,
              po.po_number AS reference,
              creator.full_name AS actor_name,
              po.order_date AS occurred_at
            FROM purchase_orders po
            INNER JOIN vendors vendor ON vendor.id = po.vendor_id
            INNER JOIN users creator ON creator.id = po.created_by_user_id
          ) activity
          WHERE occurred_at IS NOT NULL
          ORDER BY occurred_at DESC
          LIMIT 10
        `
      )
    ]);

  const requestStats = requestStatsRows[0] ?? {};
  const stockStats = stockStatsRows[0] ?? {};

  return {
    summary: {
      totalRequests: Number(requestStats.total_requests ?? 0),
      pendingApprovals: Number(requestStats.pending_approvals ?? 0),
      approvedRequests: Number(requestStats.approved_requests ?? 0),
      rejectedRequests: Number(requestStats.rejected_requests ?? 0),
      lowStockItems: Number(stockStats.low_stock_items ?? 0),
      outOfStockItems: Number(stockStats.out_of_stock_items ?? 0)
    },
    recentRequests: recentRequestRows.map(mapDashboardRequest),
    pendingApprovals: pendingApprovalRows.map(mapDashboardRequest),
    procurementAlerts: procurementAlertRows.map(mapProcurementAlert),
    recentActivity: activityRows.map(mapDashboardActivity)
  };
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
