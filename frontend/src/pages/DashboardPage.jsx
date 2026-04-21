import { EmployeeRequisitionWorkspace } from "../components/EmployeeRequisitionWorkspace.jsx";
import { InventoryWorkspace } from "../components/InventoryWorkspace.jsx";
import { ManagerApprovalWorkspace } from "../components/ManagerApprovalWorkspace.jsx";
import { ProcurementWorkspace } from "../components/ProcurementWorkspace.jsx";
import { ReceivingWorkspace } from "../components/ReceivingWorkspace.jsx";
import { useAuth } from "../context/AuthContext.jsx";

const roleViews = {
  EMPLOYEE: {
    title: "Employee requisitions",
    focus: "Create, submit, and review requisitions across Modules 2 through 4."
  },
  LINE_MANAGER: {
    title: "Manager approvals",
    focus: "Review assigned requisitions, approve or reject them, and trigger decision hooks."
  },
  INVENTORY_OFFICER: {
    title: "Inventory control",
    focus:
      "Branch approved requisitions into stock decisions and receive vendor deliveries back into inventory."
  },
  PROCUREMENT_OFFICER: {
    title: "Procurement desk",
    focus: "Turn procurement balances into purchase orders with vendor-backed line pricing."
  },
  FINANCE: {
    title: "Finance review",
    focus: "Upstream requisition capture is active; finance matching follows later."
  }
};

const nextModules = [
  "Module 7: Finance 3-way match",
  "Module 8: Centralized notification service"
];

export function DashboardPage() {
  const { token, user, signOut } = useAuth();
  const roleContent = roleViews[user.role] ?? roleViews.EMPLOYEE;
  const isEmployee = user.role === "EMPLOYEE";
  const isManager = user.role === "LINE_MANAGER";
  const isInventoryOfficer = user.role === "INVENTORY_OFFICER";
  const isProcurementOfficer = user.role === "PROCUREMENT_OFFICER";

  return (
    <main className="dashboard-shell">
      <header className="dashboard-hero">
        <div>
          <p className="eyebrow">Authenticated</p>
          <h1>{roleContent.title}</h1>
          <p className="lead">{roleContent.focus}</p>
        </div>

        <div className="hero-actions">
          <div className="user-card">
            <span>{user.fullName}</span>
            <strong>{user.role}</strong>
            <small>{user.department}</small>
          </div>
          <button type="button" className="secondary-button" onClick={signOut}>
            Logout
          </button>
        </div>
      </header>

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
      ) : (
        <section className="grid two-column">
          <article className="card">
            <p className="section-label">Modules 1-6 live</p>
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
