import { createContext, useContext, useEffect, useState } from "react";
import { apiClient } from "../api/client.js";

const TOKEN_STORAGE_KEY = "ims.auth.token";
const DEMO_USER_STORAGE_KEY = "ims.auth.demoUser";
const DEMO_TOKEN_PREFIX = "demo-session:";
const DEMO_PASSWORD = "Password123!";

const localDemoUsers = {
  "hr@ims.local": {
    id: "demo-hr",
    employeeCode: "HR-001",
    fullName: "Nadia HR",
    email: "hr@ims.local",
    role: "HR_OFFICER",
    department: "Human Resources",
    managerId: null
  },
  "admin@ims.local": {
    id: "demo-admin",
    employeeCode: "ADM-001",
    fullName: "Super Admin",
    email: "admin@ims.local",
    role: "SUPER_ADMIN",
    department: "IT / Management",
    managerId: null
  }
};

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_STORAGE_KEY));
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(Boolean(token));

  useEffect(() => {
    let ignore = false;

    async function bootstrap() {
      if (!token) {
        setIsLoading(false);
        setUser(null);
        return;
      }

      if (token.startsWith(DEMO_TOKEN_PREFIX)) {
        try {
          const storedUser = JSON.parse(localStorage.getItem(DEMO_USER_STORAGE_KEY) ?? "null");

          if (!ignore && storedUser) {
            setUser(storedUser);
          }
        } catch (_error) {
          if (!ignore) {
            localStorage.removeItem(TOKEN_STORAGE_KEY);
            localStorage.removeItem(DEMO_USER_STORAGE_KEY);
            setToken(null);
            setUser(null);
          }
        } finally {
          if (!ignore) {
            setIsLoading(false);
          }
        }

        return;
      }

      try {
        const response = await apiClient.getCurrentUser(token);
        if (!ignore) {
          setUser(response.user);
        }
      } catch (_error) {
        if (!ignore) {
          localStorage.removeItem(TOKEN_STORAGE_KEY);
          setToken(null);
          setUser(null);
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    bootstrap();

    return () => {
      ignore = true;
    };
  }, [token]);

  async function signIn(credentials) {
    const email = String(credentials.email ?? "").trim().toLowerCase();
    const localDemoUser = localDemoUsers[email];

    if (localDemoUser && credentials.password === DEMO_PASSWORD) {
      const demoToken = `${DEMO_TOKEN_PREFIX}${localDemoUser.role}:${Date.now()}`;
      localStorage.setItem(TOKEN_STORAGE_KEY, demoToken);
      localStorage.setItem(DEMO_USER_STORAGE_KEY, JSON.stringify(localDemoUser));
      setToken(demoToken);
      setUser(localDemoUser);
      setIsLoading(false);
      return;
    }

    const response = await apiClient.login(credentials);
    localStorage.setItem(TOKEN_STORAGE_KEY, response.token);
    localStorage.removeItem(DEMO_USER_STORAGE_KEY);
    setToken(response.token);
    setUser(response.user);
    setIsLoading(false);
  }

  async function signOut() {
    try {
      if (token && !token.startsWith(DEMO_TOKEN_PREFIX)) {
        await apiClient.logout(token);
      }
    } finally {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      localStorage.removeItem(DEMO_USER_STORAGE_KEY);
      setToken(null);
      setUser(null);
    }
  }

  const value = {
    token,
    user,
    isAuthenticated: Boolean(token && user),
    isLoading,
    signIn,
    signOut
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider.");
  }

  return context;
}
