import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

const demoAccounts = [
  { role: "Employee", email: "employee@ims.local" },
  { role: "Line Manager", email: "manager@ims.local" },
  { role: "Inventory Officer", email: "inventory@ims.local" },
  { role: "Procurement Officer", email: "procurement@ims.local" },
  { role: "Finance", email: "finance@ims.local" }
];

export function LoginPage() {
  const { isAuthenticated, signIn } = useAuth();
  const [formValues, setFormValues] = useState({
    email: "employee@ims.local",
    password: "Password123!"
  });
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      await signIn(formValues);
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-panel auth-panel-brand">
        <p className="eyebrow">IMS Blueprint</p>
        <h1>Requisition-to-Issue portal</h1>
        <p className="lead">
          Module 1 is now the foundation for employees, managers, inventory,
          procurement, and finance to share one authenticated system.
        </p>
        <div className="module-list">
          <div>
            <span>Module 1</span>
            <strong>Auth, roles, JWT sessions</strong>
          </div>
          <div>
            <span>Module 2</span>
            <strong>Requisition form and persistence</strong>
          </div>
          <div>
            <span>Module 3</span>
            <strong>Approval engine and email triggers</strong>
          </div>
        </div>
      </section>

      <section className="auth-panel auth-panel-form">
        <div className="panel-header">
          <p className="eyebrow">Sign in</p>
          <h2>Role-based access</h2>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            Email
            <input
              type="email"
              value={formValues.email}
              onChange={(event) =>
                setFormValues((current) => ({
                  ...current,
                  email: event.target.value
                }))
              }
              required
            />
          </label>

          <label>
            Password
            <input
              type="password"
              value={formValues.password}
              onChange={(event) =>
                setFormValues((current) => ({
                  ...current,
                  password: event.target.value
                }))
              }
              required
            />
          </label>

          {error ? <p className="form-error">{error}</p> : null}

          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Signing in..." : "Login"}
          </button>
        </form>

        <div className="demo-users">
          <p className="demo-title">Seeded demo users</p>
          <ul>
            {demoAccounts.map((account) => (
              <li key={account.email}>
                <strong>{account.role}</strong>
                <span>{account.email}</span>
              </li>
            ))}
          </ul>
          <p className="demo-footnote">Default password: Password123!</p>
        </div>
      </section>
    </main>
  );
}
