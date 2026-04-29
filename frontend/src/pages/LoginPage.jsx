import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

const defaultPassword = "Password123!";

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
    password: defaultPassword
  });
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  function useDemoAccount(email) {
    setFormValues({
      email,
      password: defaultPassword
    });
    setError("");
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
      <section className="auth-panel auth-panel-form">
        <div className="brand-lockup">
          <img src="/assets/shehersaaz-logo.png" alt="Shehersaaz logo" />
          <div>
            <strong>Shehersaaz IMS</strong>
            <span>Inventory management portal</span>
          </div>
        </div>

        <div className="panel-header">
          <p className="eyebrow">Welcome back</p>
          <h1>Sign in to your workspace</h1>
          <p className="lead">
            Choose a demo role or enter your assigned account to continue.
          </p>
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
              type={showPassword ? "text" : "password"}
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

          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={showPassword}
              onChange={(event) => setShowPassword(event.target.checked)}
            />
            Show password
          </label>

          {error ? <p className="form-error">{error}</p> : null}

          <button type="submit" className="primary-action-button" disabled={isSubmitting}>
            {isSubmitting ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </section>

      <aside className="auth-panel auth-panel-brand">
        <div className="demo-users">
          <p className="eyebrow">Demo access</p>
          <h2>Try any workflow</h2>
          <p className="lead">
            Pick a role to fill the sign-in form automatically.
          </p>
          <ul>
            {demoAccounts.map((account) => (
              <li key={account.email}>
                <button
                  type="button"
                  className={
                    account.email === formValues.email
                      ? "demo-account active"
                      : "demo-account"
                  }
                  onClick={() => useDemoAccount(account.email)}
                >
                  <strong>{account.role}</strong>
                  <span>{account.email}</span>
                </button>
              </li>
            ))}
          </ul>
          <p className="demo-footnote">Default password is filled automatically.</p>
        </div>

        <div className="module-list">
          <div>
            <span>Requests</span>
            <strong>Create and track requisitions</strong>
          </div>
          <div>
            <span>Approvals</span>
            <strong>Review decisions by role</strong>
          </div>
          <div>
            <span>Operations</span>
            <strong>Inventory, procurement, GRN, finance</strong>
          </div>
        </div>
      </aside>
    </main>
  );
}
