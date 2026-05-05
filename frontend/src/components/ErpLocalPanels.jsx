import { useMemo, useState } from "react";
import { apiClient } from "../api/client.js";

const statusTone = {
  pending: "amber",
  "pending manager": "amber",
  "pending HR": "amber",
  approved: "green",
  rejected: "red",
  paid: "green",
  matched: "green",
  mismatch: "red",
  open: "blue",
  issued: "green",
  received: "green",
  active: "green",
  inactive: "gray",
  deactivated: "red"
};

const roleDashboardStats = {
  EMPLOYEE: [
    ["Attendance this month", "0", "live records only", "blue"],
    ["Pending requests", "0", "live records only", "amber"],
    ["Tasks done", "0", "live records only", "green"],
    ["Leave balance", "0", "live records only", "purple"]
  ],
  LINE_MANAGER: [
    ["Pending approvals", "0", "live records only", "amber"],
    ["Team size", "0", "live records only", "blue"],
    ["Present today", "0", "live records only", "green"],
    ["Overdue tasks", "0", "live records only", "red"]
  ],
  INVENTORY_OFFICER: [
    ["Items in stock", "0", "live records only", "blue"],
    ["Low stock", "0", "live records only", "red"],
    ["Pending issues", "0", "live records only", "amber"],
    ["Issued today", "0", "live records only", "green"]
  ],
  PROCUREMENT_OFFICER: [
    ["Open procurement", "0", "live records only", "amber"],
    ["Active vendors", "0", "live records only", "green"],
    ["POs this month", "0", "live records only", "blue"],
    ["Due deliveries", "0", "live records only", "red"]
  ],
  FINANCE: [
    ["POs to match", "0", "live records only", "amber"],
    ["Payments pending", "0", "live records only", "red"],
    ["Payroll", "0", "live records only", "green"],
    ["Reimbursements", "0", "live records only", "blue"]
  ],
  HR_OFFICER: [
    ["Leave approvals", "0", "live records only", "amber"],
    ["Present today", "0", "live records only", "green"],
    ["On leave", "0", "live records only", "blue"],
    ["New joiners", "0", "live records only", "purple"]
  ],
  SUPER_ADMIN: [
    ["Active users", "0", "live records only", "green"],
    ["Pending requests", "0", "live records only", "amber"],
    ["Low stock", "0", "live records only", "red"],
    ["Audit events", "0", "live records only", "blue"]
  ]
};

export function Badge({ tone = "gray", children }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export function OverviewPanel({ role, demo, onNavigate, onOpenModal }) {
  const stats = roleDashboardStats[role] ?? roleDashboardStats.EMPLOYEE;
  const lowStock = demo.stock.filter((item) => item.qty <= item.min);
  const pendingRequests = demo.requests.filter((request) => request.status === "pending");
  const pendingLeaves = demo.leaves.filter((leave) =>
    ["pending", "pending manager", "pending HR"].includes(leave.status)
  );

  return (
    <div className="workspace-stack">
      <div className="stats-grid">
        {stats.map(([label, value, sub, tone]) => (
          <div key={label} className={`stat-card ${tone}`}>
            <div className="stat-label">{label}</div>
            <div className="stat-val">{value}</div>
            <div className="stat-sub">{sub}</div>
          </div>
        ))}
      </div>

      <section className="two-col">
        <article className="card">
          <div className="card-header">
            <h2 className="card-title">Action queue</h2>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => {
                if (role === "LINE_MANAGER") {
                  onNavigate("manager-approvals");
                } else if (role === "INVENTORY_OFFICER") {
                  onNavigate("inventory-control");
                } else if (role === "PROCUREMENT_OFFICER") {
                  onNavigate("procurement");
                } else if (role === "FINANCE") {
                  onNavigate("finance-match");
                } else if (role === "HR_OFFICER") {
                  onNavigate("leave-admin");
                } else if (role === "SUPER_ADMIN") {
                  onNavigate("admin-users");
                } else {
                  onNavigate("employee-requests");
                }
              }}
            >
              Open workspace
            </button>
          </div>

          {role === "LINE_MANAGER" ? (
            <ApprovalPreview
              requests={pendingRequests}
              leaves={pendingLeaves}
              onNavigate={onNavigate}
            />
          ) : role === "INVENTORY_OFFICER" ? (
            <StockPreview stock={demo.stock} onNavigate={onNavigate} />
          ) : role === "PROCUREMENT_OFFICER" ? (
            <PurchaseOrderPreview purchaseOrders={demo.purchaseOrders} onNavigate={onNavigate} />
          ) : role === "FINANCE" ? (
            <FinancePreview advances={demo.advances} reimbursements={demo.reimbursements} />
          ) : role === "HR_OFFICER" ? (
            <HrPreview leaves={pendingLeaves} onNavigate={onNavigate} />
          ) : role === "SUPER_ADMIN" ? (
            <AdminPreview demo={demo} onNavigate={onNavigate} />
          ) : (
            <EmployeePreview onNavigate={onNavigate} onOpenModal={onOpenModal} />
          )}
        </article>

        <article className="card">
          <div className="card-header">
            <h2 className="card-title">Announcements</h2>
            {role === "LINE_MANAGER" || role === "FINANCE" ? null : (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => onNavigate("notifications")}
              >
                View updates
              </button>
            )}
          </div>
          {demo.announcements.length ? demo.announcements.map((announcement) => (
            <div key={announcement.id} className="announce-item">
              <div className="announce-title">{announcement.title}</div>
              <div className="announce-meta">
                {announcement.owner} | {announcement.date}
              </div>
            </div>
          )) : (
            <div className="empty-state">
              <strong>No announcements yet</strong>
              <p>Published updates will appear here once your team starts using the portal.</p>
            </div>
          )}
        </article>
      </section>

      {lowStock.length ? (
        <article className="card">
          <div className="card-header">
            <h2 className="card-title">Low stock signals</h2>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => onNavigate("stock")}
            >
              Stock view
            </button>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>On hand</th>
                  <th>Minimum</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {lowStock.map((item) => (
                  <tr key={item.id}>
                    <td>{item.name}</td>
                    <td>
                      {item.qty} {item.unit}
                    </td>
                    <td>
                      {item.min} {item.unit}
                    </td>
                    <td>
                      <Badge tone="red">Low stock</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      ) : null}
    </div>
  );
}

function EmployeePreview({ onNavigate, onOpenModal }) {
  return (
    <div className="action-stack">
      <div className="decision-banner">
        <strong>Requisition workflow is live</strong>
        <span>Create a request, send it to your manager, and track the approval trail.</span>
      </div>
      <div className="button-row">
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => onNavigate("employee-requests")}
        >
          New requisition
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => onOpenModal("item-request")}
        >
          Quick request
        </button>
      </div>
    </div>
  );
}

