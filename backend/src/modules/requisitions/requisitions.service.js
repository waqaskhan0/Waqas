import { getPool, query } from "../../config/db.js";
import { sendRequisitionDecisionNotification } from "../notifications/notifications.service.js";
import { ROLES } from "../../config/roles.js";
import { ApiError } from "../../utils/apiError.js";

function formatDatePart(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}${month}${day}`;
}

function buildRequisitionNumber() {
  const today = new Date();
  const datePart = formatDatePart(today);
  const randomPart = Math.floor(1000 + Math.random() * 9000);

  return `REQ-${datePart}-${randomPart}`;
}

function mapRequisitionSummary(row) {
  return {
    id: row.id,
    requisitionNumber: row.requisition_number,
    title: row.title,
    status: row.status,
    neededByDate: row.needed_by_date,
    submittedAt: row.submitted_at,
    itemCount: Number(row.item_count),
    totalQuantity: Number(row.total_quantity ?? 0),
    manager: {
      id: row.manager_id,
      fullName: row.manager_name,
      email: row.manager_email
    }
  };
}

function mapManagerQueueItem(row) {
  return {
    id: row.id,
    requisitionNumber: row.requisition_number,
    title: row.title,
    status: row.status,
    neededByDate: row.needed_by_date,
    submittedAt: row.submitted_at,
    approvedAt: row.approved_at,
    rejectedAt: row.rejected_at,
    itemCount: Number(row.item_count),
    totalQuantity: Number(row.total_quantity ?? 0),
    requester: {
      id: row.requested_by_user_id,
      fullName: row.requester_name,
      email: row.requester_email,
      department: row.requester_department,
      employeeCode: row.requester_employee_code
    }
  };
}

function mapRequisitionDetail(row, items, approvalLogs) {
  return {
    id: row.id,
    requisitionNumber: row.requisition_number,
    title: row.title,
    justification: row.justification,
    status: row.status,
    neededByDate: row.needed_by_date,
    submittedAt: row.submitted_at,
    approvedAt: row.approved_at,
    rejectedAt: row.rejected_at,
    fulfilledAt: row.fulfilled_at,
    requester: {
      id: row.requested_by_user_id,
      fullName: row.requester_name,
      email: row.requester_email,
      department: row.requester_department,
      employeeCode: row.requester_employee_code
    },
    manager: {
      id: row.manager_id,
      fullName: row.manager_name,
      email: row.manager_email
    },
    decisionRemarks: row.decision_remarks,
    inventoryDecision: row.inventory_decision,
    inventoryProcessedAt: row.inventory_processed_at,
    purchaseOrders: row.purchase_orders ?? [],
    goodsReceipts: row.goods_receipts ?? [],
    financeMatches: row.finance_matches ?? [],
    items,
    approvalLogs,
    inventoryAllocations: row.inventory_allocations ?? []
  };
}

async function getRequisitionRowById(requisitionId) {
  const rows = await query(
    `
      SELECT
        r.id,
        r.requisition_number,
        r.requested_by_user_id,
        r.manager_id,
        r.title,
        r.justification,
        r.status,
        r.needed_by_date,
        r.submitted_at,
        r.approved_at,
        r.rejected_at,
        r.fulfilled_at,
        (
          SELECT l.remarks
          FROM approval_logs l
          WHERE l.requisition_id = r.id
            AND l.action IN ('APPROVED', 'REJECTED')
          ORDER BY l.created_at DESC, l.id DESC
          LIMIT 1
        ) AS decision_remarks,
        (
          SELECT ia.resolution
          FROM inventory_allocations ia
          INNER JOIN requisition_items ri ON ri.id = ia.requisition_item_id
          WHERE ri.requisition_id = r.id
          ORDER BY ia.processed_at DESC, ia.id DESC
          LIMIT 1
        ) AS inventory_decision,
        (
          SELECT ia.processed_at
          FROM inventory_allocations ia
          INNER JOIN requisition_items ri ON ri.id = ia.requisition_item_id
          WHERE ri.requisition_id = r.id
          ORDER BY ia.processed_at DESC, ia.id DESC
          LIMIT 1
        ) AS inventory_processed_at,
        requester.full_name AS requester_name,
        requester.email AS requester_email,
        requester.department AS requester_department,
        requester.employee_code AS requester_employee_code,
        manager.full_name AS manager_name,
        manager.email AS manager_email
      FROM requisitions r
      INNER JOIN users requester ON requester.id = r.requested_by_user_id
      INNER JOIN users manager ON manager.id = r.manager_id
      WHERE r.id = ?
      LIMIT 1
    `,
    [requisitionId]
  );

  return rows[0] ?? null;
}

async function getRequisitionItems(requisitionId) {
  const rows = await query(
    `
      SELECT
        id,
        line_number,
        item_description,
        specification,
        quantity_requested,
        unit,
        estimated_unit_cost
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
    quantity: Number(row.quantity_requested),
    unit: row.unit,
    estimatedUnitCost:
      row.estimated_unit_cost === null ? null : Number(row.estimated_unit_cost)
  }));
}

