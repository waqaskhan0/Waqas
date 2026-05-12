import { useCallback, useEffect, useMemo, useState } from "react";
import { apiClient } from "../api/client.js";
import { EmployeeRequisitionWorkspace } from "../components/EmployeeRequisitionWorkspace.jsx";
import {
  AdvancePanel,
  AdminOverviewPanel,
  AllRequestsPanel,
  AnnouncementsPanel,
  AuditPanel,
  ComingSoonPanel,
  EmployeeActivityPanel,
  FinanceAdvancePanel,
  FinancePaymentsPanel,
  FinanceReimbursementPanel,
  GoodsReceiptPanel,
  LeaveAdminPanel,
  LeavePanel,
  LocalRequestsPanel,
  OverviewPanel,
  PayrollPanel,
  PaymentHistoryPanel,
  PermissionsPanel,
  PurchaseOrdersPanel,
  ReimbursementClaimPanel,
  SettingsPanel,
  StockLogPanel,
  StockPanel,
  UserManagementPanel,
  VendorsPanel,
  WorkPlanPanel,
  AttendancePanel
} from "../components/ErpLocalPanels.jsx";
import { FinanceWorkspace } from "../components/FinanceWorkspace.jsx";
import { InventoryWorkspace } from "../components/InventoryWorkspace.jsx";
import { ManagerApprovalWorkspace } from "../components/ManagerApprovalWorkspace.jsx";
import { NotificationInbox } from "../components/NotificationInbox.jsx";
import { ProcurementWorkspace } from "../components/ProcurementWorkspace.jsx";
import { ReceivingWorkspace } from "../components/ReceivingWorkspace.jsx";
import { useAuth } from "../context/AuthContext.jsx";

const roleConfig = {
  EMPLOYEE: {
    label: "Employee",
    accent: "role-employee",
    nav: [
      { icon: "DS", label: "Dashboard", panel: "overview" },
      { icon: "RQ", label: "Requisitions", panel: "employee-requests" },
      { icon: "LV", label: "Leave Application", panel: "leave" },
      { icon: "WP", label: "Work Plan", panel: "workplan" },
      { icon: "AT", label: "Attendance", panel: "attendance" },
      { icon: "AD", label: "Advance Request", panel: "advance" },
      { icon: "RB", label: "Reimbursement", panel: "reimbursement" },
      { icon: "NT", label: "Notifications", panel: "notifications" }
    ]
  },
  LINE_MANAGER: {
    label: "Line Manager",
    accent: "role-manager",
    nav: [
      { icon: "DS", label: "Dashboard", panel: "overview" },
      { icon: "AP", label: "Pending Approvals", panel: "manager-approvals", badge: 2 },
      { icon: "LV", label: "Leave Management", panel: "leave-admin", badge: 2 },
      { icon: "RQ", label: "My Requests", panel: "employee-requests" },
      { icon: "ML", label: "My Leave", panel: "leave" },
      { icon: "AT", label: "Team Attendance", panel: "attendance" },
      { icon: "WP", label: "Work Plan", panel: "workplan" },
      { icon: "NT", label: "Notifications", panel: "notifications" }
    ]
  },
  INVENTORY_OFFICER: {
    label: "Inventory Officer",
    accent: "role-inventory",
    nav: [
      { icon: "DS", label: "Dashboard", panel: "overview" },
      { icon: "ST", label: "Stock Overview", panel: "stock" },
      { icon: "IQ", label: "Item Requests", panel: "inventory-control", badge: 2 },
      { icon: "GR", label: "Goods Receiving", panel: "receiving" },
      { icon: "TX", label: "Stock Transactions", panel: "stock-log" },
      { icon: "RQ", label: "My Requests", panel: "employee-requests" },
      { icon: "LV", label: "Leave", panel: "leave" },
      { icon: "N", label: "Notifications", panel: "notifications" }
    ]
  },
  PROCUREMENT_OFFICER: {
    label: "Procurement Officer",
    accent: "role-procurement",
    nav: [
      { icon: "DS", label: "Dashboard", panel: "overview" },
      { icon: "PQ", label: "Procurement Queue", panel: "procurement", badge: 1 },
      { icon: "VN", label: "Vendors", panel: "vendors" },
      { icon: "PO", label: "Purchase Orders", panel: "purchase-orders" },
      { icon: "GR", label: "GRN", panel: "grn" },
      { icon: "RQ", label: "My Requests", panel: "employee-requests" },
      { icon: "LV", label: "Leave", panel: "leave" },
      { icon: "NT", label: "Notifications", panel: "notifications" }
    ]
  },
  FINANCE: {
    label: "Finance Officer",
    accent: "role-finance",
    nav: [
      { icon: "DS", label: "Dashboard", panel: "overview" },
      { icon: "FM", label: "3-Way Match", panel: "finance-match", badge: 3 },
      { icon: "PY", label: "PO and Payments", panel: "finance-payments" },
      { icon: "AD", label: "Advance Requests", panel: "finance-advance" },
      { icon: "RB", label: "Reimbursements", panel: "finance-reimbursements" },
      { icon: "PR", label: "Payroll", panel: "payroll" },
      { icon: "PH", label: "Payment History", panel: "payment-history" },
      { icon: "RQ", label: "My Requests", panel: "employee-requests" },
      { icon: "LV", label: "Leave", panel: "leave" },
      { icon: "NT", label: "Notifications", panel: "notifications" }
    ]
  },
  HR_OFFICER: {
    label: "HR Officer",
    accent: "role-hr",
    nav: [
      { icon: "DS", label: "Dashboard", panel: "overview" },
      { icon: "LA", label: "Leave Final Approval", panel: "leave-admin", badge: 3 },
      { icon: "AT", label: "Attendance", panel: "attendance" },
      { icon: "AN", label: "Announcements", panel: "announcements" },
      { icon: "AL", label: "Activity Log", panel: "activity-log" },
      { icon: "PC", label: "Payroll Coordination", panel: "payroll" },
      { icon: "RQ", label: "My Requests", panel: "employee-requests" },
      { icon: "LV", label: "Leave", panel: "leave" },
      { icon: "NT", label: "Notifications", panel: "notifications" }
    ]
  },
  SUPER_ADMIN: {
    label: "Super Admin",
    accent: "role-admin",
    nav: [
      { icon: "DS", label: "System Overview", panel: "admin-overview" },
      { icon: "US", label: "User Management", panel: "admin-users" },
      { icon: "AR", label: "All Requests", panel: "all-requests" },
      { icon: "ER", label: "Requisitions", panel: "employee-requests" },
      { icon: "AP", label: "Pending Approvals", panel: "manager-approvals", badge: 2 },
      { icon: "ST", label: "Stock Overview", panel: "stock" },
      { icon: "IQ", label: "Item Requests", panel: "inventory-control", badge: 2 },
      { icon: "GR", label: "Goods Receiving", panel: "receiving" },
      { icon: "TX", label: "Stock Transactions", panel: "stock-log" },
      { icon: "PQ", label: "Procurement Queue", panel: "procurement", badge: 1 },
      { icon: "VN", label: "Vendors", panel: "vendors" },
      { icon: "PO", label: "Purchase Orders", panel: "purchase-orders" },
      { icon: "FM", label: "3-Way Match", panel: "finance-match", badge: 3 },
      { icon: "PY", label: "PO and Payments", panel: "finance-payments" },
      { icon: "AD", label: "Advance Requests", panel: "finance-advance" },
      { icon: "RB", label: "Reimbursements", panel: "finance-reimbursements" },
      { icon: "PR", label: "Payroll", panel: "payroll" },
      { icon: "PH", label: "Payment History", panel: "payment-history" },
      { icon: "LV", label: "Leave Management", panel: "leave-admin", badge: 2 },
      { icon: "AT", label: "Attendance", panel: "attendance" },
      { icon: "AN", label: "Announcements", panel: "announcements" },
      { icon: "AU", label: "Audit Logs", panel: "audit" },
      { icon: "ST", label: "Settings", panel: "settings" },
      { icon: "RP", label: "Roles & Permissions", panel: "permissions" },
      { icon: "NT", label: "Notifications", panel: "notifications" }
    ]
  }
};

