import { query } from "../../config/db.js";
import { ROLES } from "../../config/roles.js";
import { listAuditLogs } from "../admin/admin.service.js";
import { listAnnouncements } from "../announcements/announcements.service.js";
import { listMyAttendance } from "../attendance/attendance.service.js";
import {
  listAllAdvances,
  listAllReimbursements,
  listMyAdvances,
  listMyReimbursements
} from "../employeeFinance/employeeFinance.service.js";
import {
  listPaymentHistory,
  listPayroll,
  listPendingPayments
} from "../finance/finance.service.js";
import {
  listInventoryStock,
  listInventoryTransactions
} from "../inventory/inventory.service.js";
import {
  getLeaveBalances,
  listAllLeaves,
  listMyLeaves,
  listTeamLeaves
} from "../leave/leave.service.js";
import { listMyNotifications } from "../notifications/notifications.service.js";
import {
  listGoodsReceipts,
  listPurchaseOrders,
  listVendors
} from "../procurement/procurement.service.js";
import { listMyTasks } from "../tasks/tasks.service.js";
import { listUsers } from "../users/users.service.js";

function statusLabel(status) {
  const normalized = String(status ?? "").toUpperCase();

  if (normalized === "PENDING_MANAGER") return "pending";
  if (normalized === "PENDING_HR") return "pending HR";
  if (normalized === "APPROVED") return "approved";
  if (normalized === "REJECTED") return "rejected";
  return String(status ?? "").toLowerCase();
}

function moneyLabel(value) {
  return `PKR ${Number(value ?? 0).toLocaleString()}`;
}

async function listDashboardRequests() {
  const rows = await query(
    `
      SELECT
        r.id,
        r.requisition_number,
        r.title,
        r.status,
        r.submitted_at,
        requester.full_name AS requester_name,
        GROUP_CONCAT(CONCAT(ri.item_description, ' x', ri.quantity_requested) ORDER BY ri.line_number SEPARATOR ', ') AS items_text,
        COALESCE(SUM(ri.quantity_requested), 0) AS total_quantity
      FROM requisitions r
      INNER JOIN users requester ON requester.id = r.requested_by_user_id
      LEFT JOIN requisition_items ri ON ri.requisition_id = r.id
      GROUP BY r.id, r.requisition_number, r.title, r.status, r.submitted_at, requester.full_name
      ORDER BY r.submitted_at DESC, r.id DESC
      LIMIT 100
    `
  );

  return rows.map((row) => ({
    id: row.id,
    item: row.items_text || row.title,
    qty: Number(row.total_quantity),
    from: row.requester_name,
    status: statusLabel(row.status),
    date: row.submitted_at,
    reason: row.requisition_number
  }));
}

function mapLeaveForPanel(leave) {
  return {
    id: leave.id,
    from: leave.employee?.fullName ?? "Employee",
    type: leave.type,
    start: leave.startDate,
    end: leave.endDate,
    days: leave.days,
    reason: leave.reason,
    status: statusLabel(leave.status),
    date: leave.createdAt,
    managerNote: leave.managerNote,
    hrNote: leave.hrNote
  };
}

function mapAdvanceForPanel(advance) {
  return {
    ...advance,
    amount: moneyLabel(advance.amount),
    approvedAmount: advance.approvedAmount === null ? null : moneyLabel(advance.approvedAmount)
  };
}

function mapClaimForPanel(claim) {
  return {
    ...claim,
    amount: moneyLabel(claim.amount)
  };
}

function mapStockForPanel(stockItem) {
  return {
    id: stockItem.id,
    sku: stockItem.sku,
    name: stockItem.itemName,
    qty: stockItem.quantityOnHand,
    min: stockItem.reorderLevel,
    unit: stockItem.unit,
    specification: stockItem.specification
  };
}

const permissions = [
  { role: "Employee", dashboard: true, approvals: false, finance: false, inventory: false, admin: false },
  { role: "Line Manager", dashboard: true, approvals: true, finance: false, inventory: false, admin: false },
  { role: "HR Officer", dashboard: true, approvals: true, finance: false, inventory: false, admin: false },
  { role: "Finance", dashboard: true, approvals: false, finance: true, inventory: false, admin: false },
  { role: "Inventory", dashboard: true, approvals: false, finance: false, inventory: true, admin: false },
  { role: "Procurement", dashboard: true, approvals: false, finance: false, inventory: true, admin: false },
  { role: "Super Admin", dashboard: true, approvals: true, finance: true, inventory: true, admin: true }
];