async function getApprovalLogs(requisitionId) {
  const rows = await query(
    `
      SELECT
        l.id,
        l.action,
        l.remarks,
        l.created_at,
        l.actor_user_id,
        u.full_name AS actor_name,
        u.role_code AS actor_role
      FROM approval_logs l
      INNER JOIN users u ON u.id = l.actor_user_id
      WHERE l.requisition_id = ?
      ORDER BY l.created_at ASC, l.id ASC
    `,
    [requisitionId]
  );

  return rows.map((row) => ({
    id: row.id,
    action: row.action,
    remarks: row.remarks,
    createdAt: row.created_at,
    actor: {
      id: row.actor_user_id,
      fullName: row.actor_name,
      role: row.actor_role
    }
  }));
}

async function getInventoryAllocations(requisitionId) {
  const rows = await query(
    `
      SELECT
        ia.id,
        ia.requisition_item_id,
        ia.stock_item_id,
        ia.quantity_requested,
        ia.quantity_issued,
        ia.quantity_for_procurement,
        ia.resolution,
        ia.remarks,
        ia.processed_at,
        ia.processed_by_user_id,
        ri.line_number,
        ri.item_description,
        ri.specification AS requisition_specification,
        stock.sku AS stock_sku,
        stock.item_name AS stock_item_name,
        stock.specification AS stock_specification,
        processor.full_name AS processor_name
      FROM inventory_allocations ia
      INNER JOIN requisition_items ri ON ri.id = ia.requisition_item_id
      LEFT JOIN inventory_stock stock ON stock.id = ia.stock_item_id
      INNER JOIN users processor ON processor.id = ia.processed_by_user_id
      WHERE ri.requisition_id = ?
      ORDER BY ri.line_number ASC
    `,
    [requisitionId]
  );

  return rows.map((row) => ({
    id: row.id,
    requisitionItemId: row.requisition_item_id,
    lineNumber: row.line_number,
    itemDescription: row.item_description,
    requisitionSpecification: row.requisition_specification,
    stockItemId: row.stock_item_id,
    stockSku: row.stock_sku,
    stockItemName: row.stock_item_name,
    stockSpecification: row.stock_specification,
    quantityRequested: Number(row.quantity_requested),
    quantityIssued: Number(row.quantity_issued),
    quantityForProcurement: Number(row.quantity_for_procurement),
    resolution: row.resolution,
    remarks: row.remarks,
    processedAt: row.processed_at,
    processor: {
      id: row.processed_by_user_id,
      fullName: row.processor_name
    }
  }));
}

async function getPurchaseOrders(requisitionId) {
  const rows = await query(
    `
      SELECT
        po.id,
        po.po_number,
        po.vendor_id,
        po.status,
        po.order_date,
        po.expected_delivery_date,
        po.subtotal_amount,
        po.notes,
        vendor.vendor_code,
        vendor.vendor_name,
        pol.id AS line_id,
        pol.requisition_item_id,
        pol.line_number,
        pol.item_description,
        pol.specification,
        pol.unit,
        pol.quantity_ordered,
        pol.quantity_received,
        pol.unit_price,
        pol.line_total
      FROM purchase_orders po
      INNER JOIN vendors vendor ON vendor.id = po.vendor_id
      LEFT JOIN purchase_order_lines pol ON pol.purchase_order_id = po.id
      WHERE po.requisition_id = ?
      ORDER BY po.created_at ASC, pol.line_number ASC
    `,
    [requisitionId]
  );

  const purchaseOrders = new Map();

  for (const row of rows) {
    if (!purchaseOrders.has(row.id)) {
      purchaseOrders.set(row.id, {
        id: row.id,
        poNumber: row.po_number,
        status: row.status,
        orderDate: row.order_date,
        expectedDeliveryDate: row.expected_delivery_date,
        subtotalAmount: Number(row.subtotal_amount),
        notes: row.notes,
        vendor: {
          id: row.vendor_id,
          vendorCode: row.vendor_code,
          vendorName: row.vendor_name
        },
        lines: []
      });
    }

    if (row.line_id) {
      purchaseOrders.get(row.id).lines.push({
        id: row.line_id,
        requisitionItemId: row.requisition_item_id,
        lineNumber: row.line_number,
        itemDescription: row.item_description,
        specification: row.specification,
        unit: row.unit,
        quantityOrdered: Number(row.quantity_ordered),
        quantityReceived: Number(row.quantity_received),
        quantityOutstanding: Number(
          (Number(row.quantity_ordered) - Number(row.quantity_received)).toFixed(2)
        ),
        unitPrice: Number(row.unit_price),
        lineTotal: Number(row.line_total)
      });
    }
  }

  return [...purchaseOrders.values()];
}