const moduleCatalog = [
  {
    id: "requisitions",
    icon: "RQ",
    title: "Requisitions",
    summary: "Create requests, review approvals, and inspect request history.",
    accent: "teal",
    defaultPanel: "employee-requests",
    nav: [
      { icon: "RQ", label: "My Requisitions", panel: "employee-requests" },
      { icon: "AP", label: "Pending Approvals", panel: "manager-approvals", badge: 2 },
      { icon: "AR", label: "All Requests", panel: "all-requests" }
    ]
  },
  {
    id: "inventory",
    icon: "ST",
    title: "Inventory",
    summary: "Track stock, requests, history, and issuance.",
    accent: "blue",
    defaultPanel: "inventory-dashboard",
    nav: [
      { icon: "DS", label: "Inventory Dashboard", panel: "inventory-dashboard" },
      { icon: "RQ", label: "Requests", panel: "inventory-control", badge: 2 },
      { icon: "ST", label: "Stock", panel: "stock" },
      { icon: "HS", label: "Stock History", panel: "stock-log" },
      { icon: "IS", label: "Issuance", panel: "issuance" },
      { icon: "GR", label: "GRN", panel: "grn" }
    ]
  },
  {
    id: "procurement",
    icon: "PO",
    title: "Procurement",
    summary: "Manage procurement queues, vendors, POs, and GRNs.",
    accent: "amber",
    defaultPanel: "procurement",
    nav: [
      { icon: "PQ", label: "Procurement Queue", panel: "procurement", badge: 1 },
      { icon: "VN", label: "Vendors", panel: "vendors" },
      { icon: "PO", label: "Purchase Orders", panel: "purchase-orders" },
      { icon: "GR", label: "GRN", panel: "grn" }
    ]
  },
  {
    id: "finance",
    icon: "FN",
    title: "Finance",
    summary: "Match invoices, release payments, and review finance requests.",
    accent: "green",
    defaultPanel: "finance-match",
    nav: [
      { icon: "FM", label: "3-Way Match", panel: "finance-match", badge: 3 },
      { icon: "PY", label: "PO and Payments", panel: "finance-payments" },
      { icon: "AD", label: "Advance Requests", panel: "finance-advance" },
      { icon: "RB", label: "Reimbursements", panel: "finance-reimbursements" },
      { icon: "PR", label: "Payroll", panel: "payroll" },
      { icon: "PH", label: "Payment History", panel: "payment-history" }
    ]
  },
  {
    id: "people",
    icon: "HR",
    title: "People and HR",
    summary: "Handle leave, attendance, work plans, and announcements.",
    accent: "pink",
    defaultPanel: "leave-admin",
    nav: [
      { icon: "LV", label: "Leave Management", panel: "leave-admin", badge: 2 },
      { icon: "ML", label: "My Leave", panel: "leave" },
      { icon: "AT", label: "Attendance", panel: "attendance" },
      { icon: "WP", label: "Work Plan", panel: "workplan" },
      { icon: "AN", label: "Announcements", panel: "announcements" },
      { icon: "AL", label: "Activity Log", panel: "activity-log" }
    ]
  },
  {
    id: "admin",
    icon: "AD",
    title: "Administration",
    summary: "Manage users, permissions, settings, and audit records.",
    accent: "purple",
    defaultPanel: "admin-overview",
    nav: [
      { icon: "DS", label: "System Overview", panel: "admin-overview" },
      { icon: "US", label: "User Management", panel: "admin-users" },
      { icon: "RP", label: "Roles & Permissions", panel: "permissions" },
      { icon: "AU", label: "Audit Logs", panel: "audit" },
      { icon: "ST", label: "Settings", panel: "settings" }
    ]
  },
  {
    id: "notifications",
    icon: "NT",
    title: "Notifications",
    summary: "Read system alerts and workflow messages.",
    accent: "red",
    defaultPanel: "notifications",
    nav: [{ icon: "NT", label: "Inbox", panel: "notifications" }]
  }
];

function ModuleIcon({ type }) {
  const commonProps = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.8",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": "true",
    focusable: "false"
  };

  const icons = {
    requisitions: (
      <svg {...commonProps}>
        <path d="M8 4h8" />
        <path d="M9 2h6l1 3H8l1-3Z" />
        <path d="M6 5h12v16H6V5Z" />
        <path d="M9 10h6" />
        <path d="M9 14h4" />
        <path d="M8.5 18h.01" />
        <path d="M11 18h4" />
      </svg>
    ),
    inventory: (
      <svg {...commonProps}>
        <path d="M3 8.5 12 4l9 4.5-9 4.5-9-4.5Z" />
        <path d="M3 8.5V16l9 4.5 9-4.5V8.5" />
        <path d="M12 13v7.5" />
        <path d="m7.5 6.25 9 4.5" />
      </svg>
    ),
    procurement: (
      <svg {...commonProps}>
        <path d="M6 7h15l-2 8H8L6 7Z" />
        <path d="M6 7 5.4 4H3" />
        <path d="M9 20a1.4 1.4 0 1 0 0-2.8A1.4 1.4 0 0 0 9 20Z" />
        <path d="M18 20a1.4 1.4 0 1 0 0-2.8A1.4 1.4 0 0 0 18 20Z" />
        <path d="M9 11h8" />
      </svg>
    ),
    finance: (
      <svg {...commonProps}>
        <path d="M4 19h16" />
        <path d="M7 16V9" />
        <path d="M12 16V5" />
        <path d="M17 16v-4" />
        <path d="M6 9h2" />
        <path d="M11 5h2" />
        <path d="M16 12h2" />
        <path d="M8.5 6.5 12 3l3.5 3.5" />
      </svg>
    ),
    people: (
      <svg {...commonProps}>
        <path d="M16 11a4 4 0 1 0-8 0" />
        <path d="M5 20a7 7 0 0 1 14 0" />
        <path d="M18 9.5a3 3 0 0 1 3 3" />
        <path d="M3 12.5a3 3 0 0 1 3-3" />
      </svg>
    ),
    admin: (
      <svg {...commonProps}>
        <path d="M12 3 5 6v5c0 4.4 2.9 8.2 7 10 4.1-1.8 7-5.6 7-10V6l-7-3Z" />
        <path d="M12 8v4" />
        <path d="M12 16h.01" />
      </svg>
    ),
    notifications: (
      <svg {...commonProps}>
        <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z" />
        <path d="M10 21h4" />
        <path d="M15.5 4.5 18 2" />
      </svg>
    )
  };

  return icons[type] ?? icons.requisitions;
}

function NavIcon({ item, name }) {
  const commonProps = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.9",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": "true",
    focusable: "false"
  };
  const key = item?.moduleId ?? item?.panel ?? name ?? "";

  const icons = {
    home: (
      <svg {...commonProps}>
        <path d="m3 11 9-7 9 7" />
        <path d="M5 10v10h14V10" />
        <path d="M9 20v-6h6v6" />
      </svg>
    ),
    overview: (
      <svg {...commonProps}>
        <path d="M4 13h6V4H4v9Z" />
        <path d="M14 20h6V4h-6v16Z" />
        <path d="M4 20h6v-3H4v3Z" />
      </svg>
    ),
    requisitions: (
      <svg {...commonProps}>
        <path d="M8 4h8" />
        <path d="M9 2h6l1 3H8l1-3Z" />
        <path d="M6 5h12v16H6V5Z" />
        <path d="M9 10h6" />
        <path d="M9 14h4" />
        <path d="m9 18 1.4 1.4L15 15" />
      </svg>
    ),
    "employee-requests": null,
    "all-requests": null,
    "manager-approvals": (
      <svg {...commonProps}>
        <path d="M16 3h5v5" />
        <path d="M21 3 12 12" />
        <path d="m9 12 2 2 5-5" />
        <path d="M4 5h8" />
        <path d="M4 19h16" />
      </svg>
    ),
    inventory: null,
    "inventory-dashboard": null,
    stock: null,
    "inventory-control": null,
    "stock-log": (
      <svg {...commonProps}>
        <path d="M4 5h16" />
        <path d="M4 12h16" />
        <path d="M4 19h16" />
        <path d="M8 5v14" />
      </svg>
    ),
    issuance: (
      <svg {...commonProps}>
        <path d="M12 3v12" />
        <path d="m7 10 5 5 5-5" />
        <path d="M5 21h14" />
      </svg>
    ),
    receiving: (
      <svg {...commonProps}>
        <path d="M3 7.5 12 3l9 4.5-9 4.5-9-4.5Z" />
        <path d="M3 7.5V16l9 5 9-5V7.5" />
        <path d="m9 16 2 2 4-5" />
      </svg>
    ),
    grn: null,
    procurement: null,
    vendors: (
      <svg {...commonProps}>
        <path d="M4 21V8l8-5 8 5v13" />
        <path d="M9 21v-6h6v6" />
        <path d="M8 10h.01" />
        <path d="M12 10h.01" />
        <path d="M16 10h.01" />
      </svg>
    ),
    "purchase-orders": (
      <svg {...commonProps}>
        <path d="M7 4h14l-2 9H8L7 4Z" />
        <path d="M7 4 6.4 2H3" />
        <path d="M9 21a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" />
        <path d="M18 21a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" />
      </svg>
    ),
    finance: null,
    "finance-match": (
      <svg {...commonProps}>
        <path d="M7 7h10" />
        <path d="M7 12h10" />
        <path d="M7 17h6" />
        <path d="m15 17 2 2 4-5" />
        <path d="M4 4h16v16H4V4Z" />
      </svg>
    ),
    "finance-payments": (
      <svg {...commonProps}>
        <path d="M3 7h18v10H3V7Z" />
        <path d="M7 12h.01" />
        <path d="M17 12h.01" />
        <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
      </svg>
    ),
    "finance-advance": (
      <svg {...commonProps}>
        <path d="M12 19V5" />
        <path d="m7 10 5-5 5 5" />
        <path d="M5 19h14" />
      </svg>
    ),
    "finance-reimbursements": (
      <svg {...commonProps}>
        <path d="M6 3h12v18H6V3Z" />
        <path d="M9 8h6" />
        <path d="M9 12h6" />
        <path d="m9 16 1.4 1.4L15 13" />
      </svg>
    ),
    payroll: (
      <svg {...commonProps}>
        <path d="M4 5h16v14H4V5Z" />
        <path d="M8 9h8" />
        <path d="M8 13h4" />
        <path d="M16 17h.01" />
      </svg>
    ),
    "payment-history": (
      <svg {...commonProps}>
        <path d="M3 12a9 9 0 1 0 3-6.7" />
        <path d="M3 4v5h5" />
        <path d="M12 7v5l3 2" />
      </svg>
    ),
    people: null,
    "leave-admin": null,
    leave: null,
    attendance: (
      <svg {...commonProps}>
        <path d="M7 3v4" />
        <path d="M17 3v4" />
        <path d="M4 7h16" />
        <path d="M5 5h14v16H5V5Z" />
        <path d="m9 15 2 2 4-5" />
      </svg>
    ),
    workplan: (
      <svg {...commonProps}>
        <path d="M5 4h14v16H5V4Z" />
        <path d="M8 8h8" />
        <path d="M8 12h8" />
        <path d="M8 16h5" />
      </svg>
    ),
    announcements: (
      <svg {...commonProps}>
        <path d="M4 11v2a3 3 0 0 0 3 3h1l3 4v-4h3l6 3V5l-6 3H7a3 3 0 0 0-3 3Z" />
      </svg>
    ),
    "activity-log": (
      <svg {...commonProps}>
        <path d="M4 4h16v16H4V4Z" />
        <path d="M8 9h8" />
        <path d="M8 13h5" />
        <path d="M8 17h8" />
      </svg>
    ),
    admin: null,
    "admin-overview": (
      <svg {...commonProps}>
        <path d="M12 3 5 6v5c0 4.4 2.9 8.2 7 10 4.1-1.8 7-5.6 7-10V6l-7-3Z" />
        <path d="M9 12h6" />
        <path d="M12 9v6" />
      </svg>
    ),
    "admin-users": (
      <svg {...commonProps}>
        <path d="M16 21v-2a4 4 0 0 0-8 0v2" />
        <path d="M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
        <path d="M19 8v6" />
        <path d="M22 11h-6" />
      </svg>
    ),
    permissions: (
      <svg {...commonProps}>
        <path d="M12 3 5 6v5c0 4.4 2.9 8.2 7 10 4.1-1.8 7-5.6 7-10V6l-7-3Z" />
        <path d="M9 12h6" />
      </svg>
    ),
    audit: (
      <svg {...commonProps}>
        <path d="M5 4h14v16H5V4Z" />
        <path d="M8 8h8" />
        <path d="M8 12h8" />
        <path d="M8 16h3" />
        <path d="m15 16 1.5 1.5L20 14" />
      </svg>
    ),
    settings: (
      <svg {...commonProps}>
        <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.05.05-2 3-.07-.03a1.7 1.7 0 0 0-1.95.12 1.7 1.7 0 0 0-.7 1.79V22h-6v-.19a1.7 1.7 0 0 0-.7-1.79 1.7 1.7 0 0 0-1.95-.12l-.07.03-2-3 .05-.05A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.42-1.1H3v-3h.18A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.88l-.05-.05 2-3 .07.03a1.7 1.7 0 0 0 1.95-.12A1.7 1.7 0 0 0 8.93 2H9h6v.19a1.7 1.7 0 0 0 .7 1.79 1.7 1.7 0 0 0 1.95.12l.07-.03 2 3-.05.05A1.7 1.7 0 0 0 19.4 9a1.7 1.7 0 0 0 1.42 1.1H21v3h-.18A1.7 1.7 0 0 0 19.4 15Z" />
      </svg>
    ),
    notifications: (
      <svg {...commonProps}>
        <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z" />
        <path d="M10 21h4" />
      </svg>
    )
  };

  icons["employee-requests"] = icons.requisitions;
  icons["all-requests"] = icons.requisitions;
  icons.inventory = ModuleIcon({ type: "inventory" });
  icons["inventory-dashboard"] = icons.inventory;
  icons.stock = icons.inventory;
  icons["inventory-control"] = icons.inventory;
  icons.grn = icons.receiving;
  icons.procurement = ModuleIcon({ type: "procurement" });
  icons.finance = ModuleIcon({ type: "finance" });
  icons.people = ModuleIcon({ type: "people" });
  icons["leave-admin"] = (
    <svg {...commonProps}>
      <path d="M7 3v4" />
      <path d="M17 3v4" />
      <path d="M4 7h16" />
      <path d="M5 5h14v16H5V5Z" />
      <path d="M9 14h6" />
    </svg>
  );
  icons.leave = icons["leave-admin"];
  icons.admin = ModuleIcon({ type: "admin" });

  return icons[key] ?? icons.overview;
}

