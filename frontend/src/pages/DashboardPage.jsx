import { useEffect, useMemo, useState } from "react";
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
  NotificationHistoryPanel,
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
      { icon: "NT", label: "Notifications", panel: "notifications" }
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
      { icon: "AU", label: "Audit Logs", panel: "audit" },
      { icon: "AN", label: "Announcements", panel: "announcements" },
      { icon: "ST", label: "Settings", panel: "settings" },
      { icon: "RP", label: "Roles & Permissions", panel: "permissions" }
    ]
  }
};

const initialDemoState = {
  requests: [
    {
      id: 1,
      item: "Laptop Stand",
      qty: 1,
      from: "Bilal Ahmed",
      status: "pending",
      date: "Apr 25",
      reason: ""
    },
    {
      id: 2,
      item: "Office Chair",
      qty: 2,
      from: "Sara Khan",
      status: "pending",
      date: "Apr 26",
      reason: ""
    },
    {
      id: 3,
      item: "USB Hub",
      qty: 3,
      from: "Omar Sheikh",
      status: "approved",
      date: "Apr 24",
      reason: ""
    },
    {
      id: 4,
      item: "Monitor",
      qty: 1,
      from: "Fatima Ali",
      status: "rejected",
      date: "Apr 23",
      reason: "Budget exceeded"
    }
  ],
  leaves: [
    {
      id: 1,
      from: "Bilal Ahmed",
      type: "Sick Leave",
      start: "May 2",
      end: "May 3",
      reason: "Fever",
      status: "pending HR",
      date: "Apr 26"
    },
    {
      id: 2,
      from: "Sara Khan",
      type: "Annual Leave",
      start: "May 5",
      end: "May 9",
      reason: "Family trip",
      status: "pending",
      date: "Apr 25"
    },
    {
      id: 3,
      from: "Omar Sheikh",
      type: "Casual Leave",
      start: "Apr 28",
      end: "Apr 28",
      reason: "Personal",
      status: "approved",
      date: "Apr 22"
    }
  ],
  stock: [
    { id: 1, name: "Printer Paper", qty: 450, min: 100, unit: "reams" },
    { id: 2, name: "Laptop Stand", qty: 8, min: 5, unit: "pcs" },
    { id: 3, name: "USB Hub", qty: 3, min: 10, unit: "pcs" },
    { id: 4, name: "Office Chair", qty: 12, min: 5, unit: "pcs" },
    { id: 5, name: "Monitor", qty: 2, min: 3, unit: "pcs" },
    { id: 6, name: "Whiteboard Marker", qty: 60, min: 20, unit: "pcs" }
  ],
  tasks: [
    { id: 1, title: "Q2 budget review", col: "todo", due: "May 5" },
    { id: 2, title: "Update HR policy doc", col: "todo", due: "May 8" },
    { id: 3, title: "Vendor evaluation", col: "pending", due: "Apr 30" },
    { id: 4, title: "Team meeting notes", col: "done", due: "Apr 24" },
    { id: 5, title: "Office renovation plan", col: "pending", due: "May 3" }
  ],
  announcements: [
    { id: 1, title: "Office will be closed on May 1st for Labour Day", owner: "HR", date: "Apr 25, 2026" },
    { id: 2, title: "Q2 performance reviews start May 10", owner: "HR", date: "Apr 20, 2026" }
  ],
  notifications: [
    { id: 1, subject: "Leave reached HR", message: "Bilal Ahmed's leave is ready for final HR approval.", status: "unread", route: "Leave", time: "2h ago" },
    { id: 2, subject: "Low stock alert", message: "USB Hub is below minimum and procurement has been notified.", status: "unread", route: "Inventory", time: "4h ago" },
    { id: 3, subject: "Payment released", message: "Office Mart payment was released against PO-2026-039.", status: "read", route: "Finance", time: "1d ago" }
  ],
  leaveBalances: [
    { type: "Annual", total: 20, used: 8, remaining: 12 },
    { type: "Sick", total: 10, used: 2, remaining: 8 },
    { type: "Casual", total: 5, used: 1, remaining: 4 },
    { type: "Carry forward", total: 5, used: 0, remaining: 5 }
  ],
  users: [
    { fullName: "Ayaan Employee", email: "employee@ims.local", role: "EMPLOYEE", department: "Operations", status: "active" },
    { fullName: "Layla Manager", email: "manager@ims.local", role: "LINE_MANAGER", department: "Operations", status: "active" },
    { fullName: "Nadia HR", email: "hr@ims.local", role: "HR_OFFICER", department: "Human Resources", status: "active" },
    { fullName: "Sara Finance", email: "finance@ims.local", role: "FINANCE", department: "Finance", status: "active" },
    { fullName: "Inaya Inventory", email: "inventory@ims.local", role: "INVENTORY_OFFICER", department: "Stores", status: "active" },
    { fullName: "Omar Procurement", email: "procurement@ims.local", role: "PROCUREMENT_OFFICER", department: "Procurement", status: "active" },
    { fullName: "Super Admin", email: "admin@ims.local", role: "SUPER_ADMIN", department: "IT / Management", status: "active" }
  ],
  advances: [
    {
      id: 1,
      employee: "Ahmad Raza",
      amount: "PKR 25,000",
      reason: "Medical emergency",
      repayment: "3 months",
      status: "pending"
    },
    {
      id: 2,
      employee: "Sara Khan",
      amount: "PKR 15,000",
      reason: "Urgent home repair",
      repayment: "2 months",
      status: "pending"
    }
  ],
  reimbursements: [
    {
      id: 1,
      employee: "Omar Sheikh",
      type: "Travel",
      amount: "PKR 4,500",
      description: "Client visit Lahore",
      date: "Apr 27",
      status: "pending"
    },
    {
      id: 2,
      employee: "Fatima Ali",
      type: "Medical",
      amount: "PKR 12,000",
      description: "Doctor consultation",
      date: "Apr 25",
      status: "pending"
    },
    {
      id: 3,
      employee: "Bilal Ahmed",
      type: "Office supplies",
      amount: "PKR 3,200",
      description: "Stationery for team",
      date: "Apr 23",
      status: "approved"
    }
  ],
  vendors: [
    { id: 1, name: "Tech Supplies Co.", category: "IT hardware", contact: "orders@tech.local", rating: "A" },
    { id: 2, name: "Office Mart", category: "Stationery", contact: "sales@office.local", rating: "A-" },
    { id: 3, name: "Stationery Hub", category: "Office supplies", contact: "hello@stationery.local", rating: "B+" }
  ],
  purchaseOrders: [
    {
      id: 1,
      number: "PO-2026-041",
      vendor: "Tech Supplies Co.",
      items: "USB Hub x20",
      amount: "PKR 245,000",
      delivery: "May 3",
      status: "issued",
      grn: "GRN-022",
      payment: "pending"
    },
    {
      id: 2,
      number: "PO-2026-039",
      vendor: "Office Mart",
      items: "Printer Paper x50",
      amount: "PKR 68,500",
      delivery: "Apr 25",
      status: "received",
      grn: "GRN-021",
      payment: "pending"
    },
    {
      id: 3,
      number: "PO-2026-037",
      vendor: "Stationery Hub",
      items: "Markers x120",
      amount: "PKR 15,200",
      delivery: "Apr 22",
      status: "received",
      grn: "GRN-019",
      payment: "paid"
    }
  ],
  receipts: [
    {
      id: 1,
      number: "GRN-022",
      po: "PO-2026-041",
      vendor: "Tech Supplies Co.",
      items: "USB Hub x20",
      date: "Apr 28",
      finance: "pending"
    },
    {
      id: 2,
      number: "GRN-021",
      po: "PO-2026-039",
      vendor: "Office Mart",
      items: "Printer Paper x50",
      date: "Apr 25",
      finance: "matched"
    }
  ],
  stockLogs: [
    { id: 1, time: "09:42", item: "Laptop Stand", movement: "-1", actor: "Inaya Inventory", reference: "REQ-2026-018" },
    { id: 2, time: "09:18", item: "USB Hub", movement: "+20", actor: "Inaya Inventory", reference: "GRN-022" },
    { id: 3, time: "08:58", item: "Printer Paper", movement: "+50", actor: "Inaya Inventory", reference: "GRN-021" }
  ],
  auditLogs: [
    { id: 1, time: "09:42 AM", user: "Layla Manager", role: "Manager", action: "Approved item request", module: "Requests", ip: "192.168.1.10" },
    { id: 2, time: "09:31 AM", user: "Sara Finance", role: "Finance", action: "Released payment PO-2026-039", module: "Finance", ip: "192.168.1.22" },
    { id: 3, time: "09:18 AM", user: "Ayaan Employee", role: "Employee", action: "Submitted requisition", module: "Requests", ip: "192.168.1.12" }
  ],
  payments: [
    { id: 1, date: "Apr 29", category: "Vendor", reference: "PO-2026-039", payee: "Office Mart", amount: "PKR 68,500", status: "paid" },
    { id: 2, date: "Apr 27", category: "Advance", reference: "ADV-001", payee: "Ahmad Raza", amount: "PKR 25,000", status: "pending" },
    { id: 3, date: "Apr 25", category: "Reimbursement", reference: "RMB-002", payee: "Fatima Ali", amount: "PKR 12,000", status: "pending" }
  ],
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

export function DashboardPage() {
  const { token, user, signOut } = useAuth();
  const [activePanel, setActivePanel] = useState("overview");
  const [demo, setDemo] = useState(initialDemoState);
  const [toast, setToast] = useState(null);
  const [modal, setModal] = useState(null);

  const config = roleConfig[user.role] ?? roleConfig.EMPLOYEE;
  const activeNavItem =
    config.nav.find((item) => item.panel === activePanel) ?? config.nav[0];

  useEffect(() => {
    setActivePanel(roleConfig[user.role]?.nav[0]?.panel ?? "overview");
  }, [user.role]);

  useEffect(() => {
    if (!toast) {
      return undefined;
    }

    const timer = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);

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

  function navigate(panel) {
    setActivePanel(panel);
  }

  function approveLeave(leaveId) {
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

  function rejectLeave(leaveId) {
    setDemo((current) => ({
      ...current,
      leaves: current.leaves.map((leave) =>
        leave.id === leaveId ? { ...leave, status: "rejected" } : leave
      )
    }));
    showToast("Leave rejected and employee notified.", "red");
  }

  function submitLeave(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const days = Number(form.get("days") || 0);
    const leaveType = String(form.get("type") ?? "").split(" ")[0];
    const balance = demo.leaveBalances.find((item) => item.type === leaveType);

    if (balance && days > balance.remaining) {
      showToast("Leave request blocked because it exceeds your available balance.", "red");
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

  function submitAdvance(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const amount = Number(form.get("amount") || 0).toLocaleString();

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

  function submitReimbursement(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const amount = Number(form.get("amount") || 0);

    if (amount > 10000) {
      showToast("Claim blocked because it exceeds the PKR 10,000 monthly limit.", "red");
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

  function submitAnnouncement(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

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

  function submitUser(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim().toLowerCase();

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

  function toggleUserStatus(email) {
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

  function markDemoNotificationRead(notificationId) {
    setDemo((current) => ({
      ...current,
      notifications: current.notifications.map((notification) =>
        notification.id === notificationId ? { ...notification, status: "read" } : notification
      )
    }));
  }

  function moveTask(taskId) {
    const order = ["todo", "pending", "done"];

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

  function releasePayment(poId) {
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

  function updateAdvance(advanceId, status) {
    setDemo((current) => ({
      ...current,
      advances: current.advances.map((advance) =>
        advance.id === advanceId ? { ...advance, status } : advance
      )
    }));
    showToast(`Advance request ${status}.`, status === "approved" ? "green" : "red");
  }

  function approveReimbursement(claimId) {
    setDemo((current) => ({
      ...current,
      reimbursements: current.reimbursements.map((claim) =>
        claim.id === claimId ? { ...claim, status: "approved" } : claim
      )
    }));
    showToast("Reimbursement approved for payment.", "green");
  }

  function createPayroll() {
    showToast("May payroll draft created.", "blue");
  }

  function closeModal() {
    setModal(null);
  }

  function renderPanel() {
    switch (activePanel) {
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
        return user.role === "EMPLOYEE" ? (
          <EmployeeRequisitionWorkspace token={token} />
        ) : (
          <LocalRequestsPanel demo={demo} onOpenModal={setModal} onNavigate={navigate} />
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
        return token.startsWith("demo-session:") ? (
          <NotificationHistoryPanel
            notifications={demo.notifications}
            onMarkRead={markDemoNotificationRead}
          />
        ) : (
          <NotificationInbox token={token} />
        );
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
        return <StockPanel stock={demo.stock} />;
      case "stock-log":
        return <StockLogPanel stockLogs={demo.stockLogs} />;
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

  function handleQuickItemSubmit(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

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

  function handleTaskSubmit(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const title = String(form.get("title") ?? "").trim();

    if (!title) {
      showToast("Please enter a task title.", "red");
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

  return (
    <main className="erp-shell">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-logo">
            Shehersaaz<span>IMS</span>
          </div>
          <small>Enterprise workflow system</small>
        </div>

        <div className="sidebar-user">
          <div className={`avatar ${config.accent}`}>{getInitials(user.fullName)}</div>
          <div>
            <div className="sidebar-name">{user.fullName}</div>
            <div className="sidebar-role">{config.label}</div>
          </div>
        </div>

        <nav className="sidebar-nav" aria-label="Role navigation">
          <div className="nav-section">Navigation</div>
          {config.nav.map((item) => (
            <button
              key={item.panel}
              type="button"
              className={item.panel === activePanel ? "nav-item active" : "nav-item"}
              onClick={() => navigate(item.panel)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span>{item.label}</span>
              {item.badge ? <span className="nav-badge">{item.badge}</span> : null}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button type="button" className="btn-logout" onClick={signOut}>
            Logout
          </button>
        </div>
      </aside>

      <section className="main">
        <header className="topbar">
          <div>
            <h1 className="topbar-title">{activeNavItem.label}</h1>
            <p>{formatRole(user.role)} workspace</p>
          </div>
          <div className="topbar-right">
            <button
              type="button"
              className="notif-btn"
              onClick={() => navigate("notifications")}
              aria-label="Open notifications"
            >
              NT
              {pendingNotificationCount ? <span className="notif-dot" /> : null}
            </button>
            <div className="date-chip">{formatDateLabel()}</div>
          </div>
        </header>

        <div className="content">{renderPanel()}</div>
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