async function getGoodsReceipts(requisitionId) {
  const rows = await query(
    `
      SELECT
        gr.id,
        gr.grn_number,
        gr.purchase_order_id,
        gr.delivery_note_number,
        gr.remarks,
        gr.received_at,
        gr.received_by_user_id,
        receiver.full_name AS receiver_name,
        grl.id AS line_id,
        grl.purchase_order_line_id,
        grl.stock_item_id,
        grl.quantity_received,
        pol.line_number,
        pol.requisition_item_id,
        pol.item_description,
        pol.unit,
        stock.sku AS stock_sku,
        stock.item_name AS stock_item_name
      FROM goods_receipts gr
      INNER JOIN purchase_orders po ON po.id = gr.purchase_order_id
      INNER JOIN users receiver ON receiver.id = gr.received_by_user_id
      LEFT JOIN goods_receipt_lines grl ON grl.goods_receipt_id = gr.id
      LEFT JOIN purchase_order_lines pol ON pol.id = grl.purchase_order_line_id
      LEFT JOIN inventory_stock stock ON stock.id = grl.stock_item_id
      WHERE po.requisition_id = ?
      ORDER BY gr.received_at DESC, gr.id DESC, grl.id ASC
    `,
    [requisitionId]
  );

  const goodsReceipts = new Map();

  for (const row of rows) {
    if (!goodsReceipts.has(row.id)) {
      goodsReceipts.set(row.id, {
        id: row.id,
        grnNumber: row.grn_number,
        purchaseOrderId: row.purchase_order_id,
        deliveryNoteNumber: row.delivery_note_number,
        remarks: row.remarks,
        receivedAt: row.received_at,
        receiver: {
          id: row.received_by_user_id,
          fullName: row.receiver_name
        },
        lines: []
      });
    }

    if (row.line_id) {
      goodsReceipts.get(row.id).lines.push({
        id: row.line_id,
        purchaseOrderLineId: row.purchase_order_line_id,
        requisitionItemId: row.requisition_item_id,
        lineNumber: row.line_number,
        itemDescription: row.item_description,
        unit: row.unit,
        stockItemId: row.stock_item_id,
        stockSku: row.stock_sku,
        stockItemName: row.stock_item_name,
        quantityReceived: Number(row.quantity_received)
      });
    }
  }

  return [...goodsReceipts.values()];
}

