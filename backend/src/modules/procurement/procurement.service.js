import { getPool, query } from "../../config/db.js";
import { sendPurchaseOrderCreatedNotification } from "../notifications/notifications.service.js";
import { getRequisitionByIdForUser } from "../requisitions/requisitions.service.js";
import { ApiError } from "../../utils/apiError.js";

function formatDatePart(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}${month}${day}`;
}

function buildPoNumber() {
  const today = new Date();
  const datePart = formatDatePart(today);
  const randomPart = Math.floor(1000 + Math.random() * 9000);

  return `PO-${datePart}-${randomPart}`;
}

function mapVendor(row) {
  return {
    id: row.id,
    vendorCode: row.vendor_code,
    vendorName: row.vendor_name,
    name: row.vendor_name,
    category: row.category,
    contactName: row.contact_name,
    email: row.email,
    phone: row.phone,
    address: row.address,
    status: row.status
  };
}

function mapProcurementQueueItem(row) {
  return {
    id: row.id,
    requisitionNumber: row.requisition_number,
    title: row.title,
    status: row.status,
    approvedAt: row.approved_at,
    requester: {
      id: row.requested_by_user_id,
      fullName: row.requester_name,
      department: row.requester_department
    },
    procurementItemCount: Number(row.procurement_item_count ?? 0),
    procurementQuantity: Number(row.procurement_quantity ?? 0),
    purchaseOrderNumber: row.po_number,
    purchaseOrderStatus: row.po_status
  };
}

export async function listVendors() {
  const rows = await query(
    `
      SELECT
        id,
        vendor_code,
        vendor_name,
        category,
        contact_name,
        email,
        phone,
        address,
        status
      FROM vendors
      ORDER BY vendor_name ASC
    `
  );

  return rows.map(mapVendor);
}

function normalizeVendorPayload(payload) {
  const vendorName = String(payload.vendorName ?? payload.name ?? "").trim();
  const category = String(payload.category ?? "").trim() || null;
  const contactName = String(payload.contactName ?? payload.contact ?? "").trim() || null;
  const email = String(payload.email ?? "").trim() || null;
  const phone = String(payload.phone ?? "").trim() || null;
  const address = String(payload.address ?? "").trim() || null;

  if (!vendorName || vendorName.length > 160) {
    throw new ApiError(400, "Vendor name is required and must be 160 characters or fewer.");
  }

  return {
    vendorName,
    category,
    contactName,
    email,
    phone,
    address
  };
}

async function buildVendorCode() {
  const rows = await query(`SELECT COUNT(*) AS total FROM vendors`);
  return `VND-${String(Number(rows[0]?.total ?? 0) + 1).padStart(3, "0")}`;
}

export async function createVendor(payload) {
  const vendor = normalizeVendorPayload(payload);
  const vendorCode = String(payload.vendorCode ?? "").trim() || (await buildVendorCode());

  try {
    const result = await query(
      `
        INSERT INTO vendors (
          vendor_code,
          vendor_name,
          category,
          contact_name,
          email,
          phone,
          address
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [
        vendorCode,
        vendor.vendorName,
        vendor.category,
        vendor.contactName,
        vendor.email,
        vendor.phone,
        vendor.address
      ]
    );

    const rows = await query(
      `
        SELECT id, vendor_code, vendor_name, category, contact_name, email, phone, address, status
        FROM vendors
        WHERE id = ?
        LIMIT 1
      `,
      [result.insertId]
    );

    return mapVendor(rows[0]);
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      throw new ApiError(409, "A vendor with this code already exists.");
    }

    throw error;
  }
}

export async function updateVendor(vendorId, payload) {
  const vendor = normalizeVendorPayload(payload);
  await query(
    `
      UPDATE vendors
      SET vendor_name = ?,
          category = ?,
          contact_name = ?,
          email = ?,
          phone = ?,
          address = ?
      WHERE id = ?
    `,
    [
      vendor.vendorName,
      vendor.category,
      vendor.contactName,
      vendor.email,
      vendor.phone,
      vendor.address,
      vendorId
    ]
  );

  const rows = await query(
    `
      SELECT id, vendor_code, vendor_name, category, contact_name, email, phone, address, status
      FROM vendors
      WHERE id = ?
      LIMIT 1
    `,
    [vendorId]
  );

  if (!rows[0]) {
    throw new ApiError(404, "Vendor was not found.");
  }

  return mapVendor(rows[0]);
}

export async function deactivateVendor(vendorId) {
  await query(`UPDATE vendors SET status = 'INACTIVE' WHERE id = ?`, [vendorId]);
}