function SidebarToggleIcon({ collapsed }) {
  const commonProps = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": "true",
    focusable: "false"
  };

  return collapsed ? (
    <svg {...commonProps}>
      <path d="m9 18 6-6-6-6" />
    </svg>
  ) : (
    <svg {...commonProps}>
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

const initialDemoState = {
  requests: [],
  leaves: [],
  stock: [],
  tasks: [],
  announcements: [],
  notifications: [],
  leaveBalances: [
    { type: "Annual", total: 0, used: 0, remaining: 0 },
    { type: "Sick", total: 0, used: 0, remaining: 0 },
    { type: "Casual", total: 0, used: 0, remaining: 0 },
    { type: "Carry forward", total: 0, used: 0, remaining: 0 }
  ],
  users: [],
  advances: [],
  reimbursements: [],
  vendors: [],
  purchaseOrders: [],
  receipts: [],
  stockLogs: [],
  auditLogs: [],
  payments: [],
  permissions: [
    { role: "Employee", dashboard: true, approvals: false, finance: false, inventory: false, admin: false },
    { role: "Line Manager", dashboard: true, approvals: true, finance: false, inventory: false, admin: false },
    { role: "HR Officer", dashboard: true, approvals: true, finance: false, inventory: false, admin: false },
    { role: "Finance", dashboard: true, approvals: false, finance: true, inventory: false, admin: false },
    { role: "Inventory", dashboard: true, approvals: false, finance: false, inventory: true, admin: false },
    { role: "Procurement", dashboard: true, approvals: false, finance: false, inventory: true, admin: false },
    { role: "Super Admin", dashboard: true, approvals: true, finance: true, inventory: true, admin: true }
  ]
};

const emptyInventoryDashboard = {
  summary: {
    totalRequests: 0,
    pendingApprovals: 0,
    approvedRequests: 0,
    rejectedRequests: 0,
    lowStockItems: 0,
    outOfStockItems: 0
  },
  recentRequests: [],
  pendingApprovals: [],
  procurementAlerts: [],
  recentActivity: []
};

function formatDateLabel() {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date());
}

