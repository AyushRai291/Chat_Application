import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import Input from "../components/ui/Input";
import Spinner from "../components/ui/Spinner";

export default function LoginPage({ onSwitchToSignup }) {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [localError, setLocalError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError("");

    if (!email.trim() || !password.trim()) {
      setLocalError("Email aur password dono required hain.");
      return;
    }

    setLoading(true);

    try {
      await login({
        email: email.trim(),
        password,
      });
    } catch (err) {
      setLocalError(
        err?.response?.data?.message || "Login failed. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.logoRow}>
          <div style={styles.logoIcon}>✦</div>
          <span style={styles.logoText}>AURORA</span>
        </div>

        <h1 style={styles.heading}>Welcome back</h1>
        <p style={styles.sub}>Sign in to continue your conversations</p>

        {localError && (
          <div style={styles.errorBox} role="alert">
            {localError}
          </div>
        )}

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.field}>
            <label style={styles.label} htmlFor="login-email">
              Email
            </label>
            <Input
              id="login-email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              style={{ width: "100%" }}
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label} htmlFor="login-password">
              Password
            </label>
            <Input
              id="login-password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              style={{ width: "100%" }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            aria-label="Sign in"
            style={{
              ...styles.submitBtn,
              opacity: loading ? 0.7 : 1,
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? <Spinner size={18} color="#fff" /> : "Sign In"}
          </button>
        </form>

        <p style={styles.switchText}>
          Don&apos;t have an account?{" "}
          <button
            type="button"
            onClick={onSwitchToSignup}
            style={styles.switchLink}
          >
            Create one
          </button>
        </p>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "var(--bg-base)",
    padding: "20px",
  },
  card: {
    width: "100%",
    maxWidth: "420px",
    background: "var(--bg-surface)",
    border: "1px solid var(--border-default)",
    borderRadius: "var(--radius-xl)",
    padding: "40px 36px",
    boxShadow: "var(--shadow-lg)",
  },
  logoRow: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    marginBottom: "28px",
  },
  logoIcon: {
    width: "36px",
    height: "36px",
    borderRadius: "var(--radius-md)",
    background: "var(--accent-gradient)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "1.1rem",
    boxShadow: "var(--shadow-glow)",
  },
  logoText: {
    fontSize: "1.2rem",
    fontWeight: 700,
    letterSpacing: "-0.3px",
    background: "var(--accent-gradient)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
  },
  heading: {
    fontSize: "1.5rem",
    fontWeight: 700,
    color: "var(--text-primary)",
    marginBottom: "6px",
    letterSpacing: "-0.3px",
  },
  sub: {
    fontSize: "0.875rem",
    color: "var(--text-muted)",
    marginBottom: "28px",
  },
  errorBox: {
    background: "rgba(239,68,68,0.1)",
    border: "1px solid rgba(239,68,68,0.3)",
    borderRadius: "var(--radius-md)",
    padding: "10px 14px",
    fontSize: "0.82rem",
    color: "var(--status-error)",
    marginBottom: "20px",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "18px",
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  label: {
    fontSize: "0.8rem",
    fontWeight: 600,
    color: "var(--text-secondary)",
    letterSpacing: "0.03em",
  },
  submitBtn: {
    marginTop: "6px",
    width: "100%",
    padding: "12px",
    background: "var(--accent-gradient)",
    border: "none",
    borderRadius: "var(--radius-md)",
    color: "#fff",
    fontSize: "0.95rem",
    fontWeight: 600,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    boxShadow: "0 2px 16px var(--accent-glow)",
    transition: "opacity 0.15s",
    fontFamily: "var(--font-sans)",
  },
  switchText: {
    marginTop: "24px",
    textAlign: "center",
    fontSize: "0.83rem",
    color: "var(--text-muted)",
  },
  switchLink: {
    background: "none",
    border: "none",
    color: "var(--accent-primary)",
    fontWeight: 600,
    cursor: "pointer",
    fontSize: "0.83rem",
    fontFamily: "var(--font-sans)",
    padding: 0,
  },
};