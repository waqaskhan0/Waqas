import { createContext, useContext, useEffect, useState } from "react";
import { apiClient } from "../api/client.js";

const TOKEN_STORAGE_KEY = "ims.auth.token";
const DEVELOPMENT_LOGIN_BYPASS = true;
const DEVELOPMENT_TOKEN = "development-login-bypass";
const DEVELOPMENT_USER = {
  id: "development-user",
  fullName: "Development Admin",
  email: "dev@ims.local",
  role: "SUPER_ADMIN",
  department: "Development",
  employeeCode: "DEV-001",
  managerId: null,
  status: "ACTIVE",
  isDevelopmentBypass: true
};

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() =>
    DEVELOPMENT_LOGIN_BYPASS ? DEVELOPMENT_TOKEN : localStorage.getItem(TOKEN_STORAGE_KEY)
  );
  const [user, setUser] = useState(() =>
    DEVELOPMENT_LOGIN_BYPASS ? DEVELOPMENT_USER : null
  );
  const [isLoading, setIsLoading] = useState(() =>
    DEVELOPMENT_LOGIN_BYPASS ? false : Boolean(token)
  );

  useEffect(() => {
    if (DEVELOPMENT_LOGIN_BYPASS) {
      setToken(DEVELOPMENT_TOKEN);
      setUser(DEVELOPMENT_USER);
      setIsLoading(false);
      return undefined;
    }

    let ignore = false;

    async function bootstrap() {
      if (!token) {
        setIsLoading(false);
        setUser(null);
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
    if (DEVELOPMENT_LOGIN_BYPASS) {
      setToken(DEVELOPMENT_TOKEN);
      setUser(DEVELOPMENT_USER);
      setIsLoading(false);
      return;
    }

    const response = await apiClient.login(credentials);
    localStorage.setItem(TOKEN_STORAGE_KEY, response.token);
    setToken(response.token);
    setUser(response.user);
    setIsLoading(false);
  }

  async function signOut() {
    if (DEVELOPMENT_LOGIN_BYPASS) {
      setToken(DEVELOPMENT_TOKEN);
      setUser(DEVELOPMENT_USER);
      setIsLoading(false);
      return;
    }

    try {
      if (token) {
        await apiClient.logout(token);
      }
    } finally {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
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