function formatRole(role) {
  return String(role ?? "")
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function getInitials(name) {
  return String(name ?? "User")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function formatShortDate(value) {
  if (!value) {
    return "Not set";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(date);
}

function getBadgeTone(value) {
  const normalized = String(value ?? "").toLowerCase();

  if (normalized.includes("reject") || normalized.includes("out")) {
    return "red";
  }

  if (normalized.includes("pending") || normalized.includes("awaiting") || normalized.includes("partial")) {
    return "amber";
  }

  if (normalized.includes("approved") || normalized.includes("issued") || normalized.includes("received")) {
    return "green";
  }

  if (normalized.includes("procurement")) {
    return "purple";
  }

  return "gray";
}

function MiniBadge({ tone = "gray", children }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

function SimpleTable({ headers, rows, emptyMessage }) {
  if (!rows.length) {
    return <p className="helper-text">{emptyMessage}</p>;
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {headers.map((header) => (
              <th key={header}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, cellIndex) => (
                <td key={`${rowIndex}-${cellIndex}`}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DetailField({ label, value }) {
  return (
    <div className="request-detail-field">
      <span>{label}</span>
      <strong>{value || "Not provided"}</strong>
    </div>
  );
}

function ModuleHome({ user, modules, openingModuleId, onOpenModule }) {
  return (
    <section className="module-home">
      <div className="module-home-hero">
        <p className="eyebrow">Home</p>
        <h1>Welcome to your workspace, {user.fullName}.</h1>
        <p className="module-home-welcome">New user, welcome aboard. Existing user, welcome back.</p>
        <p className="module-home-prompt">What would you like to work on today?</p>
      </div>

      <div className="module-grid" aria-label="System modules">
        {modules.map((module, index) => {
          const isOpening = openingModuleId === module.id;

          return (
            <button
              key={module.id}
              type="button"
              className={`module-card module-${module.accent}${isOpening ? " loading" : ""}`}
              style={{ "--module-delay": `${index * 55}ms` }}
              onClick={() => onOpenModule(module.id)}
            >
              <span className="module-card-icon">
                <ModuleIcon type={module.id} />
              </span>
              <span className="module-card-body">
                <strong>{module.title}</strong>
                <span>{module.summary}</span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function InventoryDashboardPanel({ dashboard, isLoading, error, onNavigate }) {
  const summaryCards = [
    ["Total requests", dashboard.summary.totalRequests, "all requisitions", "blue"],
    ["Pending approvals", dashboard.summary.pendingApprovals, "waiting for manager approval", "amber"],
    ["Approved requests", dashboard.summary.approvedRequests, "ready, issued, or in procurement", "green"],
    ["Rejected requests", dashboard.summary.rejectedRequests, "declined by approvers", "red"],
    ["Low stock items", dashboard.summary.lowStockItems, "at or below reorder level", "purple"],
    ["Out of stock items", dashboard.summary.outOfStockItems, "zero quantity on hand", "red"]
  ];

  const recentRequestRows = dashboard.recentRequests.map((request) => [
    <span key={`${request.id}-number`} className="mono">
      {request.requisitionNumber}
    </span>,
    request.requestedBy,
    request.department,
    formatShortDate(request.submittedAt),
    <MiniBadge key={`${request.id}-approval`} tone={getBadgeTone(request.approvalStatus)}>
      {request.approvalStatus}
    </MiniBadge>,
    <MiniBadge key={`${request.id}-issuance`} tone={getBadgeTone(request.issuanceStatus)}>
      {request.issuanceStatus}
    </MiniBadge>
  ]);

  const pendingApprovalRows = dashboard.pendingApprovals.map((request) => [
    <span key={`${request.id}-pending-number`} className="mono">
      {request.requisitionNumber}
    </span>,
    request.requestedBy,
    request.department,
    formatShortDate(request.submittedAt),
    <MiniBadge key={`${request.id}-pending-status`} tone="amber">
      Waiting for manager
    </MiniBadge>
  ]);

  return (
    <div className="workspace-stack inventory-dashboard">
      {error ? <p className="form-error">{error}</p> : null}
      {isLoading ? <p className="helper-text">Loading inventory dashboard...</p> : null}

      <div className="stats-grid inventory-summary-grid">
        {summaryCards.map(([label, value, subtext, tone]) => (
          <div key={label} className={`stat-card ${tone}`}>
            <div className="stat-label">{label}</div>
            <div className="stat-val">{value}</div>
            <div className="stat-sub">{subtext}</div>
          </div>
        ))}
      </div>

      <article className="card">
        <div className="card-header">
          <div>
            <p className="section-label">Requests</p>
            <h2 className="card-title">Recent requests</h2>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => onNavigate("inventory-control")}>
            Open requests
          </button>
        </div>
        <SimpleTable
          headers={["Request ID", "Requested by", "Department", "Date", "Approval", "Issuance"]}
          rows={recentRequestRows}
          emptyMessage="No requisitions have been submitted yet."
        />
      </article>

      <section className="two-col">
        <article className="card">
          <div className="card-header">
            <div>
              <p className="section-label">Manager queue</p>
              <h2 className="card-title">Pending approvals</h2>
            </div>
          </div>
          <SimpleTable
            headers={["Request ID", "Requested by", "Department", "Date", "Status"]}
            rows={pendingApprovalRows}
            emptyMessage="No requests are waiting for manager approval."
          />
        </article>

        <article className="card">
          <div className="card-header">
            <div>
              <p className="section-label">Procurement</p>
              <h2 className="card-title">Procurement alerts</h2>
            </div>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => onNavigate("procurement")}>
              Procurement queue
            </button>
          </div>
          {!dashboard.procurementAlerts.length ? (
            <p className="helper-text">No procurement handoffs are waiting right now.</p>
          ) : (
            <div className="alert-list">
              {dashboard.procurementAlerts.map((alert) => (
                <div key={alert.id} className="inventory-alert">
                  <div>
                    <strong>{alert.requisitionNumber}</strong>
                    <p>{alert.title}</p>
                  </div>
                  <small>
                    {alert.department} | {alert.quantityForProcurement} item(s) routed on{" "}
                    {formatShortDate(alert.processedAt)}
                  </small>
                </div>
              ))}
            </div>
          )}
        </article>
      </section>

      <article className="card">
        <div className="card-header">
          <div>
            <p className="section-label">Audit trail</p>
            <h2 className="card-title">Recent activity</h2>
          </div>
        </div>
        {!dashboard.recentActivity.length ? (
          <p className="helper-text">Activity will appear after requests, approvals, issuance, GRNs, or POs are recorded.</p>
        ) : (
          <div className="timeline-list inventory-activity-list">
            {dashboard.recentActivity.map((activity) => (
              <div key={activity.id} className="timeline-item">
                <span className="timeline-marker" />
                <div>
                  <strong>{activity.title}</strong>
                  <p>
                    <span className="mono">{activity.reference}</span>
                    {activity.actor ? ` by ${activity.actor}` : ""}
                  </p>
                  <small>{formatShortDate(activity.occurredAt)}</small>
                </div>
              </div>
            ))}
          </div>
        )}
      </article>
    </div>
  );
}

function findIssuableStock(request, stock) {
  const requestStockId = request.stockItem?.id;
  const requestItemId = String(request.itemId ?? "").toLowerCase();
  const requestItemName = String(request.itemName ?? "").toLowerCase();

  return stock.find((item) => {
    const stockId = item.id;
    const sku = String(item.sku ?? item.itemId ?? "").toLowerCase();
    const stockName = String(item.name ?? "").toLowerCase();

    return (
      (requestStockId && stockId === requestStockId) ||
      (requestItemId && sku === requestItemId) ||
      (requestItemName && stockName.includes(requestItemName)) ||
      (stockName && requestItemName.includes(stockName))
    );
  });
}

function getLocalIssuedQuantity(records, requestId) {
  return records
    .filter((record) => record.requestId === requestId)
    .reduce((total, record) => total + Number(record.quantity ?? 0), 0);
}

function IssuancePanel({ requests, stock, issuedRecords, onIssue }) {
  const [view, setView] = useState("to-issue");
  const [activeRequestId, setActiveRequestId] = useState(null);
  const [issueModes, setIssueModes] = useState({});
  const [partialQuantities, setPartialQuantities] = useState({});
  const [issueError, setIssueError] = useState("");
  const approvedRequests = requests.filter((request) => {
    const approvalStatus = String(request.approvalStatus ?? "").toLowerCase();
    const stockItem = findIssuableStock(request, stock);
    const localIssued = getLocalIssuedQuantity(issuedRecords, request.id);
    const requestedQuantity = Number(request.quantityRequested ?? 0);
    const alreadyIssued = Number(request.issuedQuantity ?? 0) + localIssued;
    const remainingQuantity = Math.max(0, requestedQuantity - alreadyIssued);
    const availableQuantity = Number(stockItem?.availableQty ?? stockItem?.quantityOnHand ?? 0);

    return approvalStatus === "approved" && stockItem && availableQuantity > 0 && remainingQuantity > 0;
  });

  const issuedApiRecords = requests
    .filter((request) => Number(request.issuedQuantity ?? 0) > 0)
    .map((request) => ({
      id: `api-${request.id}`,
      requestId: request.id,
      requestNumber: request.requestId,
      itemName: request.itemName,
      itemId: request.itemId,
      itemType: request.itemType,
      quantity: Number(request.issuedQuantity ?? 0),
      unit: request.unit,
      issuedBy: "Inventory",
      issuedAt: request.fulfilledAt ? formatShortDate(request.fulfilledAt) : "Previously issued",
      issueMode: Number(request.issuedQuantity ?? 0) >= Number(request.quantityRequested ?? 0) ? "full" : "partial"
    }));
  const visibleIssuedRecords = [...issuedRecords, ...issuedApiRecords];

  function updateIssueMode(requestId, mode) {
    setIssueModes((current) => ({ ...current, [requestId]: mode }));
  }

  function updatePartialQuantity(requestId, quantity) {
    setPartialQuantities((current) => ({ ...current, [requestId]: quantity }));
  }

  function submitIssue(request, stockItem) {
    const mode = issueModes[request.id] ?? "full";
    const localIssued = getLocalIssuedQuantity(issuedRecords, request.id);
    const requestedQuantity = Number(request.quantityRequested ?? 0);
    const alreadyIssued = Number(request.issuedQuantity ?? 0) + localIssued;
    const remainingQuantity = Math.max(0, requestedQuantity - alreadyIssued);
    const requestedIssueQuantity =
      mode === "full" ? remainingQuantity : Number(partialQuantities[request.id] || 0);
    const availableQuantity = Number(stockItem.availableQty ?? stockItem.quantityOnHand ?? 0);

    setIssueError("");

    if (mode === "partial" && requestedIssueQuantity <= 0) {
      setIssueError("Enter the quantity you want to issue.");
      return;
    }

    if (requestedIssueQuantity > remainingQuantity) {
      setIssueError("Issued quantity cannot exceed the remaining request quantity.");
      return;
    }

    if (requestedIssueQuantity > availableQuantity) {
      setIssueError("Issued quantity cannot exceed available stock.");
      return;
    }

    onIssue({
      request,
      stockItem,
      issueMode: mode,
      quantity: requestedIssueQuantity
    });
    setActiveRequestId(null);
    setPartialQuantities((current) => ({ ...current, [request.id]: "" }));
  }

  return (
    <div className="workspace-stack issuance-workspace">
      <article className="card">
        <div className="card-header">
          <div>
            <p className="section-label">Inventory issuance</p>
            <h2 className="card-title">Issue approved stock requests</h2>
            <p className="helper-text">Only requests with approval status Approved and stock validation OK appear here.</p>
          </div>
          <div className="segmented-control">
            <button
              type="button"
              className={view === "to-issue" ? "active" : ""}
              onClick={() => setView("to-issue")}
            >
              To be issued
            </button>
            <button
              type="button"
              className={view === "issued" ? "active" : ""}
              onClick={() => setView("issued")}
            >
              Issued items
            </button>
          </div>
        </div>
        {issueError ? <p className="form-error">{issueError}</p> : null}
      </article>

      {view === "to-issue" ? (
        <div className="inventory-request-grid">
          {approvedRequests.length ? approvedRequests.map((request) => {
            const stockItem = findIssuableStock(request, stock);
            const localIssued = getLocalIssuedQuantity(issuedRecords, request.id);
            const requestedQuantity = Number(request.quantityRequested ?? 0);
            const alreadyIssued = Number(request.issuedQuantity ?? 0) + localIssued;
            const remainingQuantity = Math.max(0, requestedQuantity - alreadyIssued);
            const isIssuing = activeRequestId === request.id;
            const mode = issueModes[request.id] ?? "full";

            return (
              <article key={request.id} className="inventory-request-card issuance-card">
                <div className="inventory-request-card-top">
                  <div>
                    <span className="mono">{request.requestId}</span>
                    <h3>{request.itemName}</h3>
                  </div>
                  <Badge tone="green">Stock OK</Badge>
                </div>
                <div className="inventory-request-facts">
                  <DetailField label="Approval" value={request.approvalStatus} />
                  <DetailField label="Requested by" value={request.requestedBy} />
                  <DetailField label="Item ID" value={request.itemId} />
                  <DetailField label="Item type" value={request.itemType} />
                  <DetailField label="Requested" value={`${requestedQuantity} ${request.unit}`} />
                  <DetailField label="Remaining" value={`${remainingQuantity} ${request.unit}`} />
                  <DetailField label="Available stock" value={`${stockItem.availableQty ?? stockItem.qty} ${stockItem.unit}`} />
                  <DetailField label="Location" value={request.location} />
                </div>
                <div className="inventory-request-actions">
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => setActiveRequestId((current) => (current === request.id ? null : request.id))}
                  >
                    Issue
                  </button>
                </div>
                {isIssuing ? (
                  <div className="issue-controls">
                    <label className="form-group">
                      <span className="form-label">Issue type</span>
                      <select
                        className="form-select"
                        value={mode}
                        onChange={(event) => updateIssueMode(request.id, event.target.value)}
                      >
                        <option value="full">Full issue</option>
                        <option value="partial">Partial issue</option>
                      </select>
                    </label>
                    {mode === "partial" ? (
                      <label className="form-group">
                        <span className="form-label">Quantity to issue</span>
                        <input
                          className="form-input"
                          type="number"
                          min="1"
                          max={remainingQuantity}
                          value={partialQuantities[request.id] ?? ""}
                          onChange={(event) => updatePartialQuantity(request.id, event.target.value)}
                          placeholder={`Max ${remainingQuantity}`}
                        />
                      </label>
                    ) : null}
                    <button
                      type="button"
                      className="btn btn-success btn-sm"
                      onClick={() => submitIssue(request, stockItem)}
                    >
                      Confirm issue
                    </button>
                  </div>
                ) : null}
              </article>
            );
          }) : (
            <article className="empty-state">
              <strong>No issuable requests</strong>
              <p>Approved requests with stock validation OK will appear here.</p>
            </article>
          )}
        </div>
      ) : (
        <article className="card">
          <h2 className="card-title">Issued item records</h2>
          {visibleIssuedRecords.length ? (
            <SimpleTable
              headers={["Request", "Item", "Item ID", "Type", "Quantity", "Mode", "Issued by", "Issued at"]}
              rows={visibleIssuedRecords.map((record) => [
                <span key={`${record.id}-req`} className="mono">{record.requestNumber}</span>,
                record.itemName,
                record.itemId,
                record.itemType,
                `${record.quantity} ${record.unit ?? ""}`.trim(),
                record.issueMode === "full" ? "Full issue" : "Partial issue",
                record.issuedBy,
                record.issuedAt
              ])}
            />
          ) : (
            <p className="helper-text">No issued item records yet.</p>
          )}
        </article>
      )}
    </div>
  );
}

export function DashboardPage() {
  const { token, user, signOut } = useAuth();
  const [activePanel, setActivePanel] = useState("home");
  const [activeModuleId, setActiveModuleId] = useState(null);
  const [openingModuleId, setOpeningModuleId] = useState(null);
  const [demo, setDemo] = useState(initialDemoState);
  const [liveStock, setLiveStock] = useState([]);
  const [liveStockError, setLiveStockError] = useState("");
  const [inventoryRequests, setInventoryRequests] = useState([]);
  const [inventoryDashboard, setInventoryDashboard] = useState(emptyInventoryDashboard);
  const [inventoryDashboardError, setInventoryDashboardError] = useState("");
  const [isInventoryDashboardLoading, setIsInventoryDashboardLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [modal, setModal] = useState(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [sidebarTooltip, setSidebarTooltip] = useState(null);
  const [workspaceError, setWorkspaceError] = useState("");
  const [isWorkspaceLoading, setIsWorkspaceLoading] = useState(false);

  const config = roleConfig[user.role] ?? roleConfig.EMPLOYEE;
  const isBackendSession = token && !token.startsWith("demo-session:");
  const activeModule = moduleCatalog.find((module) => module.id === activeModuleId) ?? null;
  const sidebarItems = activeModule?.nav ?? moduleCatalog.map((module) => ({
    icon: module.icon,
    label: module.title,
    panel: module.defaultPanel,
    moduleId: module.id
  }));
  const activeNavItem =
    activePanel === "home"
      ? { label: "Home" }
      : activeModule?.nav.find((item) => item.panel === activePanel) ??
        config.nav.find((item) => item.panel === activePanel) ??
        { label: activeModule?.title ?? "Workspace" };

  const loadLiveStock = useCallback(
    async ({ shouldIgnore = () => false } = {}) => {
      if (!token) {
        return;
      }

      try {
        const response = await apiClient.listInventoryStock(token);

        if (shouldIgnore()) {
          return;
        }

        setLiveStock(
          response.stockItems.map((item) => ({
            id: item.id,
            name: item.itemName,
            type: item.itemType || item.type || item.specification || item.itemCategory || "Not specified",
            specification: item.specification,
            category: item.itemCategory,
            location: item.defaultLocation,
            qty: item.quantityOnHand,
            availableQty: item.availableQuantity,
            reservedQty: item.reservedQuantity,
            min: item.reorderLevel,
            unit: item.unit,
            sku: item.sku,
            itemId: item.itemId,
            isDiscontinued: item.isDiscontinued,
            linkedRequests: item.linkedRequests ?? [],
            linkedPurchaseOrders: item.linkedPurchaseOrders ?? []
          }))
        );
        setLiveStockError("");
      } catch (error) {
        if (!shouldIgnore()) {
          setLiveStock([]);
          setLiveStockError(error.message);
        }
      }
    },
    [token]
  );

  useEffect(() => {
    setActivePanel("home");
    setActiveModuleId(null);
    setOpeningModuleId(null);
  }, [user.role]);

  useEffect(() => {
    if (!toast) {
      return undefined;
    }

    const timer = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    let ignore = false;

    async function loadInventoryDashboard() {
      if (!token) {
        return;
      }

      setIsInventoryDashboardLoading(true);

      try {
        const response = await apiClient.getInventoryDashboard(token);

        if (!ignore) {
          setInventoryDashboard(response.dashboard ?? emptyInventoryDashboard);
          setInventoryDashboardError("");
        }
      } catch (error) {
        if (!ignore) {
          setInventoryDashboard(emptyInventoryDashboard);
          setInventoryDashboardError(error.message);
        }
      } finally {
        if (!ignore) {
          setIsInventoryDashboardLoading(false);
        }
      }
    }

    async function loadInventoryRequests() {
      if (!token) {
        return;
      }

      try {
        const response = await apiClient.listInventoryRequests(token);

        if (!ignore) {
          setInventoryRequests(response.requests ?? []);
        }
      } catch {
        if (!ignore) {
          setInventoryRequests([]);
        }
      }
    }

    loadInventoryDashboard();
    loadInventoryRequests();
    loadLiveStock({ shouldIgnore: () => ignore });

    return () => {
      ignore = true;
    };
  }, [loadLiveStock, token]);

  const pendingNotificationCount = useMemo(() => {
    const pendingLeaves = demo.leaves.filter((leave) =>
      ["pending", "pending HR"].includes(leave.status)
    ).length;
    const pendingAdvances = demo.advances.filter((advance) => advance.status === "pending").length;
    const unreadNotifications = demo.notifications.filter((notification) => notification.status === "unread").length;
    return pendingLeaves + pendingAdvances + unreadNotifications;
  }, [demo.advances, demo.leaves, demo.notifications]);

  function showToast(message, tone = "blue") {
    setToast({ message, tone });
  }

  const refreshWorkspace = useCallback(async () => {
    if (!isBackendSession) {
      return;
    }

    setIsWorkspaceLoading(true);
    setWorkspaceError("");

    try {
      const response = await apiClient.getWorkspaceState(token);
      setDemo((current) => ({
        ...current,
        ...response.state
      }));
    } catch (error) {
      setWorkspaceError(error.message);
    } finally {
      setIsWorkspaceLoading(false);
    }
  }, [isBackendSession, token]);

  useEffect(() => {
    refreshWorkspace();
  }, [refreshWorkspace]);

  function navigate(panel) {
    setActivePanel(panel);
  }

  function showSidebarTooltip(event, label) {
    if (!isSidebarCollapsed) {
      return;
    }

    const bounds = event.currentTarget.getBoundingClientRect();
    setSidebarTooltip({
      label,
      top: bounds.top + bounds.height / 2
    });
  }

  function hideSidebarTooltip() {
    setSidebarTooltip(null);
  }

  function goHome() {
    setActiveModuleId(null);
    setOpeningModuleId(null);
    setActivePanel("home");
  }

  function openModule(moduleId) {
    const nextModule = moduleCatalog.find((module) => module.id === moduleId);

    if (!nextModule) {
      return;
    }

    setOpeningModuleId(moduleId);

    window.setTimeout(() => {
      setActiveModuleId(moduleId);
      setActivePanel(nextModule.defaultPanel);
      setOpeningModuleId(null);
    }, 260);
  }

  async function approveLeave(leaveId) {
    if (isBackendSession) {
      try {
        if (user.role === "HR_OFFICER" || user.role === "SUPER_ADMIN") {
          await apiClient.decideLeaveAsHr(token, leaveId, { action: "approve", note: "Approved" });
        } else {
          await apiClient.decideLeaveAsManager(token, leaveId, { action: "approve", note: "Approved" });
        }
        await refreshWorkspace();
        showToast(
          user.role === "HR_OFFICER" || user.role === "SUPER_ADMIN"
            ? "Leave finally approved and balance updated."
            : "Leave approved and forwarded to HR.",
          "green"
        );
      } catch (error) {
        showToast(error.message, "red");
      }
      return;
    }

    setDemo((current) => ({
      ...current,
      leaves: current.leaves.map((leave) =>
        leave.id === leaveId
          ? { ...leave, status: user.role === "HR_OFFICER" || user.role === "SUPER_ADMIN" ? "approved" : "pending HR" }
          : leave
      )
    }));
    showToast(
      user.role === "HR_OFFICER" || user.role === "SUPER_ADMIN"
        ? "Leave finally approved and balance updated."
        : "Leave approved and forwarded to HR.",
      "green"
    );
  }

  async function rejectLeave(leaveId) {
    const note = window.prompt("Enter rejection reason");

    if (!note) {
      showToast("Rejection reason is required.", "red");
      return;
    }

    if (isBackendSession) {
      try {
        if (user.role === "HR_OFFICER" || user.role === "SUPER_ADMIN") {
          await apiClient.decideLeaveAsHr(token, leaveId, { action: "reject", note });
        } else {
          await apiClient.decideLeaveAsManager(token, leaveId, { action: "reject", note });
        }
        await refreshWorkspace();
        showToast("Leave rejected and employee notified.", "red");
      } catch (error) {
        showToast(error.message, "red");
      }
      return;
    }

    setDemo((current) => ({
      ...current,
      leaves: current.leaves.map((leave) =>
        leave.id === leaveId ? { ...leave, status: "rejected" } : leave
      )
    }));
    showToast("Leave rejected and employee notified.", "red");
  }

  async function submitLeave(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const days = Number(form.get("days") || 0);
    const leaveType = String(form.get("type") ?? "").split(" ")[0];
    const balance = demo.leaveBalances.find((item) => item.type === leaveType);

    if (balance && days > balance.remaining) {
      showToast("Leave request blocked because it exceeds your available balance.", "red");
      return;
    }

    if (isBackendSession) {
      try {
        await apiClient.createLeave(token, {
          type: form.get("type"),
          days,
          start: form.get("start"),
          end: form.get("end"),
          handover: form.get("handover"),
          reason: form.get("reason")
        });
        event.currentTarget.reset();
        await refreshWorkspace();
        showToast("Leave request submitted for manager approval.", "blue");
      } catch (error) {
        showToast(error.message, "red");
      }
      return;
    }

    setDemo((current) => ({
      ...current,
      leaves: [
        {
          id: Date.now(),
          from: user.fullName,
          type: form.get("type"),
          start: form.get("start"),
          end: form.get("end"),
          days,
          handover: form.get("handover"),
          reason: form.get("reason"),
          status: "pending",
          date: "Today"
        },
        ...current.leaves
      ]
    }));
    event.currentTarget.reset();
    showToast("Leave request submitted for manager approval.", "blue");
  }

  async function submitAdvance(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const amount = Number(form.get("amount") || 0).toLocaleString();

    if (isBackendSession) {
      try {
        await apiClient.createAdvance(token, {
          amount: form.get("amount"),
          reason: form.get("reason"),
          repaymentMonths: Number(String(form.get("repayment") ?? "1").match(/\d+/)?.[0] ?? 1)
        });
        event.currentTarget.reset();
        await refreshWorkspace();
        showToast("Advance request submitted to Finance.", "blue");
      } catch (error) {
        showToast(error.message, "red");
      }
      return;
    }

    setDemo((current) => ({
      ...current,
      advances: [
        {
          id: Date.now(),
          employee: user.fullName,
          amount: `PKR ${amount}`,
          reason: form.get("reason"),
          repayment: form.get("repayment"),
          status: "pending"
        },
        ...current.advances
      ]
    }));
    showToast("Advance request submitted to Finance.", "blue");
  }

  async function submitReimbursement(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const amount = Number(form.get("amount") || 0);

    if (amount > 10000) {
      showToast("Claim blocked because it exceeds the PKR 10,000 monthly limit.", "red");
      return;
    }

    if (isBackendSession) {
      try {
        await apiClient.createReimbursement(token, {
          type: form.get("type"),
          amount,
          date: form.get("date"),
          receipt: form.get("receipt"),
          description: form.get("description")
        });
        event.currentTarget.reset();
        await refreshWorkspace();
        showToast("Reimbursement claim submitted with receipt reference.", "blue");
      } catch (error) {
        showToast(error.message, "red");
      }
      return;
    }

    setDemo((current) => ({
      ...current,
      reimbursements: [
        {
          id: Date.now(),
          employee: user.fullName,
          type: form.get("type"),
          amount: `PKR ${amount.toLocaleString()}`,
          description: `${form.get("description")} | Receipt: ${form.get("receipt")}`,
          date: form.get("date") || "Today",
          status: "pending"
        },
        ...current.reimbursements
      ]
    }));
    event.currentTarget.reset();
    showToast("Reimbursement claim submitted with receipt reference.", "blue");
  }

  async function submitAnnouncement(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    if (isBackendSession) {
      try {
        await apiClient.createAnnouncement(token, {
          title: form.get("title"),
          content: form.get("message"),
          audience: form.get("audience")
        });
        event.currentTarget.reset();
        await refreshWorkspace();
        showToast("Announcement published and notifications queued.", "green");
      } catch (error) {
        showToast(error.message, "red");
      }
      return;
    }

    setDemo((current) => ({
      ...current,
      announcements: [
        {
          id: Date.now(),
          title: form.get("title"),
          message: form.get("message"),
          audience: form.get("audience"),
          owner: user.role === "SUPER_ADMIN" ? "Admin" : "HR",
          date: "Today"
        },
        ...current.announcements
      ]
    }));
    event.currentTarget.reset();
    showToast("Announcement published and notifications queued.", "green");
  }

  async function submitUser(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim().toLowerCase();

    if (isBackendSession) {
      try {
        await apiClient.createUser(token, {
          fullName: form.get("fullName"),
          email,
          password: "Password123!",
          role: form.get("role"),
          department: form.get("department")
        });
        event.currentTarget.reset();
        await refreshWorkspace();
        showToast("User account created and role assigned.", "green");
      } catch (error) {
        showToast(error.message, "red");
      }
      return;
    }

    if (demo.users.some((existingUser) => existingUser.email === email)) {
      showToast("A user with this email already exists.", "red");
      return;
    }

    setDemo((current) => ({
      ...current,
      users: [
        {
          fullName: form.get("fullName"),
          email,
          role: form.get("role"),
          department: form.get("department"),
          status: "active"
        },
        ...current.users
      ],
      auditLogs: [
        {
          id: Date.now(),
          time: "Now",
          user: user.fullName,
          role: "Super Admin",
          action: `Created user ${email}`,
          module: "Users",
          ip: "127.0.0.1"
        },
        ...current.auditLogs
      ]
    }));
    event.currentTarget.reset();
    showToast("User account created and role assigned.", "green");
  }

  async function toggleUserStatus(email) {
    if (isBackendSession) {
      const account = demo.users.find((userAccount) => userAccount.email === email);

      if (!account?.id) {
        showToast("Cannot update this account without a backend user id.", "red");
        return;
      }

      try {
        if (account.status === "active") {
          await apiClient.deactivateUser(token, account.id);
        } else {
          await apiClient.activateUser(token, account.id);
        }
        await refreshWorkspace();
        showToast("User status updated without deleting audit history.", "green");
      } catch (error) {
        showToast(error.message, "red");
      }
      return;
    }

    setDemo((current) => ({
      ...current,
      users: current.users.map((account) =>
        account.email === email
          ? { ...account, status: account.status === "active" ? "deactivated" : "active" }
          : account
      ),
      auditLogs: [
        {
          id: Date.now(),
          time: "Now",
          user: user.fullName,
          role: "Super Admin",
          action: `Changed account status for ${email}`,
          module: "Users",
          ip: "127.0.0.1"
        },
        ...current.auditLogs
      ]
    }));
    showToast("User status updated without deleting audit history.", "green");
  }

  async function moveTask(taskId) {
    const order = ["todo", "pending", "done"];
    const selectedTask = demo.tasks.find((task) => task.id === taskId);
    const selectedNextColumn = selectedTask
      ? order[(order.indexOf(selectedTask.col) + 1) % order.length]
      : "todo";

    if (isBackendSession && selectedTask) {
      try {
        await apiClient.updateTask(token, taskId, {
          title: selectedTask.title,
          col: selectedNextColumn,
          dueDate: selectedTask.dueDate ?? selectedTask.due
        });
        await refreshWorkspace();
        showToast("Task moved to the next column.", "green");
      } catch (error) {
        showToast(error.message, "red");
      }
      return;
    }

    setDemo((current) => ({
      ...current,
      tasks: current.tasks.map((task) => {
        if (task.id !== taskId) {
          return task;
        }

        const nextColumn = order[(order.indexOf(task.col) + 1) % order.length];
        return { ...task, col: nextColumn };
      })
    }));
    showToast("Task moved to the next column.", "green");
  }

  async function releasePayment(poId) {
    if (isBackendSession) {
      const po = demo.purchaseOrders.find((item) => item.id === poId);
      const amount = Number(String(po?.amount ?? "0").replace(/[^\d.]/g, ""));

      try {
        await apiClient.releasePoPayment(token, poId, {
          amount: amount || 1,
          paymentDate: new Date().toISOString().slice(0, 10),
          reference: `PAY-${Date.now()}`
        });
        await refreshWorkspace();
        showToast("Vendor payment released and receipt saved.", "green");
      } catch (error) {
        showToast(error.message, "red");
      }
      return;
    }

    setDemo((current) => ({
      ...current,
      purchaseOrders: current.purchaseOrders.map((po) =>
        po.id === poId ? { ...po, payment: "paid" } : po
      ),
      payments: [
        {
          id: Date.now(),
          date: "Today",
          category: "Vendor",
          reference: current.purchaseOrders.find((po) => po.id === poId)?.number ?? "PO",
          payee: current.purchaseOrders.find((po) => po.id === poId)?.vendor ?? "Vendor",
          amount: current.purchaseOrders.find((po) => po.id === poId)?.amount ?? "PKR 0",
          status: "paid"
        },
        ...current.payments
      ]
    }));
    showToast("Vendor payment released and receipt saved.", "green");
  }

  async function updateAdvance(advanceId, status) {
    if (isBackendSession) {
      const advance = demo.advances.find((item) => item.id === advanceId);
      const approvedAmount = Number(String(advance?.amount ?? "0").replace(/[^\d.]/g, ""));

      try {
        await apiClient.decideAdvance(token, advanceId, {
          action: status === "approved" ? "approve" : "reject",
          approvedAmount: approvedAmount || undefined,
          note: status === "approved" ? "Approved" : "Rejected by finance"
        });
        await refreshWorkspace();
        showToast(`Advance request ${status}.`, status === "approved" ? "green" : "red");
      } catch (error) {
        showToast(error.message, "red");
      }
      return;
    }

    setDemo((current) => ({
      ...current,
      advances: current.advances.map((advance) =>
        advance.id === advanceId ? { ...advance, status } : advance
      )
    }));
    showToast(`Advance request ${status}.`, status === "approved" ? "green" : "red");
  }

  async function approveReimbursement(claimId) {
    if (isBackendSession) {
      try {
        await apiClient.decideReimbursement(token, claimId, {
          action: "approve",
          note: "Approved"
        });
        await refreshWorkspace();
        showToast("Reimbursement approved for payment.", "green");
      } catch (error) {
        showToast(error.message, "red");
      }
      return;
    }

    setDemo((current) => ({
      ...current,
      reimbursements: current.reimbursements.map((claim) =>
        claim.id === claimId ? { ...claim, status: "approved" } : claim
      )
    }));
    showToast("Reimbursement approved for payment.", "green");
  }

  async function createPayroll() {
    if (isBackendSession) {
      try {
        const now = new Date();
        await apiClient.generatePayroll(token, {
          month: now.getMonth() + 1,
          year: now.getFullYear()
        });
        await refreshWorkspace();
        showToast("Payroll draft created.", "blue");
      } catch (error) {
        showToast(error.message, "red");
      }
      return;
    }

    showToast("May payroll draft created.", "blue");
  }

  function recordStockMovement({
    itemId,
    itemCode,
    itemName,
    itemType,
    unit,
    movementType,
    quantity,
    reference,
    location,
    notes
  }) {
    const movementQuantity = Number(quantity || 0);
    const isStockIn = movementType === "in";
    const now = new Date();
    const time = new Intl.DateTimeFormat(undefined, {
      hour: "2-digit",
      minute: "2-digit"
    }).format(now);
    const date = new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric"
    }).format(now);

    setLiveStock((current) =>
      current.map((item) => {
        if (item.id !== itemId) {
          return item;
        }

        const nextQty = Math.max(0, Number(item.qty ?? 0) + (isStockIn ? movementQuantity : -movementQuantity));
        const nextAvailableQty = Math.max(
          0,
          Number(item.availableQty ?? item.qty ?? 0) + (isStockIn ? movementQuantity : -movementQuantity)
        );

        return {
          ...item,
          qty: nextQty,
          availableQty: nextAvailableQty,
          location: location || item.location
        };
      })
    );

    setDemo((current) => ({
      ...current,
      stockLogs: [
        {
          id: Date.now(),
          itemId,
          itemCode,
          item: itemName,
          itemType,
          type: movementType,
          quantity: movementQuantity,
          unit,
          movement: `${isStockIn ? "+" : "-"}${movementQuantity} ${unit ?? ""}`.trim(),
          actor: user.fullName,
          reference: reference || (isStockIn ? "Manual stock in" : "Manual stock out"),
          location,
          notes,
          date,
          time
        },
        ...current.stockLogs
      ]
    }));

    showToast(isStockIn ? "Stock in recorded and balance updated." : "Stock out recorded and balance updated.", isStockIn ? "green" : "amber");
  }

  function issueApprovedRequest({ request, stockItem, issueMode, quantity }) {
    const issuedQuantity = Number(quantity || 0);
    const issuedAt = new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }).format(new Date());

    recordStockMovement({
      itemId: stockItem.id,
      itemCode: stockItem.itemId ?? stockItem.sku,
      itemName: stockItem.name,
      itemType: stockItem.type || stockItem.specification || stockItem.category || request.itemType || "Not specified",
      unit: stockItem.unit ?? request.unit,
      movementType: "out",
      quantity: issuedQuantity,
      reference: request.requestId,
      location: request.location,
      notes: issueMode === "full" ? "Full issue against approved request" : "Partial issue against approved request"
    });

    setIssuedItemRecords((current) => [
      {
        id: Date.now(),
        requestId: request.id,
        requestNumber: request.requestId,
        itemName: request.itemName,
        itemId: request.itemId,
        itemType: request.itemType,
        quantity: issuedQuantity,
        unit: request.unit,
        issueMode,
        issuedBy: user.fullName,
        issuedAt
      },
      ...current
    ]);

    showToast(issueMode === "full" ? "Full issue recorded." : "Partial issue recorded.", "green");
  }

  function closeModal() {
    setModal(null);
  }

  function renderPanel() {
    switch (activePanel) {
      case "home":
        return (
          <ModuleHome
            user={user}
            modules={moduleCatalog}
            openingModuleId={openingModuleId}
            onOpenModule={openModule}
          />
        );
      case "overview":
        return (
          <OverviewPanel
            role={user.role}
            demo={demo}
            onNavigate={navigate}
            onOpenModal={setModal}
          />
        );
      case "admin-overview":
        return <AdminOverviewPanel demo={demo} onNavigate={navigate} />;
      case "employee-requests":
        return user.role === "EMPLOYEE" || user.isDevelopmentBypass ? (
          <EmployeeRequisitionWorkspace token={token} />
        ) : (
          <LocalRequestsPanel demo={demo} onOpenModal={setModal} onNavigate={navigate} />
        );
      case "inventory-dashboard":
        return (
          <InventoryDashboardPanel
            dashboard={inventoryDashboard}
            isLoading={isInventoryDashboardLoading}
            error={inventoryDashboardError}
            onNavigate={navigate}
          />
        );
      case "manager-approvals":
        return <ManagerApprovalWorkspace token={token} />;
      case "inventory-control":
        return <InventoryWorkspace token={token} />;
      case "receiving":
        return <ReceivingWorkspace token={token} />;
      case "procurement":
        return <ProcurementWorkspace token={token} />;
      case "finance-match":
        return <FinanceWorkspace token={token} />;
      case "notifications":
        return <NotificationInbox token={token} />;
      case "leave":
        return <LeavePanel onSubmitLeave={submitLeave} leaveBalances={demo.leaveBalances} />;
      case "leave-admin":
        return (
          <LeaveAdminPanel
            leaves={demo.leaves}
            onApproveLeave={approveLeave}
            onRejectLeave={rejectLeave}
            mode={user.role === "HR_OFFICER" || user.role === "SUPER_ADMIN" ? "hr" : "manager"}
          />
        );
      case "workplan":
        return (
          <WorkPlanPanel
            tasks={demo.tasks}
            onMoveTask={moveTask}
            onOpenTaskModal={() => setModal("task")}
          />
        );
      case "attendance":
        return <AttendancePanel role={user.role} />;
      case "advance":
        return <AdvancePanel advances={demo.advances} onSubmitAdvance={submitAdvance} />;
      case "reimbursement":
        return (
          <ReimbursementClaimPanel
            reimbursements={demo.reimbursements}
            onSubmitReimbursement={submitReimbursement}
          />
        );
      case "announcements":
        return (
          <AnnouncementsPanel
            announcements={demo.announcements}
            onSubmitAnnouncement={submitAnnouncement}
          />
        );
      case "activity-log":
        return (
          <EmployeeActivityPanel
            users={demo.users}
            leaves={demo.leaves}
            requests={demo.requests}
            reimbursements={demo.reimbursements}
            advances={demo.advances}
          />
        );
      case "stock":
        return (
          <StockPanel
            stock={liveStock}
            error={liveStockError}
            token={token}
            onStockCreated={loadLiveStock}
            onStockMovement={recordStockMovement}
          />
        );
      case "stock-log":
        return <StockLogPanel stockLogs={demo.stockLogs} stock={liveStock} />;
      case "issuance":
        return (
          <IssuancePanel
            requests={inventoryRequests}
            stock={liveStock}
            issuedRecords={issuedItemRecords}
            onIssue={issueApprovedRequest}
          />
        );
      case "vendors":
        return <VendorsPanel vendors={demo.vendors} />;
      case "purchase-orders":
        return (
          <PurchaseOrdersPanel
            purchaseOrders={demo.purchaseOrders}
            onOpenModal={setModal}
          />
        );
      case "grn":
        return <GoodsReceiptPanel receipts={demo.receipts} />;
      case "finance-payments":
        return (
          <FinancePaymentsPanel
            purchaseOrders={demo.purchaseOrders}
            onReleasePayment={releasePayment}
          />
        );
      case "payment-history":
        return <PaymentHistoryPanel payments={demo.payments} />;
      case "finance-advance":
        return (
          <FinanceAdvancePanel
            advances={demo.advances}
            onApproveAdvance={(advanceId) => updateAdvance(advanceId, "approved")}
            onRejectAdvance={(advanceId) => updateAdvance(advanceId, "rejected")}
          />
        );
      case "finance-reimbursements":
        return (
          <FinanceReimbursementPanel
            reimbursements={demo.reimbursements}
            onApproveReimbursement={approveReimbursement}
          />
        );
      case "payroll":
        return <PayrollPanel onCreatePayroll={createPayroll} />;
      case "settings":
        return <SettingsPanel />;
      case "admin-users":
        return (
          <UserManagementPanel
            users={demo.users}
            onSubmitUser={submitUser}
            onToggleUserStatus={toggleUserStatus}
          />
        );
      case "all-requests":
        return (
          <AllRequestsPanel
            requests={demo.requests}
            leaves={demo.leaves}
            advances={demo.advances}
            reimbursements={demo.reimbursements}
          />
        );
      case "permissions":
        return <PermissionsPanel permissions={demo.permissions} />;
      case "audit":
        return <AuditPanel logs={demo.auditLogs} />;
      default:
        return <ComingSoonPanel label={activeNavItem.label} />;
    }
  }

  async function handleQuickItemSubmit(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    if (isBackendSession) {
      try {
        await apiClient.createRequisition(token, {
          title: `${form.get("item")} request`,
          justification: form.get("reason") || "Quick item request from dashboard.",
          neededByDate: new Date().toISOString().slice(0, 10),
          items: [
            {
              description: form.get("item"),
              specification: form.get("reason") || "",
              quantity: Number(form.get("qty") || 1),
              unit: "pcs",
              estimatedUnitCost: ""
            }
          ]
        });
        closeModal();
        await refreshWorkspace();
        showToast("Quick request submitted and queued for manager review.", "blue");
      } catch (error) {
        showToast(error.message, "red");
      }
      return;
    }

    setDemo((current) => ({
      ...current,
      requests: [
        {
          id: Date.now(),
          item: form.get("item"),
          qty: Number(form.get("qty") || 1),
          from: user.fullName,
          status: "pending",
          date: "Today",
          reason: form.get("reason")
        },
        ...current.requests
      ]
    }));
    closeModal();
    showToast("Quick request submitted and queued for manager review.", "blue");
  }

  async function handleTaskSubmit(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const title = String(form.get("title") ?? "").trim();

    if (!title) {
      showToast("Please enter a task title.", "red");
      return;
    }

    if (isBackendSession) {
      try {
        await apiClient.createTask(token, {
          title,
          col: form.get("col"),
          dueDate: form.get("due")
        });
        closeModal();
        await refreshWorkspace();
        showToast("Task added to the work plan.", "green");
      } catch (error) {
        showToast(error.message, "red");
      }
      return;
    }

    setDemo((current) => ({
      ...current,
      tasks: [
        ...current.tasks,
        {
          id: Date.now(),
          title,
          col: form.get("col"),
          due: form.get("due") || "No date"
        }
      ]
    }));
    closeModal();
    showToast("Task added to the work plan.", "green");
  }

  function handlePurchaseOrderSubmit(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    setDemo((current) => ({
      ...current,
      purchaseOrders: [
        {
          id: Date.now(),
          number: `PO-2026-${current.purchaseOrders.length + 42}`,
          vendor: form.get("vendor"),
          items: `${form.get("item")} x${form.get("qty")}`,
          amount: `PKR ${Number(form.get("amount") || 0).toLocaleString()}`,
          delivery: form.get("delivery") || "Pending",
          status: "issued",
          grn: "Pending",
          payment: "pending"
        },
        ...current.purchaseOrders
      ]
    }));
    closeModal();
    showToast("Purchase order created and sent to vendor.", "green");
  }

  function handleIssuanceSubmit(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const stockItemId = Number(form.get("stockItemId"));
    const quantity = Number(form.get("quantity") || 0);
    const stockItem = liveStock.find((item) => item.id === stockItemId);

    if (!stockItem || quantity <= 0) {
      showToast("Select a stock item and valid quantity.", "red");
      return;
    }

    recordStockMovement({
      itemId: stockItem.id,
      itemCode: stockItem.itemId ?? stockItem.sku,
      itemName: stockItem.name,
      itemType: stockItem.type || stockItem.specification || stockItem.category || "Not specified",
      unit: stockItem.unit,
      movementType: "out",
      quantity,
      reference: form.get("reference") || form.get("recipient") || "Manual issue",
      location: stockItem.location,
      notes: form.get("notes") || ""
    });

    event.currentTarget.reset();
  }

  return (
    <main className={activePanel === "home" ? "erp-shell home-only" : "erp-shell"}>
      {activePanel !== "home" ? (
      <aside className={isSidebarCollapsed ? "sidebar collapsed" : "sidebar"}>
        <div className="sidebar-header">
          <div className="sidebar-logo">
            Shehersaaz<span>IMS</span>
          </div>
          <small>Enterprise workflow system</small>
          <button
            type="button"
            className="sidebar-toggle"
            onClick={() => setIsSidebarCollapsed((collapsed) => !collapsed)}
            aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <SidebarToggleIcon collapsed={isSidebarCollapsed} />
          </button>
        </div>

        <div className="sidebar-user">
          <div className={`avatar ${config.accent}`}>{getInitials(user.fullName)}</div>
          <div>
            <div className="sidebar-name">{user.fullName}</div>
            <div className="sidebar-role">{config.label}</div>
          </div>
        </div>

        <nav className="sidebar-nav" aria-label="Role navigation">
          <div className="nav-section">{activeModule ? activeModule.title : "Modules"}</div>
          {sidebarItems.map((item) => (
            <button
              key={item.moduleId ?? item.panel}
              type="button"
              className={
                item.panel === activePanel || item.moduleId === openingModuleId
                  ? "nav-item active"
                  : "nav-item"
              }
              data-label={item.label}
              aria-label={item.label}
              title={item.label}
              onMouseEnter={(event) => showSidebarTooltip(event, item.label)}
              onMouseLeave={hideSidebarTooltip}
              onFocus={(event) => showSidebarTooltip(event, item.label)}
              onBlur={hideSidebarTooltip}
              onClick={() => (item.moduleId ? openModule(item.moduleId) : navigate(item.panel))}
            >
              <span className="nav-icon"><NavIcon item={item} /></span>
              <span className="nav-label">{item.label}</span>
              {item.badge ? <span className="nav-badge">{item.badge}</span> : null}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button type="button" className="btn-logout" onClick={signOut}>
            Logout
          </button>
        </div>
        {sidebarTooltip ? (
          <div className="sidebar-flyout-label" style={{ top: sidebarTooltip.top }}>
            {sidebarTooltip.label}
          </div>
        ) : null}
      </aside>
      ) : null}

      <section className="main">
        {activePanel !== "home" ? (
        <header className="topbar">
          <div>
            <h1 className="topbar-title">{activeNavItem.label}</h1>
            <p>{activeModule ? `${activeModule.title} module` : "Choose a module to begin"}</p>
          </div>
          <div className="topbar-right">
            {activeModule ? (
              <button
                type="button"
                className="topbar-icon-btn"
                onClick={goHome}
                aria-label="Go home"
                title="Home"
              >
                <NavIcon name="home" />
              </button>
            ) : null}
            <button
              type="button"
              className="topbar-icon-btn notif-btn"
              onClick={() => navigate("notifications")}
              aria-label="Open notifications"
              title="Notifications"
            >
              <NavIcon name="notifications" />
              {pendingNotificationCount ? <span className="notif-dot" /> : null}
            </button>
            <div className="date-chip">{formatDateLabel()}</div>
          </div>
        </header>
        ) : null}

        <div key={activePanel} className="content">
          {isWorkspaceLoading ? <p className="helper-text">Refreshing workspace data...</p> : null}
          {workspaceError ? <p className="form-error">{workspaceError}</p> : null}
          {renderPanel()}
        </div>
      </section>

      {toast ? <div id="toast" className={toast.tone}>{toast.message}</div> : null}

      <ErpModal modal={modal} onClose={closeModal}>
        {modal === "item-request" ? (
          <form className="modal-form" onSubmit={handleQuickItemSubmit}>
            <h2 className="modal-title">New item request</h2>
            <label className="form-group full">
              <span className="form-label">Item name</span>
              <input name="item" className="form-input" placeholder="Wireless keyboard" required />
            </label>
            <label className="form-group">
              <span className="form-label">Quantity</span>
              <input name="qty" className="form-input" type="number" min="1" defaultValue="1" />
            </label>
            <label className="form-group full">
              <span className="form-label">Reason</span>
              <textarea name="reason" className="form-textarea" placeholder="Why do you need this item?" />
            </label>
            <div className="modal-footer">
              <button type="button" className="btn btn-ghost" onClick={closeModal}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                Submit request
              </button>
            </div>
          </form>
        ) : null}

        {modal === "task" ? (
          <form className="modal-form" onSubmit={handleTaskSubmit}>
            <h2 className="modal-title">Add task to work plan</h2>
            <label className="form-group full">
              <span className="form-label">Task title</span>
              <input name="title" className="form-input" placeholder="Complete Q2 report" required />
            </label>
            <label className="form-group">
              <span className="form-label">Column</span>
              <select name="col" className="form-select" defaultValue="todo">
                <option value="todo">To do</option>
                <option value="pending">In progress</option>
                <option value="done">Done</option>
              </select>
            </label>
            <label className="form-group">
              <span className="form-label">Due date</span>
              <input name="due" className="form-input" type="date" />
            </label>
            <div className="modal-footer">
              <button type="button" className="btn btn-ghost" onClick={closeModal}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                Add task
              </button>
            </div>
          </form>
        ) : null}

        {modal === "purchase-order" ? (
          <form className="modal-form" onSubmit={handlePurchaseOrderSubmit}>
            <h2 className="modal-title">Create purchase order</h2>
            <label className="form-group full">
              <span className="form-label">Vendor</span>
              <select name="vendor" className="form-select" defaultValue="Tech Supplies Co.">
                {demo.vendors.map((vendor) => (
                  <option key={vendor.id}>{vendor.name}</option>
                ))}
              </select>
            </label>
            <label className="form-group full">
              <span className="form-label">Item</span>
              <input name="item" className="form-input" defaultValue="USB Hub" />
            </label>
            <label className="form-group">
              <span className="form-label">Quantity</span>
              <input name="qty" className="form-input" type="number" min="1" defaultValue="20" />
            </label>
            <label className="form-group">
              <span className="form-label">Amount</span>
              <input name="amount" className="form-input" type="number" min="1" defaultValue="36000" />
            </label>
            <label className="form-group full">
              <span className="form-label">Delivery date</span>
              <input name="delivery" className="form-input" type="date" />
            </label>
            <div className="modal-footer">
              <button type="button" className="btn btn-ghost" onClick={closeModal}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                Generate PO
              </button>
            </div>
          </form>
        ) : null}
      </ErpModal>
    </main>
  );
}

function ErpModal({ modal, onClose, children }) {
  if (!modal) {
    return null;
  }

  return (
    <div className="modal-overlay open" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="modal">{children}</div>
    </div>
  );
}