async function getFinanceMatches(requisitionId) {
  const rows = await query(
    `
      SELECT
        fm.id,
        fm.purchase_order_id,
        fm.finance_user_id,
        fm.invoice_number,
        fm.invoice_date,
        fm.invoice_amount,
        fm.po_amount,
        fm.received_amount,
        fm.variance_amount,
        fm.status,
        fm.remarks,
        fm.created_at,
        finance_user.full_name AS finance_user_name,
        fml.id AS line_id,
        fml.purchase_order_line_id,
        fml.line_number,
        fml.quantity_billed,
        fml.unit_price,
        fml.line_total,
        fml.expected_quantity,
        fml.expected_unit_price,
        fml.expected_line_total,
        fml.status AS line_status,
        pol.requisition_item_id,
        pol.item_description,
        pol.unit
      FROM finance_matches fm
      INNER JOIN purchase_orders po ON po.id = fm.purchase_order_id
      INNER JOIN users finance_user ON finance_user.id = fm.finance_user_id
      LEFT JOIN finance_match_lines fml ON fml.finance_match_id = fm.id
      LEFT JOIN purchase_order_lines pol ON pol.id = fml.purchase_order_line_id
      WHERE po.requisition_id = ?
      ORDER BY fm.created_at DESC, fm.id DESC, fml.line_number ASC
    `,
    [requisitionId]
  );

  const financeMatches = new Map();

  for (const row of rows) {
    if (!financeMatches.has(row.id)) {
      financeMatches.set(row.id, {
        id: row.id,
        purchaseOrderId: row.purchase_order_id,
        invoiceNumber: row.invoice_number,
        invoiceDate: row.invoice_date,
        invoiceAmount: Number(row.invoice_amount),
        poAmount: Number(row.po_amount),
        receivedAmount: Number(row.received_amount),
        varianceAmount: Number(row.variance_amount),
        status: row.status,
        remarks: row.remarks,
        createdAt: row.created_at,
        financeUser: {
          id: row.finance_user_id,
          fullName: row.finance_user_name
        },
        lines: []
      });
    }

    if (row.line_id) {
      financeMatches.get(row.id).lines.push({
        id: row.line_id,
        purchaseOrderLineId: row.purchase_order_line_id,
        requisitionItemId: row.requisition_item_id,
        lineNumber: row.line_number,
        itemDescription: row.item_description,
        unit: row.unit,
        quantityBilled: Number(row.quantity_billed),
        unitPrice: Number(row.unit_price),
        lineTotal: Number(row.line_total),
        expectedQuantity: Number(row.expected_quantity),
        expectedUnitPrice: Number(row.expected_unit_price),
        expectedLineTotal: Number(row.expected_line_total),
        status: row.line_status
      });
    }
  }

  return [...financeMatches.values()];
}

function canAccessRequisition(user, requisitionRow) {
  if (user.id === requisitionRow.requested_by_user_id) {
    return true;
  }

  if (user.id === requisitionRow.manager_id) {
    return true;
  }

  return [
    ROLES.INVENTORY_OFFICER,
    ROLES.PROCUREMENT_OFFICER,
    ROLES.FINANCE
  ].includes(user.role);
}

