import React, { createContext, useContext, useEffect, useState } from "react";
import { authService } from "../services/authService";
import { userService } from "../services/userService";

const AuthContext = createContext(null);

const getErrorMessage = (err) =>
  err?.response?.data?.message || err?.message || "Something went wrong";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const data = await authService.getMe();
        if (alive) setUser(data.user);
      } catch {
        if (alive) setUser(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const login = async (credentials) => {
    try {
      setError(null);
      const data = await authService.login(credentials);
      setUser(data.user);
      return data;
    } catch (err) {
      const msg = getErrorMessage(err);
      setError(msg);
      throw err;
    }
  };

  const signup = async (credentials) => {
    try {
      setError(null);
      const data = await authService.signup(credentials);
      setUser(data.user);
      return data;
    } catch (err) {
      const msg = getErrorMessage(err);
      setError(msg);
      throw err;
    }
  };

  const logout = async () => {
    try {
      setError(null);
      await authService.logout();
    } finally {
      setUser(null);
    }
  };

  const updateProfile = async ({ name, avatar }) => {
    try {
      setError(null);
      const data = await userService.updateMe({ name, avatar });
      setUser(data.user);
      return data.user;
    } catch (err) {
      const msg = getErrorMessage(err);
      setError(msg);
      throw err;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        setError,
        login,
        signup,
        logout,
        updateProfile,
        isAuthenticated: Boolean(user),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