function ApprovalPreview({ requests, leaves, onNavigate }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>From</th>
            <th>Type</th>
            <th>Details</th>
            <th>Stage</th>
          </tr>
        </thead>
        <tbody>
          {requests.slice(0, 2).map((request) => (
            <tr key={`request-${request.id}`}>
              <td>{request.from}</td>
              <td>
                <Badge tone="blue">Item</Badge>
              </td>
              <td>
                {request.item} x{request.qty}
              </td>
              <td>
                <button
                  type="button"
                  className="btn btn-success btn-sm"
                  onClick={() => onNavigate("manager-approvals")}
                >
                  Review
                </button>
              </td>
            </tr>
          ))}
          {leaves.slice(0, 2).map((leave) => (
            <tr key={`leave-${leave.id}`}>
              <td>{leave.from}</td>
              <td>
                <Badge tone="amber">Leave</Badge>
              </td>
              <td>{leave.type}</td>
              <td>
                <button
                  type="button"
                  className="btn btn-success btn-sm"
                  onClick={() => onNavigate("leave-admin")}
                >
                  Review
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StockPreview({ stock, onNavigate }) {
  return (
    <div className="stock-list">
      {stock.slice(0, 4).map((item) => (
        <StockMeter key={item.id} item={item} />
      ))}
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => onNavigate("stock")}>
        Full stock overview
      </button>
    </div>
  );
}

function PurchaseOrderPreview({ purchaseOrders, onNavigate }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>PO</th>
            <th>Vendor</th>
            <th>Amount</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {purchaseOrders.slice(0, 4).map((po) => (
            <tr key={po.id}>
              <td className="mono">{po.number}</td>
              <td>{po.vendor}</td>
              <td>{po.amount}</td>
              <td>
                <Badge tone={statusTone[po.status] ?? "gray"}>{po.status}</Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="card-actions">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => onNavigate("purchase-orders")}>
          All purchase orders
        </button>
      </div>
    </div>
  );
}

function FinancePreview({ advances, reimbursements }) {
  const pendingAdvances = advances.filter((advance) => advance.status === "pending").length;
  const pendingReimbursements = reimbursements.filter(
    (reimbursement) => reimbursement.status === "pending"
  ).length;

  return (
    <div className="summary-strip">
      <div className="summary-tile">
        <span>Advance requests</span>
        <strong>{pendingAdvances}</strong>
      </div>
      <div className="summary-tile">
        <span>Reimbursements</span>
        <strong>{pendingReimbursements}</strong>
      </div>
    </div>
  );
}

function HrPreview({ leaves, onNavigate }) {
  return (
    <div className="action-stack">
      <div className="summary-strip">
        <div className="summary-tile">
          <span>Leave actions</span>
          <strong>{leaves.length}</strong>
        </div>
        <div className="summary-tile">
          <span>Announcements</span>
          <strong>2</strong>
        </div>
      </div>
      <div className="button-row">
        <button type="button" className="btn btn-primary" onClick={() => onNavigate("leave-admin")}>
          Final approvals
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => onNavigate("announcements")}>
          Publish news
        </button>
      </div>
    </div>
  );
}

function AdminPreview({ demo, onNavigate }) {
  return (
    <div className="summary-strip">
      <button type="button" className="summary-tile tile-button" onClick={() => onNavigate("admin-users")}>
        <span>User accounts</span>
        <strong>{demo.users?.length ?? 0}</strong>
      </button>
      <button type="button" className="summary-tile tile-button" onClick={() => onNavigate("audit")}>
        <span>Audit log</span>
        <strong>{demo.auditLogs.length}</strong>
      </button>
    </div>
  );
}

export function LocalRequestsPanel({ demo, onOpenModal, onNavigate }) {
  return (
    <div className="workspace-stack">
      <article className="card">
        <div className="card-header">
          <h2 className="card-title">My item requests</h2>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => onOpenModal("item-request")}>
            New request
          </button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th>Qty</th>
                <th>Date</th>
                <th>Status</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {demo.requests.map((request) => (
                <tr key={request.id}>
                  <td>{request.item}</td>
                  <td>{request.qty}</td>
                  <td>{request.date}</td>
                  <td>
                    <Badge tone={statusTone[request.status] ?? "gray"}>{request.status}</Badge>
                  </td>
                  <td>{request.reason ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>

      <article className="card">
        <div className="card-header">
          <h2 className="card-title">My leave requests</h2>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => onNavigate("leave")}>
            Apply leave
          </button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Type</th>
                <th>From</th>
                <th>To</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {demo.leaves.slice(0, 5).map((leave) => (
                <tr key={leave.id}>
                  <td>{leave.type}</td>
                  <td>{leave.start}</td>
                  <td>{leave.end}</td>
                  <td>
                    <Badge tone={statusTone[leave.status] ?? "gray"}>{leave.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
    </div>
  );
}

export function LeavePanel({ onSubmitLeave, leaveBalances = [] }) {
  return (
    <div className="two-col">
      <article className="card form-card">
        <h2 className="card-title">Apply for leave</h2>
        <form className="form-grid" onSubmit={onSubmitLeave}>
          <label className="form-group">
            <span className="form-label">Leave type</span>
            <select name="type" className="form-select" defaultValue="Annual Leave">
              <option>Annual Leave</option>
              <option>Sick Leave</option>
              <option>Casual Leave</option>
              <option>Maternity/Paternity</option>
            </select>
          </label>
          <label className="form-group">
            <span className="form-label">Total days</span>
            <input name="days" className="form-input" type="number" min="0.5" step="0.5" defaultValue="1" />
          </label>
          <label className="form-group">
            <span className="form-label">Start date</span>
            <input name="start" className="form-input" type="date" defaultValue="2026-05-05" />
          </label>
          <label className="form-group">
            <span className="form-label">End date</span>
            <input name="end" className="form-input" type="date" defaultValue="2026-05-06" />
          </label>
          <label className="form-group full">
            <span className="form-label">Handover person</span>
            <input name="handover" className="form-input" placeholder="Colleague covering your work" required />
          </label>
          <label className="form-group full">
            <span className="form-label">Reason</span>
            <textarea
              name="reason"
              className="form-textarea"
              placeholder="Short reason for leave"
              required
            />
          </label>
          <div className="modal-footer full">
            <button type="submit" className="btn btn-primary">
              Submit leave request
            </button>
          </div>
        </form>
      </article>
      <article className="card">
        <h2 className="card-title">Leave balance</h2>
        <div className="summary-strip">
          {leaveBalances.map((balance) => (
            <div key={balance.type} className="summary-tile">
              <span>{balance.type}</span>
              <strong>{balance.remaining}</strong>
              <small>{balance.used} used of {balance.total}</small>
            </div>
          ))}
        </div>
        <div className="decision-banner">
          <strong>Policy guardrails</strong>
          <span>Negative balances are blocked. Half-day leave counts as 0.5 days.</span>
        </div>
      </article>
    </div>
  );
}

export function LeaveAdminPanel({ leaves, onApproveLeave, onRejectLeave, mode = "manager" }) {
  const actionableStatuses = mode === "hr" ? ["pending HR", "pending"] : ["pending", "pending manager"];

  return (
    <article className="card">
      <h2 className="card-title">{mode === "hr" ? "HR final leave approval" : "Leave management"}</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Employee</th>
              <th>Type</th>
              <th>Dates</th>
              <th>Reason</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {leaves.map((leave) => (
              <tr key={leave.id}>
                <td>{leave.from}</td>
                <td>{leave.type}</td>
                <td>
                  {leave.start} to {leave.end}
                </td>
                <td>{leave.reason}</td>
                <td>
                  <Badge tone={statusTone[leave.status] ?? "gray"}>{leave.status}</Badge>
                </td>
                <td>
                  {actionableStatuses.includes(leave.status) ? (
                    <div className="button-row table-actions">
                      <button
                        type="button"
                        className="btn btn-success btn-sm"
                        onClick={() => onApproveLeave(leave.id)}
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={() => onRejectLeave(leave.id)}
                      >
                        Reject
                      </button>
                    </div>
                  ) : (
                    "-"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
}

export function WorkPlanPanel({ tasks, onMoveTask, onOpenTaskModal }) {
  const columns = [
    ["todo", "To do", "blue"],
    ["pending", "In progress", "amber"],
    ["done", "Done", "green"]
  ];

  return (
    <div className="kanban">
      {columns.map(([key, label, tone]) => {
        const columnTasks = tasks.filter((task) => task.col === key);

        return (
          <section key={key} className="kanban-col">
            <div className="kanban-header">
              <span className={`tone-${tone}`}>{label}</span>
              <Badge>{columnTasks.length}</Badge>
            </div>
            {columnTasks.map((task) => (
              <button
                key={task.id}
                type="button"
                className="kanban-task"
                onClick={() => onMoveTask(task.id)}
              >
                <span className="kanban-task-title">{task.title}</span>
                <span className="kanban-task-meta">Due: {task.due}</span>
              </button>
            ))}
            <button type="button" className="dashed-action" onClick={onOpenTaskModal}>
              Add task
            </button>
          </section>
        );
      })}
    </div>
  );
}

export function AttendancePanel({ role }) {
  const days = [
    "P",
    "P",
    "P",
    "P",
    "A",
    "P",
    "P",
    "P",
    "P",
    "P",
    "P",
    "P",
    "A",
    "P",
    "P",
    "P",
    "P",
    "P",
    "P",
    "F",
    "F"
  ];
  const teamRows = [
    ["Bilal Ahmed", "Present", "09:01 AM", "8h 05m"],
    ["Sara Khan", "Present", "08:54 AM", "8h 12m"],
    ["Omar Sheikh", "On Leave", "-", "-"],
    ["Fatima Ali", "Present", "09:12 AM", "7h 48m"]
  ];

  return (
    <div className="workspace-stack">
      {role === "HR_OFFICER" || role === "SUPER_ADMIN" ? (
        <article className="card">
          <div className="form-grid">
            <label className="form-group">
              <span className="form-label">Department</span>
              <select className="form-select" defaultValue="All departments">
                <option>All departments</option>
                <option>Operations</option>
                <option>Finance</option>
                <option>Human Resources</option>
                <option>Stores</option>
                <option>Procurement</option>
              </select>
            </label>
            <label className="form-group">
              <span className="form-label">Date</span>
              <input className="form-input" type="date" defaultValue="2026-04-30" />
            </label>
          </div>
        </article>
      ) : null}
      <div className="two-col">
      <article className="card">
        <h2 className="card-title">
          {role === "LINE_MANAGER"
            ? "Team attendance"
            : role === "HR_OFFICER" || role === "SUPER_ADMIN"
              ? "Company attendance"
              : "My attendance"}
        </h2>
        <div className="att-grid">
          {days.map((day, index) => (
            <div
              key={`${day}-${index}`}
              className={
                day === "P"
                  ? "att-day present"
                  : day === "A"
                    ? "att-day absent"
                    : "att-day future"
              }
            >
              {index + 1}
            </div>
          ))}
        </div>
      </article>
      <article className="card">
        <h2 className="card-title">Today</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Status</th>
                <th>Check in</th>
                <th>Duration</th>
              </tr>
            </thead>
            <tbody>
              {teamRows.map(([name, status, checkIn, duration]) => (
                <tr key={name}>
                  <td>{role === "LINE_MANAGER" ? name : name === "Bilal Ahmed" ? "You" : name}</td>
                  <td>
                    <Badge tone={status === "Present" ? "green" : "amber"}>{status}</Badge>
                  </td>
                  <td>{checkIn}</td>
                  <td>{duration}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
      </div>
    </div>
  );
}

export function AdvancePanel({ advances, onSubmitAdvance }) {
  return (
    <div className="two-col">
      <article className="card">
        <h2 className="card-title">Employee advance request</h2>
        <form className="form-grid" onSubmit={onSubmitAdvance}>
          <label className="form-group full">
            <span className="form-label">Amount</span>
            <input name="amount" className="form-input" type="number" min="1000" defaultValue="25000" />
          </label>
          <label className="form-group full">
            <span className="form-label">Reason</span>
            <textarea name="reason" className="form-textarea" required defaultValue="Medical emergency" />
          </label>
          <label className="form-group">
            <span className="form-label">Repayment</span>
            <select name="repayment" className="form-select" defaultValue="3 months">
              <option>2 months</option>
              <option>3 months</option>
              <option>6 months</option>
            </select>
          </label>
          <div className="modal-footer full">
            <button type="submit" className="btn btn-primary">
              Submit advance
            </button>
          </div>
        </form>
      </article>
      <article className="card">
        <h2 className="card-title">Recent advances</h2>
        <RequestTable
          rows={advances.map((item) => [
            item.employee,
            item.amount,
            item.reason,
            <Badge key={item.id} tone={statusTone[item.status] ?? "gray"}>
              {item.status}
            </Badge>
          ])}
          headers={["Employee", "Amount", "Reason", "Status"]}
        />
      </article>
    </div>
  );
}

const stockCategories = ["RWHU", "PROGRESSIVE", "Stationary"];
const stockItemsPerCategoryPage = 7;

function getStockStatus(item) {
  if (item.isDiscontinued) {
    return { label: "Discontinued", tone: "gray" };
  }

  if (Number(item.reservedQty ?? 0) > 0) {
    return { label: "Reserved", tone: "purple" };
  }

  if (Number(item.qty ?? 0) <= 0) {
    return { label: "Out of stock", tone: "red" };
  }

  if (Number(item.qty ?? 0) < 10) {
    return { label: "Low stock", tone: "amber" };
  }

  return { label: "In stock", tone: "green" };
}

function normalizeCategory(category) {
  const normalized = String(category ?? "").toLowerCase();

  if (normalized.includes("progressive")) {
    return "PROGRESSIVE";
  }

  if (normalized.includes("stationary") || normalized.includes("stationery")) {
    return "Stationary";
  }

  return "RWHU";
}

function getStockItemType(item) {
  return item?.type || item?.itemType || item?.specification || item?.category || item?.itemCategory || "Not specified";
}

export function StockPanel({ stock, error = "", token = "", onStockCreated, onStockMovement }) {
  const [selectedItem, setSelectedItem] = useState(null);
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [categoryPages, setCategoryPages] = useState(
    stockCategories.reduce((pages, category) => ({ ...pages, [category]: 1 }), {})
  );
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");
  const [movementError, setMovementError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const groupedStock = useMemo(
    () =>
      stockCategories.reduce((groups, category) => {
        groups[category] = stock.filter((item) => normalizeCategory(item.category) === category);
        return groups;
      }, {}),
    [stock]
  );

  function updateCategoryPage(category, nextPage) {
    setCategoryPages((current) => ({
      ...current,
      [category]: nextPage
    }));
  }

  async function handleAddItem(event) {
    event.preventDefault();
    setFormError("");
    setFormSuccess("");

    const form = new FormData(event.currentTarget);
    const itemId = String(form.get("itemId") ?? "").trim();
    const hasDuplicate = stock.some((item) => String(item.itemId ?? item.sku).toLowerCase() === itemId.toLowerCase());

    if (hasDuplicate) {
      setFormError("This Item ID already exists. Please enter a unique Item ID.");
      return;
    }

    setIsSubmitting(true);

    try {
      await apiClient.createInventoryStockItem(token, {
        itemName: form.get("itemName"),
        itemType: form.get("itemType"),
        itemCategory: form.get("itemCategory"),
        itemId
      });
      event.currentTarget.reset();
      setIsAddingItem(false);
      setFormSuccess("Item added to inventory.");
      onStockCreated?.();
    } catch (submitError) {
      setFormError(submitError.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleStockMovement(event, movementType) {
    event.preventDefault();
    setMovementError("");

    const form = new FormData(event.currentTarget);
    const stockItemId = Number(form.get("stockItemId"));
    const quantity = Number(form.get("quantity") || 0);
    const stockItem = stock.find((item) => item.id === stockItemId);

    if (!stockItem || quantity <= 0) {
      setMovementError("Select a stock item and enter a valid quantity.");
      return;
    }

    if (movementType === "out" && quantity > Number(stockItem.availableQty ?? stockItem.qty ?? 0)) {
      setMovementError("Stock out quantity cannot exceed available stock.");
      return;
    }

    if (!onStockMovement) {
      return false;
    }

    onStockMovement({
      itemId: stockItem.id,
      itemCode: stockItem.itemId ?? stockItem.sku,
      itemName: stockItem.name,
      itemType: getStockItemType(stockItem),
      unit: stockItem.unit,
      movementType,
      quantity,
      reference: form.get("reference"),
      location: form.get("location") || stockItem.location,
      notes: form.get("notes")
    });

    event.currentTarget.reset();
    return true;
  }

  return (
    <section className="stock-workspace">
      <div className="stock-header">
        <div>
          <p className="section-label">Inventory catalog</p>
          <h2 className="card-title">Stock overview</h2>
        </div>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => setIsAddingItem(true)}>
          Add item
        </button>
      </div>

      {error ? <p className="form-error">{error}</p> : null}
      {formSuccess ? <p className="form-success">{formSuccess}</p> : null}
      {movementError ? <p className="form-error">{movementError}</p> : null}

      <section className="stock-movement-grid" aria-label="Stock movement actions">
        <StockMovementCard
          title="Stock in"
          tone="green"
          stock={stock}
          defaultReference="GRN / opening balance"
          submitLabel="Add stock"
          onSubmit={(event) => handleStockMovement(event, "in")}
        />
        <StockMovementCard
          title="Stock out"
          tone="red"
          stock={stock}
          defaultReference="Issue slip / requisition"
          submitLabel="Issue stock"
          onSubmit={(event) => handleStockMovement(event, "out")}
        />
      </section>

      <div className="stock-category-stack">
        {stockCategories.map((category) => {
          const categoryItems = groupedStock[category];
          const totalPages = Math.max(1, Math.ceil(categoryItems.length / stockItemsPerCategoryPage));
          const currentPage = Math.min(categoryPages[category] ?? 1, totalPages);
          const pageStart = (currentPage - 1) * stockItemsPerCategoryPage;
          const visibleCategoryItems = categoryItems.slice(pageStart, pageStart + stockItemsPerCategoryPage);

          return (
            <article key={category} className="card stock-category-panel">
              <div className="stock-category-title">
                <div>
                  <h3>{category}</h3>
                  <span>{categoryItems.length} items</span>
                </div>
                {categoryItems.length > stockItemsPerCategoryPage ? (
                  <div className="stock-pagination">
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      disabled={currentPage === 1}
                      onClick={() => updateCategoryPage(category, currentPage - 1)}
                    >
                      Previous
                    </button>
                    <strong>{currentPage} of {totalPages}</strong>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      disabled={currentPage === totalPages}
                      onClick={() => updateCategoryPage(category, currentPage + 1)}
                    >
                      Next
                    </button>
                  </div>
                ) : null}
              </div>

              {categoryItems.length ? (
                <div className="table-wrap stock-table-wrap">
                  <table className="stock-table">
                    <thead>
                      <tr>
                        <th>Item ID</th>
                        <th>Name</th>
                        <th>Type</th>
                        <th>Location</th>
                        <th>Current stock</th>
                        <th>Available stock</th>
                        <th>Reserved stock</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleCategoryItems.map((item) => {
                        const status = getStockStatus(item);

                        return (
                          <tr key={item.id} className="stock-table-row" onClick={() => setSelectedItem(item)}>
                            <td className="mono">{item.itemId ?? item.sku}</td>
                            <td>
                              <strong>{item.name}</strong>
                            </td>
                            <td>{getStockItemType(item)}</td>
                            <td>{item.location}</td>
                            <td>{item.qty} {item.unit}</td>
                            <td>{item.availableQty} {item.unit}</td>
                            <td>{item.reservedQty} {item.unit}</td>
                            <td>
                              <Badge tone={status.tone}>{status.label}</Badge>
                            </td>
                            <td>
                              <div className="stock-row-actions" onClick={(clickEvent) => clickEvent.stopPropagation()}>
                                <button
                                  type="button"
                                  className="btn btn-ghost btn-sm"
                                  onClick={() => setSelectedItem({ ...item, detailMode: "requests" })}
                                >
                                  Requests
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-ghost btn-sm"
                                  onClick={() => setSelectedItem({ ...item, detailMode: "purchaseOrders" })}
                                >
                                  POs
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="helper-text">No items recorded in this category yet.</p>
              )}
            </article>
          );
        })}
      </div>

      {isAddingItem ? (
        <div className="modal-overlay open" onMouseDown={(event) => event.target === event.currentTarget && setIsAddingItem(false)}>
          <form className="modal modal-form" onSubmit={handleAddItem}>
            <h2 className="modal-title">Add inventory item</h2>
            {formError ? <p className="form-error full">{formError}</p> : null}
            <label className="form-group full">
              <span className="form-label">Item name</span>
              <input name="itemName" className="form-input" required />
            </label>
            <label className="form-group">
              <span className="form-label">Type</span>
              <input name="itemType" className="form-input" required />
            </label>
            <label className="form-group">
              <span className="form-label">Category</span>
              <select name="itemCategory" className="form-select" defaultValue="RWHU" required>
                {stockCategories.map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </label>
            <label className="form-group full">
              <span className="form-label">Item ID</span>
              <input name="itemId" className="form-input" required />
            </label>
            <div className="modal-footer full">
              <button type="button" className="btn btn-ghost" onClick={() => setIsAddingItem(false)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                {isSubmitting ? "Adding..." : "Add item"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {selectedItem ? (
        <div className="stock-float" role="dialog" aria-modal="true">
          <div className="stock-float-header">
            <div>
              <span className="mono">{selectedItem.itemId ?? selectedItem.sku}</span>
              <h3>{selectedItem.name}</h3>
            </div>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelectedItem(null)}>
              Close
            </button>
          </div>
          <div className="stock-detail-grid">
            <DetailValue label="Item ID" value={selectedItem.itemId ?? selectedItem.sku} />
            <DetailValue label="Type" value={selectedItem.type} />
            <DetailValue label="Units available" value={`${selectedItem.availableQty} ${selectedItem.unit}`} />
            <DetailValue label="Default storage location" value={selectedItem.location} />
          </div>
          {selectedItem.detailMode === "requests" ? (
            <LinkedList title="Requests against item" items={selectedItem.linkedRequests} empty="No linked requests found." />
          ) : null}
          {selectedItem.detailMode === "purchaseOrders" ? (
            <LinkedList title="POs linked with item" items={selectedItem.linkedPurchaseOrders} empty="No linked purchase orders found." />
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function StockMovementCard({ title, tone, stock, defaultReference, submitLabel, onSubmit }) {
  const [selectedStockItemId, setSelectedStockItemId] = useState("");
  const selectedStockItem = stock.find((item) => String(item.id) === selectedStockItemId);
  const isStockIn = title === "Stock in";

  function handleSubmit(event) {
    const didSubmit = onSubmit(event);
    if (didSubmit) {
      setSelectedStockItemId("");
    }
  }

  return (
    <article className={`stock-movement-card ${tone}`}>
      <div>
        <p className="section-label">{title}</p>
        <h3>{isStockIn ? "Receive inventory" : "Issue inventory"}</h3>
      </div>
      <form className="stock-movement-form" onSubmit={handleSubmit}>
        <label className="form-group full">
          <span className="form-label">Item name</span>
          <select
            name="stockItemId"
            className="form-select"
            value={selectedStockItemId}
            onChange={(event) => setSelectedStockItemId(event.target.value)}
            required
          >
            <option value="">Select item name</option>
            {stock.map((item) => (
              <option key={`${title}-${item.id}`} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label className="form-group">
          <span className="form-label">Type</span>
          <input
            className="form-input"
            value={selectedStockItem ? getStockItemType(selectedStockItem) : ""}
            placeholder="Auto-filled"
            readOnly
          />
        </label>
        <label className="form-group">
          <span className="form-label">Item ID</span>
          <input
            className="form-input mono"
            value={selectedStockItem ? selectedStockItem.itemId ?? selectedStockItem.sku ?? "" : ""}
            placeholder="Auto-filled"
            readOnly
          />
        </label>
        <label className="form-group">
          <span className="form-label">{isStockIn ? "Received quantity" : "Issued quantity"}</span>
          <input name="quantity" className="form-input" type="number" min="1" step="1" required />
        </label>
        <label className="form-group">
          <span className="form-label">Location</span>
          <input name="location" className="form-input" placeholder="Store / rack / site" />
        </label>
        <label className="form-group">
          <span className="form-label">Reference</span>
          <input name="reference" className="form-input" placeholder={defaultReference} />
        </label>
        <label className="form-group">
          <span className="form-label">Notes</span>
          <input name="notes" className="form-input" placeholder="Optional remarks" />
        </label>
        <div className="modal-footer full">
          <button type="submit" className={tone === "green" ? "btn btn-success btn-sm" : "btn btn-danger btn-sm"}>
            {submitLabel}
          </button>
        </div>
      </form>
    </article>
  );
}

function DetailValue({ label, value }) {
  return (
    <div className="stock-detail-value">
      <span>{label}</span>
      <strong>{value || "Not recorded"}</strong>
    </div>
  );
}

function LinkedList({ title, items = [], empty }) {
  return (
    <div className="stock-linked-list">
      <h4>{title}</h4>
      {items.length ? (
        items.map((item) => (
          <div key={`${title}-${item.id}-${item.requisitionItemId ?? item.poNumber}`} className="stock-linked-item">
            <span className="mono">{item.requestId ?? item.poNumber}</span>
            <Badge tone={getBadgeTone(item.status)}>{String(item.status ?? "Open").replaceAll("_", " ")}</Badge>
            <strong>{item.quantity} units</strong>
          </div>
        ))
      ) : (
        <p className="helper-text">{empty}</p>
      )}
    </div>
  );
}

function getBadgeTone(value) {
  const normalized = String(value ?? "").toLowerCase();

  if (normalized.includes("cancel") || normalized.includes("reject")) {
    return "red";
  }

  if (normalized.includes("partial") || normalized.includes("approved") || normalized.includes("draft")) {
    return "amber";
  }

  if (normalized.includes("received") || normalized.includes("fulfilled") || normalized.includes("issued")) {
    return "green";
  }

  return "blue";
}

function getMovementQuantity(log) {
  if (Number.isFinite(Number(log.quantity))) {
    return Number(log.quantity);
  }

  const parsed = Number.parseFloat(String(log.movement ?? "").replace(/[+-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function StockLogPanel({ stockLogs, stock = [] }) {
  const [selectedItemKey, setSelectedItemKey] = useState("all");
  const selectedItem = stock.find((item) => String(item.id) === selectedItemKey);
  const visibleLogs = useMemo(() => {
    if (selectedItemKey === "all") {
      return stockLogs;
    }

    return stockLogs.filter((log) => String(log.itemId) === selectedItemKey);
  }, [selectedItemKey, stockLogs]);
  const stockInTotal = visibleLogs
    .filter((log) => log.type === "in" || String(log.movement).startsWith("+"))
    .reduce((total, log) => total + getMovementQuantity(log), 0);
  const stockOutTotal = visibleLogs
    .filter((log) => log.type === "out" || String(log.movement).startsWith("-"))
    .reduce((total, log) => total + getMovementQuantity(log), 0);

  return (
    <div className="workspace-stack">
      <article className="card stock-history-hero">
        <div className="card-header">
          <div>
            <p className="section-label">Traceability</p>
            <h2 className="card-title">Stock history by item</h2>
          </div>
          <label className="form-group stock-history-filter">
            <span className="form-label">Item trace</span>
            <select
              className="form-select"
              value={selectedItemKey}
              onChange={(event) => setSelectedItemKey(event.target.value)}
            >
              <option value="all">All items</option>
              {stock.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.itemId ?? item.sku} - {item.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="stock-history-summary">
          <div className="summary-tile">
            <span>Current balance</span>
            <strong>{selectedItem ? `${selectedItem.qty} ${selectedItem.unit}` : "All items"}</strong>
          </div>
          <div className="summary-tile">
            <span>Stock in</span>
            <strong>+{stockInTotal}</strong>
          </div>
          <div className="summary-tile">
            <span>Stock out</span>
            <strong>-{stockOutTotal}</strong>
          </div>
          <div className="summary-tile">
            <span>Trace entries</span>
            <strong>{visibleLogs.length}</strong>
          </div>
        </div>
      </article>

      <section className="two-col">
        <article className="card">
          <h2 className="card-title">Movement timeline</h2>
          {visibleLogs.length ? (
            <div className="stock-trace-list">
              {visibleLogs.map((log) => {
                const isStockIn = log.type === "in" || String(log.movement).startsWith("+");

                return (
                  <div key={`${log.id}-trace`} className={`stock-trace-item ${isStockIn ? "in" : "out"}`}>
                    <span className="stock-trace-marker" />
                    <div>
                      <strong>{isStockIn ? "Stock in" : "Stock out"} - {log.item}</strong>
                      <p>
                        <Badge tone={isStockIn ? "green" : "red"}>{log.movement}</Badge>{" "}
                        {log.reference || "Manual movement"}
                      </p>
                      <small>
                        {log.date ?? "Today"} at {log.time} | {log.actor}
                        {log.location ? ` | ${log.location}` : ""}
                      </small>
                      {log.notes ? <p className="helper-text">{log.notes}</p> : null}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="helper-text">No stock movement has been recorded for this selection yet.</p>
          )}
        </article>

        <article className="card">
          <h2 className="card-title">Transaction register</h2>
          <RequestTable
            headers={["Date", "Time", "Item", "Movement", "Actor", "Reference"]}
            rows={visibleLogs.map((log) => [
              log.date ?? "Today",
              <span key={`${log.id}-time`} className="mono">
                {log.time}
              </span>,
              log.item,
              <Badge key={`${log.id}-badge`} tone={String(log.movement).startsWith("+") ? "green" : "red"}>
                {log.movement}
              </Badge>,
              log.actor,
              log.reference || "-"
            ])}
          />
        </article>
      </section>
    </div>
  );
}

export function VendorsPanel({ vendors }) {
  return (
    <article className="card">
      <div className="card-header">
        <h2 className="card-title">Approved vendors</h2>
        <Badge tone="green">{vendors.length} active</Badge>
      </div>
      <RequestTable
        headers={["Vendor", "Category", "Contact", "Rating", "Status"]}
        rows={vendors.map((vendor) => [
          vendor.name,
          vendor.category,
          vendor.contact,
          vendor.rating,
          <Badge key={vendor.id} tone="green">
            active
          </Badge>
        ])}
      />
    </article>
  );
}

export function PurchaseOrdersPanel({ purchaseOrders, onOpenModal }) {
  return (
    <article className="card">
      <div className="card-header">
        <h2 className="card-title">Purchase orders</h2>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => onOpenModal("purchase-order")}>
          Create PO
        </button>
      </div>
      <RequestTable
        headers={["PO", "Vendor", "Items", "Amount", "Delivery", "Status"]}
        rows={purchaseOrders.map((po) => [
          <span key={`${po.id}-number`} className="mono">
            {po.number}
          </span>,
          po.vendor,
          po.items,
          po.amount,
          po.delivery,
          <Badge key={po.id} tone={statusTone[po.status] ?? "gray"}>
            {po.status}
          </Badge>
        ])}
      />
    </article>
  );
}

export function GoodsReceiptPanel({ receipts }) {
  const rows = receipts.map((receipt) => [
    <span key={`${receipt.id}-grn`} className="mono">
      {receipt.grnId ?? receipt.grnNumber ?? receipt.number}
    </span>,
    <span key={`${receipt.id}-po`} className="mono">
      {receipt.poNumber ?? receipt.po}
    </span>,
    receipt.quantityReceived ?? receipt.receivedQuantity ?? receipt.quantity ?? receipt.items,
    receipt.grnDate ?? receipt.date ?? receipt.receivedAt,
    receipt.receivedBy ?? receipt.receiver?.fullName ?? receipt.receiver ?? "Not recorded",
    receipt.location ?? receipt.storageLocation ?? receipt.defaultLocation ?? "Main store",
    receipt.notes ?? receipt.remarks ?? receipt.notesRemarks ?? "-"
  ]);

  return (
    <article className="card">
      <h2 className="card-title">Goods receipt notes</h2>
      {rows.length ? (
        <RequestTable
          headers={["GRN ID", "PO number", "Quantity received", "GRN date", "Received by", "Location", "Notes/Remarks"]}
          rows={rows}
        />
      ) : (
        <p className="helper-text">No goods receipt notes have been recorded yet.</p>
      )}
    </article>
  );
}

export function FinancePaymentsPanel({ purchaseOrders, onReleasePayment }) {
  return (
    <article className="card">
      <h2 className="card-title">PO and vendor payments</h2>
      <RequestTable
        headers={["PO", "Vendor", "GRN", "Amount", "Payment", "Action"]}
        rows={purchaseOrders.slice(0, 4).map((po) => [
          <span key={`${po.id}-po`} className="mono">
            {po.number}
          </span>,
          po.vendor,
          po.grn,
          po.amount,
          <Badge key={`${po.id}-status`} tone={po.payment === "paid" ? "green" : "amber"}>
            {po.payment}
          </Badge>,
          po.payment === "paid" ? (
            "Receipt saved"
          ) : (
            <button
              key={`${po.id}-action`}
              type="button"
              className="btn btn-success btn-sm"
              onClick={() => onReleasePayment(po.id)}
            >
              Release
            </button>
          )
        ])}
      />
    </article>
  );
}

export function FinanceAdvancePanel({ advances, onApproveAdvance, onRejectAdvance }) {
  return (
    <article className="card">
      <h2 className="card-title">Employee advance requests</h2>
      <RequestTable
        headers={["Employee", "Amount", "Reason", "Repayment", "Status", "Action"]}
        rows={advances.map((advance) => [
          advance.employee,
          advance.amount,
          advance.reason,
          advance.repayment,
          <Badge key={`${advance.id}-status`} tone={statusTone[advance.status] ?? "gray"}>
            {advance.status}
          </Badge>,
          advance.status === "pending" ? (
            <div key={`${advance.id}-actions`} className="button-row table-actions">
              <button
                type="button"
                className="btn btn-success btn-sm"
                onClick={() => onApproveAdvance(advance.id)}
              >
                Approve
              </button>
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={() => onRejectAdvance(advance.id)}
              >
                Reject
              </button>
            </div>
          ) : (
            "-"
          )
        ])}
      />
    </article>
  );
}

export function FinanceReimbursementPanel({ reimbursements, onApproveReimbursement }) {
  return (
    <article className="card">
      <h2 className="card-title">Reimbursement claims</h2>
      <RequestTable
        headers={["Employee", "Type", "Amount", "Description", "Date", "Status", "Action"]}
        rows={reimbursements.map((claim) => [
          claim.employee,
          claim.type,
          claim.amount,
          claim.description,
          claim.date,
          <Badge key={`${claim.id}-status`} tone={statusTone[claim.status] ?? "gray"}>
            {claim.status}
          </Badge>,
          claim.status === "pending" ? (
            <button
              key={`${claim.id}-action`}
              type="button"
              className="btn btn-success btn-sm"
              onClick={() => onApproveReimbursement(claim.id)}
            >
              Approve
            </button>
          ) : (
            "View"
          )
        ])}
      />
    </article>
  );
}

export function PayrollPanel({ onCreatePayroll }) {
  const rows = [
    ["Ayaan Employee", "80,000", "15,000", "5,000", "90,000"],
    ["Layla Manager", "120,000", "22,000", "8,000", "134,000"],
    ["Inaya Inventory", "75,000", "14,000", "4,500", "84,500"],
    ["Omar Procurement", "82,000", "15,000", "5,100", "91,900"],
    ["Sara Finance", "88,000", "16,000", "5,300", "98,700"]
  ];

  return (
    <article className="card">
      <div className="card-header">
        <h2 className="card-title">Payroll - April 2026</h2>
        <div className="button-row">
          <Badge tone="green">Processed</Badge>
          <button type="button" className="btn btn-primary btn-sm" onClick={onCreatePayroll}>
            Create May payroll
          </button>
        </div>
      </div>
      <RequestTable
        headers={["Employee", "Basic", "Allowances", "Deductions", "Net pay", "Status"]}
        rows={rows.map(([name, basic, allowances, deductions, net]) => [
          name,
          `PKR ${basic}`,
          <span key={`${name}-allowance`} className="tone-green">
            +PKR {allowances}
          </span>,
          <span key={`${name}-deduction`} className="tone-red">
            -PKR {deductions}
          </span>,
          <span key={`${name}-net`} className="tone-amber">
            PKR {net}
          </span>,
          <Badge key={`${name}-status`} tone="green">
            Paid
          </Badge>
        ])}
      />
      <div className="total-row">
        Total payroll: <strong>PKR 499,100</strong>
      </div>
    </article>
  );
}

export function ReimbursementClaimPanel({ reimbursements, onSubmitReimbursement }) {
  return (
    <div className="two-col">
      <article className="card">
        <h2 className="card-title">Submit reimbursement claim</h2>
        <form className="form-grid" onSubmit={onSubmitReimbursement}>
          <label className="form-group">
            <span className="form-label">Claim type</span>
            <select name="type" className="form-select" defaultValue="Travel">
              <option>Travel</option>
              <option>Medical</option>
              <option>Office supplies</option>
              <option>Client expense</option>
            </select>
          </label>
          <label className="form-group">
            <span className="form-label">Amount</span>
            <input name="amount" className="form-input" type="number" min="1" max="10000" defaultValue="4500" />
          </label>
          <label className="form-group">
            <span className="form-label">Expense date</span>
            <input name="date" className="form-input" type="date" defaultValue="2026-04-27" />
          </label>
          <label className="form-group">
            <span className="form-label">Receipt reference</span>
            <input name="receipt" className="form-input" placeholder="Receipt or invoice number" required />
          </label>
          <label className="form-group full">
            <span className="form-label">Description</span>
            <textarea name="description" className="form-textarea" required placeholder="What was purchased and why?" />
          </label>
          <div className="modal-footer full">
            <button type="submit" className="btn btn-primary">
              Submit claim
            </button>
          </div>
        </form>
      </article>
      <article className="card">
        <h2 className="card-title">Claim history</h2>
        <RequestTable
          headers={["Type", "Amount", "Date", "Description", "Status"]}
          rows={reimbursements.map((claim) => [
            claim.type,
            claim.amount,
            claim.date,
            claim.description,
            <Badge key={claim.id} tone={statusTone[claim.status] ?? "gray"}>
              {claim.status}
            </Badge>
          ])}
        />
      </article>
    </div>
  );
}

export function AnnouncementsPanel({ announcements, onSubmitAnnouncement }) {
  return (
    <div className="two-col">
      <article className="card">
        <h2 className="card-title">Publish announcement</h2>
        <form className="form-grid" onSubmit={onSubmitAnnouncement}>
          <label className="form-group full">
            <span className="form-label">Title</span>
            <input name="title" className="form-input" placeholder="Announcement title" required />
          </label>
          <label className="form-group full">
            <span className="form-label">Message</span>
            <textarea name="message" className="form-textarea" placeholder="Write the announcement" required />
          </label>
          <label className="form-group">
            <span className="form-label">Audience</span>
            <select name="audience" className="form-select" defaultValue="All staff">
              <option>All staff</option>
              <option>Operations</option>
              <option>Human Resources</option>
              <option>Finance</option>
              <option>Procurement</option>
            </select>
          </label>
          <div className="modal-footer full">
            <button type="submit" className="btn btn-primary">
              Publish
            </button>
          </div>
        </form>
      </article>
      <article className="card">
        <h2 className="card-title">Published announcements</h2>
        {announcements.map((announcement) => (
          <div key={announcement.id} className="announce-item">
            <div className="announce-title">{announcement.title}</div>
            <div className="announce-meta">
              {announcement.owner} | {announcement.audience ?? "All staff"} | {announcement.date}
            </div>
            {announcement.message ? <p className="helper-text">{announcement.message}</p> : null}
          </div>
        ))}
      </article>
    </div>
  );
}

export function EmployeeActivityPanel({ users, leaves, requests, reimbursements, advances }) {
  const selectedUser = users[0] ?? { fullName: "No user", department: "-" };
  const rows = [
    ...requests.slice(0, 3).map((request) => [
      request.date,
      request.from,
      "Item request",
      `${request.item} x${request.qty}`,
      request.status
    ]),
    ...leaves.slice(0, 3).map((leave) => [
      leave.date,
      leave.from,
      "Leave",
      `${leave.type}: ${leave.start} to ${leave.end}`,
      leave.status
    ]),
    ...advances.slice(0, 2).map((advance) => [
      "Apr 27",
      advance.employee,
      "Advance",
      `${advance.amount} - ${advance.reason}`,
      advance.status
    ]),
    ...reimbursements.slice(0, 2).map((claim) => [
      claim.date,
      claim.employee,
      "Reimbursement",
      `${claim.amount} - ${claim.description}`,
      claim.status
    ])
  ];

  return (
    <div className="workspace-stack">
      <article className="card">
        <div className="form-grid">
          <label className="form-group">
            <span className="form-label">Employee</span>
            <select className="form-select" defaultValue={selectedUser.fullName}>
              {users.map((user) => (
                <option key={user.email}>{user.fullName}</option>
              ))}
            </select>
          </label>
          <label className="form-group">
            <span className="form-label">Module</span>
            <select className="form-select" defaultValue="All activity">
              <option>All activity</option>
              <option>Leave</option>
              <option>Requests</option>
              <option>Attendance</option>
              <option>Finance</option>
            </select>
          </label>
        </div>
      </article>
      <article className="card">
        <h2 className="card-title">Employee activity log</h2>
        <RequestTable
          headers={["Date", "Employee", "Module", "Details", "Status"]}
          rows={rows.map((row, index) => [
            row[0],
            row[1],
            row[2],
            row[3],
            <Badge key={index} tone={statusTone[row[4]] ?? "gray"}>
              {row[4]}
            </Badge>
          ])}
        />
      </article>
    </div>
  );
}

export function UserManagementPanel({ users, onSubmitUser, onToggleUserStatus }) {
  return (
    <div className="workspace-stack">
      <article className="card">
        <h2 className="card-title">Create user account</h2>
        <form className="form-grid" onSubmit={onSubmitUser}>
          <label className="form-group">
            <span className="form-label">Full name</span>
            <input name="fullName" className="form-input" required />
          </label>
          <label className="form-group">
            <span className="form-label">Email</span>
            <input name="email" className="form-input" type="email" required />
          </label>
          <label className="form-group">
            <span className="form-label">Role</span>
            <select name="role" className="form-select" defaultValue="EMPLOYEE">
              <option value="EMPLOYEE">Employee</option>
              <option value="LINE_MANAGER">Line Manager</option>
              <option value="HR_OFFICER">HR Officer</option>
              <option value="FINANCE">Finance</option>
              <option value="INVENTORY_OFFICER">Inventory Officer</option>
              <option value="PROCUREMENT_OFFICER">Procurement Officer</option>
              <option value="SUPER_ADMIN">Super Admin</option>
            </select>
          </label>
          <label className="form-group">
            <span className="form-label">Department</span>
            <input name="department" className="form-input" defaultValue="Operations" required />
          </label>
          <div className="modal-footer full">
            <button type="submit" className="btn btn-primary">
              Create user
            </button>
          </div>
        </form>
      </article>
      <article className="card">
        <h2 className="card-title">User management</h2>
        <RequestTable
          headers={["Name", "Email", "Role", "Department", "Status", "Action"]}
          rows={users.map((user) => [
            user.fullName,
            user.email,
            user.role.replaceAll("_", " "),
            user.department,
            <Badge key={`${user.email}-status`} tone={statusTone[user.status] ?? "gray"}>
              {user.status}
            </Badge>,
            <button
              key={`${user.email}-action`}
              type="button"
              className={user.status === "active" ? "btn btn-danger btn-sm" : "btn btn-success btn-sm"}
              onClick={() => onToggleUserStatus(user.email)}
            >
              {user.status === "active" ? "Deactivate" : "Reactivate"}
            </button>
          ])}
        />
      </article>
    </div>
  );
}

export function AllRequestsPanel({ requests, leaves, advances, reimbursements }) {
  const rows = [
    ...requests.map((request) => ["Item", request.from, `${request.item} x${request.qty}`, "Inventory", request.status]),
    ...leaves.map((leave) => ["Leave", leave.from, `${leave.type}: ${leave.start} to ${leave.end}`, "HR", leave.status]),
    ...advances.map((advance) => ["Advance", advance.employee, advance.amount, "Finance", advance.status]),
    ...reimbursements.map((claim) => ["Reimbursement", claim.employee, claim.amount, "Finance", claim.status])
  ];

  return (
    <article className="card">
      <h2 className="card-title">All requests - system wide</h2>
      <RequestTable
        headers={["Type", "From", "Details", "Current stage", "Status"]}
        rows={rows.map((row, index) => [
          row[0],
          row[1],
          row[2],
          row[3],
          <Badge key={index} tone={statusTone[row[4]] ?? "gray"}>
            {row[4]}
          </Badge>
        ])}
      />
    </article>
  );
}

export function PaymentHistoryPanel({ payments }) {
  return (
    <article className="card">
      <h2 className="card-title">Payment history</h2>
      <RequestTable
        headers={["Date", "Category", "Reference", "Payee", "Amount", "Status"]}
        rows={payments.map((payment) => [
          payment.date,
          payment.category,
          payment.reference,
          payment.payee,
          payment.amount,
          <Badge key={payment.id} tone={statusTone[payment.status] ?? "gray"}>
            {payment.status}
          </Badge>
        ])}
      />
    </article>
  );
}

export function NotificationHistoryPanel({ notifications, onMarkRead }) {
  return (
    <article className="card">
      <div className="card-header">
        <h2 className="card-title">Notification history</h2>
        <Badge tone={notifications.some((item) => item.status === "unread") ? "blue" : "green"}>
          {notifications.filter((item) => item.status === "unread").length} unread
        </Badge>
      </div>
      <div className="compact-stack">
        {notifications.map((notification) => (
          <div key={notification.id} className="notification-card">
            <div className="requisition-list-top">
              <strong>{notification.subject}</strong>
              <Badge tone={notification.status === "unread" ? "blue" : "green"}>
                {notification.status}
              </Badge>
            </div>
            <p>{notification.message}</p>
            <small>{notification.time} | {notification.route}</small>
            {notification.status === "unread" ? (
              <div className="decision-actions">
                <button
                  type="button"
                  className="btn btn-success btn-sm"
                  onClick={() => onMarkRead(notification.id)}
                >
                  Mark read
                </button>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </article>
  );
}

export function PermissionsPanel({ permissions }) {
  return (
    <article className="card">
      <h2 className="card-title">Role and permission management</h2>
      <RequestTable
        headers={["Role", "Dashboard", "Approvals", "Finance", "Inventory", "Admin"]}
        rows={permissions.map((permission) => [
          permission.role,
          permission.dashboard ? <Badge key={`${permission.role}-dash`} tone="green">Yes</Badge> : "-",
          permission.approvals ? <Badge key={`${permission.role}-app`} tone="green">Yes</Badge> : "-",
          permission.finance ? <Badge key={`${permission.role}-fin`} tone="green">Yes</Badge> : "-",
          permission.inventory ? <Badge key={`${permission.role}-inv`} tone="green">Yes</Badge> : "-",
          permission.admin ? <Badge key={`${permission.role}-adm`} tone="green">Yes</Badge> : "-"
        ])}
      />
    </article>
  );
}

export function AdminOverviewPanel({ demo, onNavigate }) {
  const lowStock = demo.stock.filter((item) => item.qty <= item.min).length;
  const pendingRequests =
    demo.requests.filter((request) => request.status === "pending").length +
    demo.leaves.filter((leave) => ["pending", "pending HR"].includes(leave.status)).length +
    demo.advances.filter((advance) => advance.status === "pending").length +
    demo.reimbursements.filter((claim) => claim.status === "pending").length;

  return (
    <div className="workspace-stack">
      <div className="stats-grid">
        <div className="stat-card green">
          <div className="stat-label">Active users</div>
          <div className="stat-val">{demo.users.length}</div>
          <div className="stat-sub">all roles</div>
        </div>
        <div className="stat-card amber">
          <div className="stat-label">Pending requests</div>
          <div className="stat-val">{pendingRequests}</div>
          <div className="stat-sub">all modules</div>
        </div>
        <div className="stat-card red">
          <div className="stat-label">Low stock</div>
          <div className="stat-val">{lowStock}</div>
          <div className="stat-sub">auto procurement triggers</div>
        </div>
        <div className="stat-card blue">
          <div className="stat-label">Audit events</div>
          <div className="stat-val">{demo.auditLogs.length}</div>
          <div className="stat-sub">visible to admin</div>
        </div>
      </div>
      <div className="two-col">
        <article className="card">
          <h2 className="card-title">Read-only module access</h2>
          <div className="button-row table-actions">
            <button type="button" className="btn btn-ghost" onClick={() => onNavigate("all-requests")}>Requests</button>
            <button type="button" className="btn btn-ghost" onClick={() => onNavigate("stock")}>Inventory</button>
            <button type="button" className="btn btn-ghost" onClick={() => onNavigate("finance-payments")}>Finance</button>
            <button type="button" className="btn btn-ghost" onClick={() => onNavigate("audit")}>Audit</button>
          </div>
        </article>
        <article className="card">
          <h2 className="card-title">System alerts</h2>
          {demo.stock
            .filter((item) => item.qty <= item.min)
            .map((item) => (
              <div key={item.id} className="announce-item">
                <div className="announce-title">{item.name} is below minimum stock</div>
                <div className="announce-meta">
                  {item.qty} {item.unit} on hand | minimum {item.min}
                </div>
              </div>
            ))}
        </article>
      </div>
    </div>
  );
}

export function SettingsPanel() {
  const systemRows = [
    ["Company name", "Shehersaaz IMS"],
    ["Fiscal year", "January to December"],
    ["Currency", "PKR"],
    ["Time zone", "Asia/Karachi"],
    ["Working days", "Monday to Friday"]
  ];
  const leaveRows = [
    ["Annual leave", "20 days/year"],
    ["Sick leave", "10 days/year"],
    ["Casual leave", "5 days/year"],
    ["Carry forward", "Max 5 days"],
    ["Probation leave", "No leave in probation"]
  ];

  return (
    <div className="two-col">
      <SettingsCard title="System settings" rows={systemRows} />
      <SettingsCard title="Leave policy" rows={leaveRows} />
    </div>
  );
}

function SettingsCard({ title, rows }) {
  return (
    <article className="card">
      <h2 className="card-title">{title}</h2>
      <div className="settings-list">
        {rows.map(([key, value]) => (
          <div key={key}>
            <span>{key}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
    </article>
  );
}

export function AuditPanel({ logs }) {
  return (
    <article className="card">
      <div className="card-header">
        <h2 className="card-title">Audit log</h2>
        <input className="form-input compact-input" placeholder="Search logs..." />
      </div>
      <RequestTable
        headers={["Time", "User", "Role", "Action", "Module", "IP"]}
        rows={logs.map((log) => [
          <span key={`${log.id}-time`} className="mono">
            {log.time}
          </span>,
          log.user,
          <Badge key={`${log.id}-role`} tone="purple">
            {log.role}
          </Badge>,
          log.action,
          log.module,
          <span key={`${log.id}-ip`} className="mono">
            {log.ip}
          </span>
        ])}
      />
    </article>
  );
}

export function ComingSoonPanel({ label }) {
  return (
    <article className="card">
      <div className="empty-state">
        <strong>{label}</strong>
        <p>This module has a navigation slot and can be wired to a backend endpoint when you are ready.</p>
      </div>
    </article>
  );
}

function RequestTable({ headers, rows }) {
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
