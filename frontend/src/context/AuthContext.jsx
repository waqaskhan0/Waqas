import { createContext, useContext, useEffect, useState } from "react";
import { apiClient } from "../api/client.js";

const TOKEN_STORAGE_KEY = "ims.auth.token";

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
    const response = await apiClient.login(credentials);
    localStorage.setItem(TOKEN_STORAGE_KEY, response.token);
    setToken(response.token);
    setUser(response.user);
    setIsLoading(false);
  }

  async function signOut() {
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
