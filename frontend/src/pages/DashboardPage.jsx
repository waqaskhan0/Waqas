import { EmployeeRequisitionWorkspace } from "../components/EmployeeRequisitionWorkspace.jsx";
import { FinanceWorkspace } from "../components/FinanceWorkspace.jsx";
import { InventoryWorkspace } from "../components/InventoryWorkspace.jsx";
import { ManagerApprovalWorkspace } from "../components/ManagerApprovalWorkspace.jsx";
import { NotificationInbox } from "../components/NotificationInbox.jsx";
import { ProcurementWorkspace } from "../components/ProcurementWorkspace.jsx";
import { ReceivingWorkspace } from "../components/ReceivingWorkspace.jsx";
import { useAuth } from "../context/AuthContext.jsx";

const roleViews = {
  EMPLOYEE: {
    title: "Employee requisitions",
    focus: "Create requests, track approvals, and reopen submitted requisitions."
  },
  LINE_MANAGER: {
    title: "Manager approvals",
    focus: "Review assigned requests, add remarks, and record clear decisions."
  },
  INVENTORY_OFFICER: {
    title: "Inventory control",
    focus:
      "Check stock, issue available quantities, and receive vendor deliveries."
  },
  PROCUREMENT_OFFICER: {
    title: "Procurement desk",
    focus: "Turn procurement balances into vendor-backed purchase orders."
  },
  FINANCE: {
    title: "Finance review",
    focus: "Match invoices against purchase orders and goods receipts."
  }
};

const workflowSteps = [
  { role: "EMPLOYEE", label: "Request", owner: "Employee" },
  { role: "LINE_MANAGER", label: "Approve", owner: "Manager" },
  { role: "INVENTORY_OFFICER", label: "Stock", owner: "Inventory" },
  { role: "PROCUREMENT_OFFICER", label: "Purchase", owner: "Procurement" },
  { role: "FINANCE", label: "Match", owner: "Finance" }
];

const nextModules = ["Module 8: Centralized notification service"];

function formatRole(role) {
  return String(role ?? "")
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function DashboardPage() {
  const { token, user, signOut } = useAuth();
  const roleContent = roleViews[user.role] ?? roleViews.EMPLOYEE;
  const isEmployee = user.role === "EMPLOYEE";
  const isManager = user.role === "LINE_MANAGER";
  const isInventoryOfficer = user.role === "INVENTORY_OFFICER";
  const isProcurementOfficer = user.role === "PROCUREMENT_OFFICER";
  const isFinance = user.role === "FINANCE";

  return (
    <main className="dashboard-shell">
      <header className="dashboard-topbar">
        <div className="brand-lockup dashboard-brand">
          <img src="/assets/shehersaaz-logo.png" alt="Shehersaaz logo" />
          <div>
            <strong>Shehersaaz IMS</strong>
            <span>{formatRole(user.role)}</span>
          </div>
        </div>

        <div className="topbar-actions">
          <div className="user-card">
            <span>{user.fullName}</span>
            <strong>{user.department}</strong>
          </div>
          <button type="button" className="secondary-button" onClick={signOut}>
            Logout
          </button>
        </div>
      </header>

      <section className="dashboard-hero">
        <div>
          <p className="eyebrow">Current workspace</p>
          <h1>{roleContent.title}</h1>
          <p className="lead">{roleContent.focus}</p>
        </div>

        <div className="role-summary">
          <span>Signed in as</span>
          <strong>{formatRole(user.role)}</strong>
          <small>{user.fullName}</small>
        </div>
      </section>

      <nav className="workflow-rail" aria-label="Workflow overview">
        {workflowSteps.map((step, index) => (
          <div
            key={step.role}
            className={step.role === user.role ? "workflow-step active" : "workflow-step"}
          >
            <span>{index + 1}</span>
            <div>
              <strong>{step.label}</strong>
              <small>{step.owner}</small>
            </div>
          </div>
        ))}
      </nav>

      <NotificationInbox token={token} />

      {isEmployee ? (
        <EmployeeRequisitionWorkspace token={token} />
      ) : isManager ? (
        <ManagerApprovalWorkspace token={token} />
      ) : isInventoryOfficer ? (
        <div className="workspace-stack">
          <InventoryWorkspace token={token} />
          <ReceivingWorkspace token={token} />
        </div>
      ) : isProcurementOfficer ? (
        <ProcurementWorkspace token={token} />
      ) : isFinance ? (
        <FinanceWorkspace token={token} />
      ) : (
        <section className="grid two-column">
          <article className="card">
            <p className="section-label">Modules 1-7 live</p>
            <h2>Current workflow state</h2>
            <ul className="checklist">
              <li>JWT-based login session and role-aware access</li>
              <li>Manager relationship for routing requisitions</li>
              <li>Employee requisition submission to MySQL</li>
              <li>Manager approve and reject actions</li>
              <li>Inventory stock-based fulfillment branching</li>
              <li>Allocation records and stock issue transactions</li>
              <li>Vendor-backed purchase order creation</li>
              <li>Procurement lines tied back to requisition balances</li>
              <li>GRN capture with purchase-order receipt tracking</li>
              <li>Receipt updates pushed back into inventory stock</li>
              <li>Finance invoice capture with PO and GRN comparison</li>
            </ul>
          </article>

          <article className="card">
            <p className="section-label">Next to build</p>
            <h2>Forward module sequence</h2>
            <ul className="module-roadmap">
              {nextModules.map((moduleName) => (
                <li key={moduleName}>{moduleName}</li>
              ))}
            </ul>
          </article>
        </section>
      )}
    </main>
  );
}