export async function createRequisition(user, payload) {
  if (!user.managerId) {
    throw new ApiError(
      400,
      "Your account is not assigned to a line manager yet. Module 2 requires a manager."
    );
  }

  const pool = getPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const requisitionNumber = buildRequisitionNumber();
    const [result] = await connection.execute(
      `
        INSERT INTO requisitions (
          requisition_number,
          requested_by_user_id,
          manager_id,
          title,
          justification,
          needed_by_date
        )
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      [
        requisitionNumber,
        user.id,
        user.managerId,
        payload.title,
        payload.justification,
        payload.neededByDate
      ]
    );

    const requisitionId = result.insertId;

    for (const [index, item] of payload.items.entries()) {
      await connection.execute(
        `
          INSERT INTO requisition_items (
            requisition_id,
            line_number,
            item_description,
            specification,
            quantity_requested,
            unit,
            estimated_unit_cost
          )
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        [
          requisitionId,
          index + 1,
          item.description,
          item.specification,
          item.quantity,
          item.unit,
          item.estimatedUnitCost
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
        VALUES (?, ?, 'SUBMITTED', ?)
      `,
      [requisitionId, user.id, payload.justification]
    );

    await connection.commit();

    return getRequisitionByIdForUser(requisitionId, user);
  } catch (error) {
    await connection.rollback();

    if (error.code === "ER_DUP_ENTRY") {
      throw new ApiError(409, "A requisition number collision occurred. Please retry.");
    }

    throw error;
  } finally {
    connection.release();
  }
}

export async function listMyRequisitions(userId) {
  const rows = await query(
    `
      SELECT
        r.id,
        r.requisition_number,
        r.manager_id,
        r.title,
        r.status,
        r.needed_by_date,
        r.submitted_at,
        manager.full_name AS manager_name,
        manager.email AS manager_email,
        COUNT(ri.id) AS item_count,
        COALESCE(SUM(ri.quantity_requested), 0) AS total_quantity
      FROM requisitions r
      INNER JOIN users manager ON manager.id = r.manager_id
      LEFT JOIN requisition_items ri ON ri.requisition_id = r.id
      WHERE r.requested_by_user_id = ?
      GROUP BY
        r.id,
        r.requisition_number,
        r.manager_id,
        r.title,
        r.status,
        r.needed_by_date,
        r.submitted_at,
        manager.full_name,
        manager.email
      ORDER BY r.submitted_at DESC, r.id DESC
    `,
    [userId]
  );

  return rows.map(mapRequisitionSummary);
}

export async function listManagerRequisitions(managerId) {
  const rows = await query(
    `
      SELECT
        r.id,
        r.requisition_number,
        r.requested_by_user_id,
        r.title,
        r.status,
        r.needed_by_date,
        r.submitted_at,
        r.approved_at,
        r.rejected_at,
        requester.full_name AS requester_name,
        requester.email AS requester_email,
        requester.department AS requester_department,
        requester.employee_code AS requester_employee_code,
        COUNT(ri.id) AS item_count,
        COALESCE(SUM(ri.quantity_requested), 0) AS total_quantity
      FROM requisitions r
      INNER JOIN users requester ON requester.id = r.requested_by_user_id
      LEFT JOIN requisition_items ri ON ri.requisition_id = r.id
      WHERE r.manager_id = ?
      GROUP BY
        r.id,
        r.requisition_number,
        r.requested_by_user_id,
        r.title,
        r.status,
        r.needed_by_date,
        r.submitted_at,
        r.approved_at,
        r.rejected_at,
        requester.full_name,
        requester.email,
        requester.department,
        requester.employee_code
      ORDER BY
        CASE
          WHEN r.status = 'SUBMITTED' THEN 0
          WHEN r.status = 'APPROVED' THEN 1
          WHEN r.status = 'REJECTED' THEN 2
          ELSE 3
        END,
        r.submitted_at DESC,
        r.id DESC
    `,
    [managerId]
  );

  return rows.map(mapManagerQueueItem);
}

async function getRequisitionForDecision(connection, requisitionId) {
  const [rows] = await connection.execute(
    `
      SELECT
        r.id,
        r.requisition_number,
        r.requested_by_user_id,
        r.manager_id,
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

async function recordDecision({
  managerUser,
  requisitionId,
  decision,
  remarks
}) {
  const pool = getPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const requisition = await getRequisitionForDecision(connection, requisitionId);

    if (!requisition) {
      throw new ApiError(404, "Requisition was not found.");
    }

    if (requisition.manager_id !== managerUser.id) {
      throw new ApiError(403, "This requisition is not assigned to you.");
    }

    if (requisition.status !== "SUBMITTED") {
      throw new ApiError(
        409,
        `Only submitted requisitions can be ${decision.toLowerCase()}.`
      );
    }

    const nextStatus = decision === "APPROVED" ? "APPROVED" : "REJECTED";
    const timestampColumn = decision === "APPROVED" ? "approved_at" : "rejected_at";

    await connection.execute(
      `
        UPDATE requisitions
        SET status = ?,
            ${timestampColumn} = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      [nextStatus, requisitionId]
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
      [requisitionId, managerUser.id, decision, remarks]
    );

    await connection.commit();

    const updatedRequisition = await getRequisitionByIdForUser(requisitionId, managerUser);
    const notification = await sendRequisitionDecisionNotification({
      requisitionId,
      requisitionNumber: requisition.requisition_number,
      decision,
      recipientUserId: requisition.requested_by_user_id,
      recipientEmail: requisition.requester_email,
      recipientName: requisition.requester_name,
      managerName: managerUser.fullName,
      managerUserId: managerUser.id,
      remarks
    });

    return {
      requisition: updatedRequisition,
      notification
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function approveRequisition(managerUser, requisitionId, remarks) {
  return recordDecision({
    managerUser,
    requisitionId,
    decision: "APPROVED",
    remarks
  });
}

export async function rejectRequisition(managerUser, requisitionId, remarks) {
  return recordDecision({
    managerUser,
    requisitionId,
    decision: "REJECTED",
    remarks
  });
}

export async function getRequisitionByIdForUser(requisitionId, user) {
  const requisitionRow = await getRequisitionRowById(requisitionId);

  if (!requisitionRow) {
    throw new ApiError(404, "Requisition was not found.");
  }

  if (!canAccessRequisition(user, requisitionRow)) {
    throw new ApiError(403, "You do not have access to this requisition.");
  }

  const [
    items,
    approvalLogs,
    inventoryAllocations,
    purchaseOrders,
    goodsReceipts,
    financeMatches
  ] = await Promise.all([
    getRequisitionItems(requisitionId),
    getApprovalLogs(requisitionId),
    getInventoryAllocations(requisitionId),
    getPurchaseOrders(requisitionId),
    getGoodsReceipts(requisitionId),
    getFinanceMatches(requisitionId)
  ]);

  return mapRequisitionDetail(
    {
      ...requisitionRow,
      inventory_allocations: inventoryAllocations,
      purchase_orders: purchaseOrders,
      goods_receipts: goodsReceipts,
      finance_matches: financeMatches
    },
    items,
    approvalLogs
  );
}
