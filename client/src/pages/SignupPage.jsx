import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import Input from "../components/ui/Input";
import Spinner from "../components/ui/Spinner";

export default function SignupPage({ onSwitchToLogin }) {
  const { signup } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [localError, setLocalError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError("");

    if (!name.trim() || !email.trim() || !password.trim()) {
      setLocalError("Naam, email aur password sab required hain.");
      return;
    }

    if (password.length < 6) {
      setLocalError("Password kam se kam 6 characters ka hona chahiye.");
      return;
    }

    setLoading(true);

    try {
      await signup({
        name: name.trim(),
        email: email.trim(),
        password,
      });
    } catch (err) {
      setLocalError(
        err?.response?.data?.message || "Signup failed. Please try again."
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

        <h1 style={styles.heading}>Create account</h1>
        <p style={styles.sub}>Join Aurora and start chatting instantly</p>

        {localError && (
          <div style={styles.errorBox} role="alert">
            {localError}
          </div>
        )}

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.field}>
            <label style={styles.label} htmlFor="signup-name">
              Full Name
            </label>
            <Input
              id="signup-name"
              type="text"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              style={{ width: "100%" }}
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label} htmlFor="signup-email">
              Email
            </label>
            <Input
              id="signup-email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              style={{ width: "100%" }}
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label} htmlFor="signup-password">
              Password
            </label>
            <Input
              id="signup-password"
              type="password"
              placeholder="Min. 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              style={{ width: "100%" }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            aria-label="Create account"
            style={{
              ...styles.submitBtn,
              opacity: loading ? 0.7 : 1,
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? <Spinner size={18} color="#fff" /> : "Create Account"}
          </button>
        </form>

        <p style={styles.switchText}>
          Already have an account?{" "}
          <button
            type="button"
            onClick={onSwitchToLogin}
            style={styles.switchLink}
          >
            Sign in
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