export async function listPurchaseOrders() {
  const rows = await query(
    `
      SELECT
        po.id,
        po.po_number,
        po.status,
        po.order_date,
        po.expected_delivery_date,
        po.subtotal_amount,
        vendor.vendor_name,
        r.requisition_number,
        COUNT(gr.id) AS grn_count
      FROM purchase_orders po
      INNER JOIN vendors vendor ON vendor.id = po.vendor_id
      INNER JOIN requisitions r ON r.id = po.requisition_id
      LEFT JOIN goods_receipts gr ON gr.purchase_order_id = po.id
      GROUP BY
        po.id,
        po.po_number,
        po.status,
        po.order_date,
        po.expected_delivery_date,
        po.subtotal_amount,
        vendor.vendor_name,
        r.requisition_number
      ORDER BY po.order_date DESC, po.id DESC
    `
  );

  return rows.map((row) => ({
    id: row.id,
    number: row.po_number,
    poNumber: row.po_number,
    vendor: row.vendor_name,
    vendorName: row.vendor_name,
    amount: Number(row.subtotal_amount),
    delivery: row.expected_delivery_date,
    status: String(row.status).toLowerCase(),
    requisitionNumber: row.requisition_number,
    grnCount: Number(row.grn_count)
  }));
}

export async function listGoodsReceipts() {
  const rows = await query(
    `
      SELECT
        gr.id,
        gr.grn_number,
        gr.received_at,
        po.po_number,
        po.subtotal_amount,
        vendor.vendor_name,
        receiver.full_name AS receiver_name
      FROM goods_receipts gr
      INNER JOIN purchase_orders po ON po.id = gr.purchase_order_id
      INNER JOIN vendors vendor ON vendor.id = po.vendor_id
      INNER JOIN users receiver ON receiver.id = gr.received_by_user_id
      ORDER BY gr.received_at DESC, gr.id DESC
    `
  );

  return rows.map((row) => ({
    id: row.id,
    number: row.grn_number,
    grnNumber: row.grn_number,
    po: row.po_number,
    poNumber: row.po_number,
    vendor: row.vendor_name,
    amount: Number(row.subtotal_amount),
    date: row.received_at,
    receiver: row.receiver_name,
    finance: "pending"
  }));
}

export async function updatePurchaseOrderStatus(purchaseOrderId, status) {
  const normalized = String(status ?? "").trim().toUpperCase();

  if (!["DRAFT", "ISSUED", "PARTIALLY_RECEIVED", "RECEIVED", "PAID", "CANCELLED"].includes(normalized)) {
    throw new ApiError(400, "Purchase order status is invalid.");
  }

  await query(`UPDATE purchase_orders SET status = ? WHERE id = ?`, [normalized, purchaseOrderId]);
}

export async function listProcurementQueue() {
  const rows = await query(
    `
      SELECT
        r.id,
        r.requisition_number,
        r.requested_by_user_id,
        r.title,
        r.status,
        r.approved_at,
        requester.full_name AS requester_name,
        requester.department AS requester_department,
        po.po_number,
        po.status AS po_status,
        COALESCE(SUM(ia.quantity_for_procurement), 0) AS procurement_quantity,
        COUNT(CASE WHEN ia.quantity_for_procurement > 0 THEN 1 END) AS procurement_item_count
      FROM requisitions r
      INNER JOIN users requester ON requester.id = r.requested_by_user_id
      LEFT JOIN requisition_items ri ON ri.requisition_id = r.id
      LEFT JOIN inventory_allocations ia ON ia.requisition_item_id = ri.id
      LEFT JOIN purchase_orders po ON po.requisition_id = r.id
      WHERE r.status IN ('PROCUREMENT_PENDING', 'PARTIALLY_FULFILLED')
      GROUP BY
        r.id,
        r.requisition_number,
        r.requested_by_user_id,
        r.title,
        r.status,
        r.approved_at,
        requester.full_name,
        requester.department,
        po.po_number,
        po.status
      ORDER BY
        CASE WHEN po.id IS NULL THEN 0 ELSE 1 END,
        r.approved_at DESC,
        r.id DESC
    `
  );

  return rows.map(mapProcurementQueueItem);
}

async function getVendorForUpdate(connection, vendorId) {
  const [rows] = await connection.execute(
    `
      SELECT id, vendor_name, status
      FROM vendors
      WHERE id = ?
      FOR UPDATE
    `,
    [vendorId]
  );

  return rows[0] ?? null;
}

