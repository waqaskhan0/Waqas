import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

const defaultPassword = "Password123!";

const demoAccounts = [
  {
    role: "EMPLOYEE",
    label: "Employee",
    name: "Ayaan Employee",
    email: "employee@ims.local"
  },
  {
    role: "LINE_MANAGER",
    label: "Line Manager",
    name: "Layla Manager",
    email: "manager@ims.local"
  },
  {
    role: "INVENTORY_OFFICER",
    label: "Inventory Officer",
    name: "Inaya Inventory",
    email: "inventory@ims.local"
  },
  {
    role: "PROCUREMENT_OFFICER",
    label: "Procurement Officer",
    name: "Omar Procurement",
    email: "procurement@ims.local"
  },
  {
    role: "FINANCE",
    label: "Finance",
    name: "Sara Finance",
    email: "finance@ims.local"
  },
  {
    role: "HR_OFFICER",
    label: "HR Officer",
    name: "Nadia HR",
    email: "hr@ims.local"
  },
  {
    role: "SUPER_ADMIN",
    label: "Super Admin",
    name: "Super Admin",
    email: "admin@ims.local"
  }
];

export function LoginPage() {
  const { isAuthenticated, signIn } = useAuth();
  const [formValues, setFormValues] = useState({
    email: "",
    password: ""
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
    <main className="login-screen">
      <section className="login-card">
        <div className="login-logo">
          Shehersaaz<span>IMS</span>
        </div>
        <p className="login-subtitle">Enterprise resource and inventory workflow system</p>

        <form className="login-form" onSubmit={handleSubmit}>
          <label className="login-field">
            <span>Email</span>
            <input
              type="email"
              value={formValues.email}
              onChange={(event) =>
                setFormValues((current) => ({ ...current, email: event.target.value }))
              }
              className="login-input"
              required
            />
          </label>

          <label className="login-field">
            <span>Password</span>
            <input
              type="password"
              value={formValues.password}
              onChange={(event) =>
                setFormValues((current) => ({ ...current, password: event.target.value }))
              }
              className="login-input"
              required
            />
          </label>

          {error ? <p className="form-error">{error}</p> : null}

          <button type="submit" className="btn-login" disabled={isSubmitting}>
            {isSubmitting ? "Signing in..." : "Enter workspace"}
          </button>
        </form>

        <p className="login-hint">Enter your assigned workspace credentials to continue.</p>
      </section>

      <aside className="login-roles">
        <div className="role-chip active">
          <span>Secure access</span>
          <strong>Sign in with your assigned account</strong>
        </div>
        <div className="role-chip">
          <span>Access control</span>
          <strong>Role permissions are applied after login</strong>
        </div>
        <div className="role-chip">
          <span>Need help?</span>
          <strong>Contact your system administrator for access</strong>
        </div>
      </aside>
    </main>
  );
}