export async function getWorkspaceState(user) {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const [
    requests,
    leaves,
    stock,
    tasks,
    announcements,
    notifications,
    leaveBalances,
    users,
    advances,
    reimbursements,
    vendors,
    purchaseOrders,
    receipts,
    stockLogs,
    auditResult,
    payments,
    pendingPayments,
    payroll,
    attendance
  ] = await Promise.all([
    listDashboardRequests(),
    user.role === ROLES.LINE_MANAGER
      ? listTeamLeaves(user.id)
      : user.role === ROLES.HR_OFFICER || user.role === ROLES.SUPER_ADMIN
        ? listAllLeaves()
        : listMyLeaves(user.id),
    listInventoryStock(),
    listMyTasks(user.id),
    listAnnouncements({ includeInactive: user.role === ROLES.SUPER_ADMIN }),
    listMyNotifications(user.id),
    getLeaveBalances(user.id),
    listUsers(),
    user.role === ROLES.FINANCE || user.role === ROLES.SUPER_ADMIN
      ? listAllAdvances()
      : listMyAdvances(user.id),
    user.role === ROLES.FINANCE || user.role === ROLES.SUPER_ADMIN
      ? listAllReimbursements()
      : listMyReimbursements(user.id),
    listVendors(),
    listPurchaseOrders(),
    listGoodsReceipts(),
    listInventoryTransactions(),
    user.role === ROLES.SUPER_ADMIN ? listAuditLogs({ limit: 20 }) : Promise.resolve({ logs: [] }),
    listPaymentHistory(),
    user.role === ROLES.FINANCE || user.role === ROLES.SUPER_ADMIN
      ? listPendingPayments()
      : Promise.resolve([]),
    user.role === ROLES.FINANCE || user.role === ROLES.HR_OFFICER || user.role === ROLES.SUPER_ADMIN
      ? listPayroll({ month, year })
      : Promise.resolve([]),
    listMyAttendance(user.id)
  ]);

  return {
    requests,
    leaves: leaves.map(mapLeaveForPanel),
    stock: stock.map(mapStockForPanel),
    tasks,
    announcements: announcements.map((item) => ({
      id: item.id,
      title: item.title,
      message: item.content,
      audience: item.audience,
      owner: item.owner,
      date: item.createdAt
    })),
    notifications: notifications.map((notification) => ({
      id: notification.id,
      subject: notification.subject,
      message: notification.payload?.message ?? notification.subject,
      status: String(notification.status).toLowerCase(),
      route: notification.entityType,
      time: notification.createdAt
    })),
    leaveBalances,
    users: users.map((item) => ({
      fullName: item.fullName,
      email: item.email,
      role: item.role,
      department: item.department,
      status: String(item.status).toLowerCase(),
      id: item.id
    })),
    advances: advances.map(mapAdvanceForPanel),
    reimbursements: reimbursements.map(mapClaimForPanel),
    vendors: vendors.map((vendor) => ({
      id: vendor.id,
      name: vendor.vendorName,
      vendorCode: vendor.vendorCode,
      category: vendor.category ?? "General",
      contact: vendor.email ?? vendor.phone ?? "-",
      rating: vendor.status
    })),
    purchaseOrders: [
      ...purchaseOrders.map((po) => ({
        ...po,
        items: po.requisitionNumber,
        amount: moneyLabel(po.amount),
        payment: po.status === "paid" ? "paid" : "pending"
      })),
      ...pendingPayments.map((payment) => ({
        id: payment.id,
        number: payment.poNumber,
        vendor: payment.vendorName,
        items: "Received goods",
        amount: moneyLabel(payment.totalAmount),
        delivery: payment.grnReceivedAt,
        status: String(payment.status).toLowerCase(),
        grn: "Received",
        payment: "pending"
      }))
    ],
    receipts: receipts.map((receipt) => ({
      ...receipt,
      items: moneyLabel(receipt.amount)
    })),
    stockLogs: stockLogs.map((log) => ({
      id: log.id,
      time: log.createdAt,
      item: log.itemName,
      movement: `${log.type === "ISSUE" || log.type === "ADJUSTMENT_OUT" ? "-" : "+"}${log.quantity}`,
      actor: log.actor.fullName,
      reference: log.reference
    })),
    auditLogs: auditResult.logs,
    payments: payments.map((payment) => ({
      ...payment,
      amount: moneyLabel(payment.amount)
    })),
    payroll,
    attendance,
    permissions
  };
}

export async function getDashboardStats(user) {
  const rows = await query(
    `
      SELECT
        (SELECT COUNT(*) FROM users WHERE status = 'ACTIVE') AS active_users,
        (SELECT COUNT(*) FROM leave_requests WHERE status IN ('PENDING_MANAGER', 'PENDING_HR')) AS pending_leaves,
        (SELECT COUNT(*) FROM requisitions WHERE status IN ('SUBMITTED', 'APPROVED', 'PROCUREMENT_PENDING')) AS pending_requests,
        (SELECT COUNT(*) FROM inventory_stock WHERE quantity_on_hand <= reorder_level) AS low_stock,
        (SELECT COUNT(*) FROM attendance WHERE attendance_date = CURRENT_DATE() AND status = 'PRESENT') AS present_today,
        (SELECT COUNT(*) FROM advance_requests WHERE status = 'PENDING') AS pending_advances,
        (SELECT COUNT(*) FROM reimbursement_claims WHERE status = 'PENDING') AS pending_reimbursements
    `
  );

  return {
    role: user.role,
    ...rows[0]
  };
}