async function getProcurementRequisitionForUpdate(connection, requisitionId) {
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

async function getProcurementBalances(connection, requisitionId) {
  const [rows] = await connection.execute(
    `
      SELECT
        ri.id AS requisition_item_id,
        ri.line_number,
        ri.item_description,
        ri.specification,
        ri.unit,
        COALESCE(ia.id, NULL) AS inventory_allocation_id,
        COALESCE(ia.quantity_for_procurement, ri.quantity_requested) AS quantity_for_procurement
      FROM requisition_items ri
      LEFT JOIN inventory_allocations ia ON ia.requisition_item_id = ri.id
      WHERE ri.requisition_id = ?
        AND COALESCE(ia.quantity_for_procurement, ri.quantity_requested) > 0
      ORDER BY ri.line_number ASC
    `,
    [requisitionId]
  );

  return rows.map((row) => ({
    requisitionItemId: row.requisition_item_id,
    lineNumber: row.line_number,
    itemDescription: row.item_description,
    specification: row.specification,
    unit: row.unit,
    inventoryAllocationId: row.inventory_allocation_id,
    quantityForProcurement: Number(row.quantity_for_procurement)
  }));
}

async function getExistingPurchaseOrder(connection, requisitionId) {
  const [rows] = await connection.execute(
    `
      SELECT id, po_number, status
      FROM purchase_orders
      WHERE requisition_id = ?
      LIMIT 1
    `,
    [requisitionId]
  );

  return rows[0] ?? null;
}

export async function createPurchaseOrder(procurementUser, requisitionId, payload) {
  const pool = getPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const requisition = await getProcurementRequisitionForUpdate(connection, requisitionId);

    if (!requisition) {
      throw new ApiError(404, "Requisition was not found.");
    }

    if (!["PROCUREMENT_PENDING", "PARTIALLY_FULFILLED"].includes(requisition.status)) {
      throw new ApiError(
        409,
        "Only requisitions with a procurement balance can be turned into a purchase order."
      );
    }

    const existingPo = await getExistingPurchaseOrder(connection, requisitionId);

    if (existingPo) {
      throw new ApiError(
        409,
        `Purchase order ${existingPo.po_number} already exists for this requisition.`
      );
    }

    const vendor = await getVendorForUpdate(connection, payload.vendorId);

    if (!vendor || vendor.status !== "ACTIVE") {
      throw new ApiError(400, "Selected vendor is not available.");
    }

    const balances = await getProcurementBalances(connection, requisitionId);

    if (!balances.length) {
      throw new ApiError(409, "This requisition has no remaining procurement balance.");
    }

    if (payload.lines.length !== balances.length) {
      throw new ApiError(
        400,
        "Purchase order lines must be provided for every procurement balance item."
      );
    }

    const balanceMap = new Map(
      balances.map((balance) => [balance.requisitionItemId, balance])
    );
    const seenItemIds = new Set();

    for (const line of payload.lines) {
      const balance = balanceMap.get(line.requisitionItemId);

      if (!balance) {
        throw new ApiError(
          400,
          `Requisition item ${line.requisitionItemId} is not available for procurement.`
        );
      }

      if (seenItemIds.has(line.requisitionItemId)) {
        throw new ApiError(400, "Each procurement item can only appear once.");
      }

      seenItemIds.add(line.requisitionItemId);

      if (line.quantityOrdered > balance.quantityForProcurement) {
        throw new ApiError(
          400,
          `Ordered quantity for line ${balance.lineNumber} cannot exceed the procurement balance.`
        );
      }
    }

    const poNumber = buildPoNumber();
    const [poResult] = await connection.execute(
      `
        INSERT INTO purchase_orders (
          po_number,
          requisition_id,
          vendor_id,
          created_by_user_id,
          expected_delivery_date,
          subtotal_amount,
          notes
        )
        VALUES (?, ?, ?, ?, ?, 0, ?)
      `,
      [
        poNumber,
        requisitionId,
        payload.vendorId,
        procurementUser.id,
        payload.expectedDeliveryDate,
        payload.notes
      ]
    );

    const purchaseOrderId = poResult.insertId;
    let subtotalAmount = 0;

    for (const [index, line] of payload.lines.entries()) {
      const balance = balanceMap.get(line.requisitionItemId);
      const lineTotal = Number((line.quantityOrdered * line.unitPrice).toFixed(2));
      subtotalAmount += lineTotal;

      await connection.execute(
        `
          INSERT INTO purchase_order_lines (
            purchase_order_id,
            requisition_item_id,
            inventory_allocation_id,
            line_number,
            item_description,
            specification,
            unit,
            quantity_ordered,
            unit_price,
            line_total
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          purchaseOrderId,
          balance.requisitionItemId,
          balance.inventoryAllocationId,
          index + 1,
          balance.itemDescription,
          balance.specification,
          balance.unit,
          line.quantityOrdered,
          line.unitPrice,
          lineTotal
        ]
      );
    }

    await connection.execute(
      `
        UPDATE purchase_orders
        SET subtotal_amount = ?
        WHERE id = ?
      `,
      [Number(subtotalAmount.toFixed(2)), purchaseOrderId]
    );

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
        requisitionId,
        procurementUser.id,
        `Purchase order ${poNumber} created for vendor ${vendor.vendor_name}. ${payload.notes ?? ""}`.trim()
      ]
    );

    await connection.commit();

    const requisitionDetail = await getRequisitionByIdForUser(requisitionId, procurementUser);
    const notification = await sendPurchaseOrderCreatedNotification({
      requisitionId,
      requisitionNumber: requisition.requisition_number,
      poId: purchaseOrderId,
      poNumber,
      recipientUserId: requisition.requested_by_user_id,
      recipientEmail: requisition.requester_email,
      recipientName: requisition.requester_name,
      vendorName: vendor.vendor_name,
      procurementOfficerName: procurementUser.fullName,
      procurementOfficerUserId: procurementUser.id
    });

    return {
      requisition: requisitionDetail,
      notification
    };
  } catch (error) {
    await connection.rollback();

    if (error.code === "ER_DUP_ENTRY") {
      throw new ApiError(409, "A purchase order already exists for this requisition.");
    }

    throw error;
  } finally {
    connection.release();
  }
}
