import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { getPool, query } from "../config/db.js";

function normalize(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function slugify(value) {
  const base = normalize(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.|\.$/g, "");
  return base || "user";
}

function parseNumber(value, fallback = 0) {
  const cleaned = normalize(value).replace(/,/g, "");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function excelSerialToDate(value) {
  const normalized = normalize(value);
  if (!normalized) {
    return null;
  }

  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(normalized)) {
    const [day, month, year] = normalized.split("/");
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  const serial = Number(normalized);
  if (!Number.isFinite(serial)) {
    return null;
  }

  const utcDays = Math.floor(serial - 25569);
  const utcValue = utcDays * 86400;
  const dateInfo = new Date(utcValue * 1000);
  if (Number.isNaN(dateInfo.getTime())) {
    return null;
  }

  return dateInfo.toISOString().slice(0, 10);
}

function excelSerialToDateTime(value) {
  const normalized = normalize(value);
  if (!normalized) {
    return null;
  }

  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(normalized)) {
    return `${excelSerialToDate(normalized)} 09:00:00`;
  }

  const serial = Number(normalized);
  if (!Number.isFinite(serial)) {
    return null;
  }

  const millis = Math.round((serial - 25569) * 86400 * 1000);
  const dateInfo = new Date(millis);
  if (Number.isNaN(dateInfo.getTime())) {
    return null;
  }

  return dateInfo.toISOString().slice(0, 19).replace("T", " ");
}

function truncate(value, max = 150) {
  const normalized = normalize(value);
  return normalized.length > max ? normalized.slice(0, max - 1).trimEnd() : normalized;
}

function parseQuantityAndUnit(rawQuantity, fallbackUnit) {
  const normalized = normalize(rawQuantity);
  if (!normalized) {
    return { quantity: 1, unit: fallbackUnit };
  }

  const match = normalized.match(/^([\d.]+)\s*(.*)$/);
  if (!match) {
    return { quantity: 1, unit: fallbackUnit };
  }

  return {
    quantity: parseNumber(match[1], 1),
    unit: normalize(match[2]) || fallbackUnit
  };
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function extractWorkbookData(workbookPath) {
  const extractorPath = path.join(__dirname, "extract_workbook_json.py");
  const stdout = execFileSync("python", [extractorPath, workbookPath], {
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
    env: {
      ...process.env,
      PYTHONIOENCODING: "utf-8"
    }
  });

  return JSON.parse(stdout);
}

async function ensureRole(code, label) {
  await query(
    `
      INSERT INTO roles (code, label)
      VALUES (?, ?)
      ON DUPLICATE KEY UPDATE label = VALUES(label)
    `,
    [code, label]
  );
}

let employeeCodeSeed = 9000;
function nextEmployeeCode(prefix = "IMP") {
  employeeCodeSeed += 1;
  return `${prefix}-${employeeCodeSeed}`;
}

async function ensureUser({ fullName, email, roleCode, department, managerId = null }) {
  const normalizedEmail = normalize(email).toLowerCase();
  const rows = await query(`SELECT id FROM users WHERE email = ? LIMIT 1`, [normalizedEmail]);
  if (rows[0]?.id) {
    return rows[0].id;
  }

  const employeePrefix = roleCode.slice(0, 3);
  let employeeCode = nextEmployeeCode(employeePrefix);
  while (true) {
    const existingCode = await query(
      `SELECT id FROM users WHERE employee_code = ? LIMIT 1`,
      [employeeCode]
    );
    if (!existingCode[0]?.id) {
      break;
    }
    employeeCode = nextEmployeeCode(employeePrefix);
  }

  await query(
    `
      INSERT INTO users (
        employee_code,
        full_name,
        email,
        password_hash,
        role_code,
        department,
        manager_id,
        status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE')
    `,
    [
      employeeCode,
      truncate(fullName, 120),
      normalizedEmail,
      "$2a$10$gaJYlPjX8M5IleeSMm/rLuiPsFAziTZIt0x9OwQldg6j/L61rgQve",
      roleCode,
      truncate(department || "Imported", 100),
      managerId
    ]
  );

  const inserted = await query(`SELECT id FROM users WHERE email = ? LIMIT 1`, [normalizedEmail]);
  return inserted[0].id;
}

async function ensureVendor(vendorName) {
  const normalized = truncate(vendorName || "Imported Vendor", 160);
  let rows = await query(`SELECT id FROM vendors WHERE vendor_name = ? LIMIT 1`, [normalized]);
  if (rows[0]?.id) {
    return rows[0].id;
  }

  const vendorBase = `IMP-VND-${slugify(normalized).replace(/\./g, "").slice(0, 12).toUpperCase()}`;
  let vendorCode = vendorBase;
  let counter = 1;
  while (true) {
    const existing = await query(`SELECT id FROM vendors WHERE vendor_code = ? LIMIT 1`, [vendorCode]);
    if (!existing[0]?.id) {
      break;
    }
    counter += 1;
    vendorCode = `${vendorBase.slice(0, 26)}${counter}`.slice(0, 30);
  }

  await query(
    `
      INSERT INTO vendors (
        vendor_code,
        vendor_name,
        status
      )
      VALUES (?, ?, 'ACTIVE')
    `,
    [vendorCode, normalized]
  );

  rows = await query(`SELECT id FROM vendors WHERE vendor_name = ? LIMIT 1`, [normalized]);
  return rows[0].id;
}

async function ensureStockItem({ skuHint, itemName, specification, quantity = 0 }) {
  const name = truncate(itemName || "Imported stock item", 160);
  const spec = normalize(specification) || null;

  let rows = await query(
    `
      SELECT id
      FROM inventory_stock
      WHERE sku = ?
         OR (item_name = ? AND ((specification IS NULL AND ? IS NULL) OR specification = ?))
      LIMIT 1
    `,
    [normalize(skuHint), name, spec, spec]
  );
  if (rows[0]?.id) {
    return rows[0].id;
  }

  const baseSku = normalize(skuHint) || `IMP-${slugify(name).replace(/\./g, "-").toUpperCase()}`;
  let sku = baseSku.slice(0, 40);
  let counter = 1;
  while (true) {
    const existing = await query(`SELECT id FROM inventory_stock WHERE sku = ? LIMIT 1`, [sku]);
    if (!existing[0]?.id) {
      break;
    }
    counter += 1;
    sku = `${baseSku.slice(0, 34)}-${counter}`.slice(0, 40);
  }

  await query(
    `
      INSERT INTO inventory_stock (
        sku,
        item_name,
        specification,
        unit,
        quantity_on_hand,
        reorder_level
      )
      VALUES (?, ?, ?, 'pcs', ?, 1)
    `,
    [sku, name, spec, quantity]
  );

  rows = await query(`SELECT id FROM inventory_stock WHERE sku = ? LIMIT 1`, [sku]);
  return rows[0].id;
}

async function upsertRequisition({
  requisitionNumber,
  requestedByUserId,
  managerId,
  title,
  justification,
  status,
  neededByDate,
  submittedAt,
  approvedAt = null,
  rejectedAt = null
}) {
  const existing = await query(
    `SELECT id FROM requisitions WHERE requisition_number = ? LIMIT 1`,
    [requisitionNumber]
  );
  if (existing[0]?.id) {
    return existing[0].id;
  }

  await query(
    `
      INSERT INTO requisitions (
        requisition_number,
        requested_by_user_id,
        manager_id,
        title,
        justification,
        status,
        needed_by_date,
        submitted_at,
        approved_at,
        rejected_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      requisitionNumber,
      requestedByUserId,
      managerId,
      truncate(title, 150),
      truncate(justification, 500),
      status,
      neededByDate,
      submittedAt,
      approvedAt,
      rejectedAt
    ]
  );

  const inserted = await query(
    `SELECT id FROM requisitions WHERE requisition_number = ? LIMIT 1`,
    [requisitionNumber]
  );
  return inserted[0].id;
}

async function replaceRequisitionItems(requisitionId, items) {
  await query(`DELETE FROM requisition_items WHERE requisition_id = ?`, [requisitionId]);
  for (const [index, item] of items.entries()) {
    await query(
      `
        INSERT INTO requisition_items (
          requisition_id,
          line_number,
          item_description,
          specification,
          quantity_requested,
          unit
        )
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      [
        requisitionId,
        index + 1,
        truncate(item.description, 160),
        item.specification ? truncate(item.specification, 255) : null,
        item.quantity,
        truncate(item.unit || "pcs", 30)
      ]
    );
  }
}

async function ensureApprovalLog(requisitionId, actorUserId, action, remarks, createdAt = null) {
  const existing = await query(
    `
      SELECT id
      FROM approval_logs
      WHERE requisition_id = ? AND actor_user_id = ? AND action = ?
      LIMIT 1
    `,
    [requisitionId, actorUserId, action]
  );
  if (existing[0]?.id) {
    return;
  }

  await query(
    `
      INSERT INTO approval_logs (
        requisition_id,
        actor_user_id,
        action,
        remarks,
        created_at
      )
      VALUES (?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP))
    `,
    [requisitionId, actorUserId, action, truncate(remarks, 500), createdAt]
  );
}

async function importRequests(data, helpers) {
  const detailMap = new Map();
  for (const row of data.Requests ?? []) {
    const requestId = normalize(row["Request ID"]);
    if (!requestId) {
      continue;
    }

    const lines = detailMap.get(requestId) ?? [];
    lines.push({
      description: normalize(row["Item name"]) || normalize(row["Item ID"]) || "Imported request item",
      specification: normalize(row.Type),
      quantity: parseNumber(row["Quantity requested"], 1),
      unit: "pcs"
    });
    detailMap.set(requestId, lines);
  }

  let imported = 0;
  for (const row of data.Request_Records ?? []) {
    const requestId = normalize(row["Request ID"]);
    if (!requestId) {
      continue;
    }

    const requesterName = normalize(row["Requested by"]) || "Imported Requester";
    const requesterEmail =
      normalize(row["Requester Email"]) ||
      `${slugify(requesterName)}@imported.local`;
    const managerEmail =
      normalize(row["Line Manager's Email"]) ||
      `manager.${slugify(requesterName)}@imported.local`;
    const department = normalize(row.Department) || "Imported";

    const managerId = await helpers.ensureManager(managerEmail);
    const requesterId = await ensureUser({
      fullName: requesterName,
      email: requesterEmail,
      roleCode: "EMPLOYEE",
      department,
      managerId
    });

    const approvalStatus = normalize(row["Approval Status"]).toLowerCase();
    const status =
      approvalStatus === "approved"
        ? "APPROVED"
        : approvalStatus === "rejected"
          ? "REJECTED"
          : "SUBMITTED";
    const submittedAt = excelSerialToDateTime(row.Timestamp) ?? "2026-01-01 09:00:00";
    const items =
      detailMap.get(requestId) ??
      [
        {
          description: normalize(row.Items) || "Imported request item",
          specification: null,
          quantity: parseNumber(row["Total Quantity requested"], 1),
          unit: "pcs"
        }
      ];

    const requisitionId = await upsertRequisition({
      requisitionNumber: requestId,
      requestedByUserId: requesterId,
      managerId,
      title: normalize(row.Items) || `Imported request ${requestId}`,
      justification: `Imported from workbook request record for ${requesterName}.`,
      status,
      neededByDate: null,
      submittedAt,
      approvedAt: status === "APPROVED" ? submittedAt : null,
      rejectedAt: status === "REJECTED" ? submittedAt : null
    });

    await replaceRequisitionItems(requisitionId, items);
    await ensureApprovalLog(
      requisitionId,
      requesterId,
      "SUBMITTED",
      "Imported from workbook request record.",
      submittedAt
    );
    if (status === "APPROVED") {
      await ensureApprovalLog(
        requisitionId,
        managerId,
        "APPROVED",
        "Imported approved workbook request.",
        submittedAt
      );
    } else if (status === "REJECTED") {
      await ensureApprovalLog(
        requisitionId,
        managerId,
        "REJECTED",
        "Imported rejected workbook request.",
        submittedAt
      );
    }

    imported += 1;
  }

  return imported;
}

async function importTransportRequests(data, helpers) {
  let imported = 0;
  for (const row of data.Transport_Requests ?? []) {
    const requestId = normalize(row["Request ID"]);
    const requesterName = normalize(row["Requested by"]);
    if (!requestId || !requesterName) {
      continue;
    }

    const requesterEmail = `${slugify(requesterName)}.transport@imported.local`;
    const managerEmail = `transport.manager.${slugify(requesterName)}@imported.local`;
    const managerId = await helpers.ensureManager(managerEmail);
    const requesterId = await ensureUser({
      fullName: requesterName,
      email: requesterEmail,
      roleCode: "EMPLOYEE",
      department: normalize(row.Department) || "Transport",
      managerId
    });

    const itemInfo = parseQuantityAndUnit(row.Quantity, "trip");
    const destination = normalize(row.Destination) || normalize(row["Dropoff Location"]);
    const transportType = normalize(row["Transport Type"]) || "Transport Request";
    const requisitionNumber = `TR-${requestId}`;
    const status =
      normalize(row.Status).toLowerCase() === "arranged" ? "APPROVED" : "SUBMITTED";
    const submittedAt = excelSerialToDateTime(row["Date of travel"]) ?? "2026-01-01 09:00:00";

    const requisitionId = await upsertRequisition({
      requisitionNumber,
      requestedByUserId: requesterId,
      managerId,
      title: truncate(`${transportType}${destination ? ` - ${destination}` : ""}`),
      justification:
        normalize(row["Purpose/notes"]) ||
        `Imported transport request for ${requesterName}.`,
      status,
      neededByDate: excelSerialToDate(row["Date of travel"]),
      submittedAt,
      approvedAt: status === "APPROVED" ? submittedAt : null
    });

    await replaceRequisitionItems(requisitionId, [
      {
        description: truncate(
          `Transport service: ${transportType}${destination ? ` to ${destination}` : ""}`
        ),
        specification: truncate(
          [
            normalize(row["Pickup Location"]),
            normalize(row["Vehicle type"]),
            normalize(row.Passengers) ? `${normalize(row.Passengers)} passengers` : "",
            normalize(row["Goods Description"])
          ]
            .filter(Boolean)
            .join(" | "),
          255
        ),
        quantity: itemInfo.quantity,
        unit: itemInfo.unit
      }
    ]);

    await ensureApprovalLog(
      requisitionId,
      requesterId,
      "SUBMITTED",
      "Imported transport request.",
      submittedAt
    );
    if (status === "APPROVED") {
      await ensureApprovalLog(
        requisitionId,
        managerId,
        "APPROVED",
        "Imported arranged transport request.",
        submittedAt
      );
    }

    imported += 1;
  }

  return imported;
}

async function importPurchaseOrdersAndGrns(data, helpers) {
  const procurementUserId = await ensureUser({
    fullName: "Imported Procurement Officer",
    email: "procurement.imported@ims.local",
    roleCode: "PROCUREMENT_OFFICER",
    department: "Procurement"
  });
  const receivingDefaultUserId = await ensureUser({
    fullName: "Imported Receiving Officer",
    email: "receiving.imported@ims.local",
    roleCode: "INVENTORY_OFFICER",
    department: "Stores"
  });
  const defaultManagerId = await helpers.ensureManager("line.manager.imported@ims.local");
  const importedRequesterId = await ensureUser({
    fullName: "Imported Procurement Request",
    email: "request.imported@ims.local",
    roleCode: "EMPLOYEE",
    department: "Operations",
    managerId: defaultManagerId
  });

  const poLineMap = new Map();
  let poCount = 0;
  for (const row of data.PO ?? []) {
    const poNumber = normalize(row["PO number"]);
    if (!poNumber) {
      continue;
    }

    const existingPo = await query(
      `
        SELECT
          po.id,
          po.requisition_id,
          pol.id AS purchase_order_line_id,
          grl.stock_item_id
        FROM purchase_orders po
        LEFT JOIN purchase_order_lines pol ON pol.purchase_order_id = po.id
        LEFT JOIN goods_receipt_lines grl ON grl.purchase_order_line_id = pol.id
        WHERE po.po_number = ?
        LIMIT 1
      `,
      [poNumber]
    );
    if (existingPo[0]?.id) {
      poLineMap.set(poNumber, {
        purchaseOrderId: existingPo[0].id,
        purchaseOrderLineId: existingPo[0].purchase_order_line_id ?? null,
        stockItemId: existingPo[0].stock_item_id ?? null,
        requisitionId: existingPo[0].requisition_id ?? null
      });
      continue;
    }

    const vendorId = await ensureVendor(row.Vendor);
    const quantityOrdered = parseNumber(row["Quantity Ordered"], 1);
    const quantityReceived = parseNumber(row["Quantity Recieved"], 0);
    const poAmount = parseNumber(row["PO amount"], 0);
    const spec = normalize(row.Specifications) || `Imported PO ${poNumber}`;
    const requisitionNumber = `POREQ-${poNumber.replaceAll("/", "-")}`;
    const delivered = normalize(row.Status).toLowerCase() === "delivered";
    const cancelled = normalize(row["Notes/Remarks"]).toLowerCase().includes("cancelled");
    const requisitionStatus = delivered && quantityReceived >= quantityOrdered ? "FULFILLED" : "PROCUREMENT_PENDING";

    const requisitionId = await upsertRequisition({
      requisitionNumber,
      requestedByUserId: importedRequesterId,
      managerId: defaultManagerId,
      title: truncate(spec),
      justification: `Imported purchase order ${poNumber} from workbook.`,
      status: requisitionStatus,
      neededByDate: excelSerialToDate(row["Arrived by"]),
      submittedAt: `${excelSerialToDate(row["Issue date"]) ?? "2026-01-01"} 09:00:00`,
      approvedAt: `${excelSerialToDate(row["Issue date"]) ?? "2026-01-01"} 09:00:00`
    });

    await replaceRequisitionItems(requisitionId, [
      {
        description: truncate(spec, 160),
        specification: truncate(normalize(row.Location), 255),
        quantity: quantityOrdered || 1,
        unit: "pcs"
      }
    ]);
    await ensureApprovalLog(
      requisitionId,
      importedRequesterId,
      "SUBMITTED",
      "Imported purchase order requisition stub."
    );
    await ensureApprovalLog(
      requisitionId,
      defaultManagerId,
      "APPROVED",
      "Imported purchase order requisition approval."
    );

    await query(
      `
        INSERT INTO purchase_orders (
          po_number,
          requisition_id,
          vendor_id,
          created_by_user_id,
          status,
          order_date,
          expected_delivery_date,
          subtotal_amount,
          notes
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        poNumber,
        requisitionId,
        vendorId,
        procurementUserId,
        cancelled
          ? "CANCELLED"
          : delivered
            ? quantityReceived >= quantityOrdered
              ? "RECEIVED"
              : "PARTIALLY_RECEIVED"
            : "ISSUED",
        `${excelSerialToDate(row["Issue date"]) ?? "2026-01-01"} 09:00:00`,
        excelSerialToDate(row["Arrived by"]),
        poAmount,
        truncate(row["Notes/Remarks"], 500)
      ]
    );

    const poInserted = await query(
      `SELECT id FROM purchase_orders WHERE po_number = ? LIMIT 1`,
      [poNumber]
    );
    const purchaseOrderId = poInserted[0].id;
    const stockItemId = await ensureStockItem({
      skuHint: normalize(row["PO number"]),
      itemName: spec,
      specification: normalize(row.Location)
    });

    await query(
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
          quantity_received,
          unit_price,
          line_total
        )
        SELECT ?, ri.id, NULL, 1, ?, ?, 'pcs', ?, ?, ?, ?
        FROM requisition_items ri
        WHERE ri.requisition_id = ?
        LIMIT 1
      `,
      [
        purchaseOrderId,
        truncate(spec, 160),
        truncate(normalize(row.Location), 255),
        quantityOrdered || 1,
        quantityReceived,
        quantityOrdered ? Number((poAmount / Math.max(quantityOrdered, 1)).toFixed(2)) : poAmount,
        poAmount,
        requisitionId
      ]
    );

    const lineInserted = await query(
      `SELECT id FROM purchase_order_lines WHERE purchase_order_id = ? LIMIT 1`,
      [purchaseOrderId]
    );
    poLineMap.set(poNumber, {
      purchaseOrderId,
      purchaseOrderLineId: lineInserted[0].id,
      stockItemId,
      requisitionId
    });
    poCount += 1;
  }

  let grnCount = 0;
  for (const row of data.GRN ?? []) {
    const grnNumber = normalize(row["GRN ID"]);
    const poNumber = normalize(row["PO number"]);
    if (!grnNumber || !poNumber) {
      continue;
    }

    const existing = await query(
      `SELECT id FROM goods_receipts WHERE grn_number = ? LIMIT 1`,
      [grnNumber]
    );
    if (existing[0]?.id) {
      continue;
    }

    const poRef = poLineMap.get(poNumber);
    if (!poRef?.purchaseOrderId) {
      continue;
    }
    if (!poRef.purchaseOrderLineId || !poRef.stockItemId) {
      const fallback = await query(
        `
          SELECT
            pol.id AS purchase_order_line_id,
            COALESCE(grl.stock_item_id, stock.id) AS stock_item_id
          FROM purchase_order_lines pol
          LEFT JOIN goods_receipt_lines grl ON grl.purchase_order_line_id = pol.id
          LEFT JOIN inventory_stock stock
            ON stock.item_name = pol.item_description
            OR (stock.specification IS NOT NULL AND stock.specification = pol.specification)
          WHERE pol.purchase_order_id = ?
          LIMIT 1
        `,
        [poRef.purchaseOrderId]
      );

      if (fallback[0]?.purchase_order_line_id) {
        poRef.purchaseOrderLineId = fallback[0].purchase_order_line_id;
        poRef.stockItemId = fallback[0].stock_item_id;
      }
    }
    if (!poRef.purchaseOrderLineId || !poRef.stockItemId) {
      continue;
    }

    const receiverName = normalize(row["Recieved by"]) || "Imported Receiving Officer";
    const receiverId =
      receiverName === "Imported Receiving Officer"
        ? receivingDefaultUserId
        : await ensureUser({
            fullName: receiverName,
            email: `${slugify(receiverName)}.receiving@ims.local`,
            roleCode: "INVENTORY_OFFICER",
            department: "Stores"
          });

    await query(
      `
        INSERT INTO goods_receipts (
          grn_number,
          purchase_order_id,
          received_by_user_id,
          delivery_note_number,
          remarks,
          received_at
        )
        VALUES (?, ?, ?, NULL, ?, ?)
      `,
      [
        grnNumber,
        poRef.purchaseOrderId,
        receiverId,
        truncate(row["Notes/Remarks"], 500),
        `${excelSerialToDate(row["GRN date"]) ?? "2026-01-01"} 09:00:00`
      ]
    );

    const receipt = await query(
      `SELECT id FROM goods_receipts WHERE grn_number = ? LIMIT 1`,
      [grnNumber]
    );
    await query(
      `
        INSERT INTO goods_receipt_lines (
          goods_receipt_id,
          purchase_order_line_id,
          stock_item_id,
          quantity_received
        )
        VALUES (?, ?, ?, ?)
      `,
      [
        receipt[0].id,
        poRef.purchaseOrderLineId,
        poRef.stockItemId,
        parseNumber(row["Quantity recieved"], 0)
      ]
    );

    grnCount += 1;
  }

  return { poCount, grnCount };
}

async function main() {
  const workbookPath = process.argv[2];
  if (!workbookPath) {
    throw new Error("Usage: node src/scripts/import_workbook_operations.js <workbook-path>");
  }

  await ensureRole("EMPLOYEE", "Employee");
  await ensureRole("LINE_MANAGER", "Line Manager");
  await ensureRole("INVENTORY_OFFICER", "Inventory Officer");
  await ensureRole("PROCUREMENT_OFFICER", "Procurement Officer");
  await ensureRole("FINANCE", "Finance");
  await ensureRole("HR_OFFICER", "HR Officer");
  await ensureRole("SUPER_ADMIN", "Super Admin");

  const helpers = {
    async ensureManager(email) {
      return ensureUser({
        fullName: `Manager ${slugify(email).replace(/\./g, " ")}`,
        email,
        roleCode: "LINE_MANAGER",
        department: "Operations"
      });
    }
  };

  const data = extractWorkbookData(workbookPath);
  const requestCount = await importRequests(data, helpers);
  const transportCount = await importTransportRequests(data, helpers);
  const { poCount, grnCount } = await importPurchaseOrdersAndGrns(data, helpers);

  const requisitionTotal = await query(`SELECT COUNT(*) AS total FROM requisitions`);
  const purchaseOrderTotal = await query(`SELECT COUNT(*) AS total FROM purchase_orders`);
  const goodsReceiptTotal = await query(`SELECT COUNT(*) AS total FROM goods_receipts`);

  console.log(
    JSON.stringify(
      {
        imported: {
          requests: requestCount,
          transportRequests: transportCount,
          purchaseOrders: poCount,
          goodsReceipts: grnCount
        },
        totals: {
          requisitions: requisitionTotal[0].total,
          purchaseOrders: purchaseOrderTotal[0].total,
          goodsReceipts: goodsReceiptTotal[0].total
        }
      },
      null,
      2
    )
  );

  const pool = getPool();
  await pool.end();
}

main().catch(async (error) => {
  console.error(error);
  try {
    await getPool().end();
  } catch {}
  process.exit(1);
});
