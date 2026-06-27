import React, { useEffect, useRef, useState } from "react";
import { userService } from "../../services/userService";
import { useChat } from "../../context/ChatContext";
import Avatar from "../ui/Avatar";
import Spinner from "../ui/Spinner";

export default function UserSearch({ onClose }) {
  const { createDirectConversation } = useChat();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [startingUserId, setStartingUserId] = useState(null);
  const [error, setError] = useState("");

  const debounceRef = useRef(null);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    setError("");

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!val.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      setError("");

      try {
        const users = await userService.searchUsers(val.trim());
        setResults(users);
      } catch (err) {
        setError(err?.response?.data?.message || "Search failed.");
      } finally {
        setLoading(false);
      }
    }, 350);
  };

  const handleStartChat = async (userId) => {
    if (startingUserId) return;

    setStartingUserId(userId);

    try {
      await createDirectConversation(userId);
      onClose?.();
    } finally {
      setStartingUserId(null);
    }
  };

  return (
    <div style={s.overlay} role="dialog" aria-modal="true" aria-label="Search users">
      <div style={s.panel}>
        <div style={s.header}>
          <span style={s.title}>New Conversation</span>
          <button type="button" onClick={onClose} aria-label="Close" style={s.closeBtn}>
            ✕
          </button>
        </div>

        <input
          autoFocus
          placeholder="Search by name or email…"
          value={query}
          onChange={handleChange}
          aria-label="Search users"
          style={s.input}
        />

        <div style={s.results}>
          {loading && (
            <div style={s.center}>
              <Spinner size={20} />
            </div>
          )}

          {error && <p style={s.errText}>{error}</p>}

          {!loading && !error && results.length === 0 && query.trim() && (
            <p style={s.muted}>No users found for &quot;{query}&quot;</p>
          )}

          {!loading &&
            results.map((user) => (
              <button
                key={user._id}
                type="button"
                onClick={() => handleStartChat(user._id)}
                disabled={Boolean(startingUserId)}
                style={{
                  ...s.userRow,
                  opacity: startingUserId === user._id ? 0.65 : 1,
                  cursor: startingUserId ? "not-allowed" : "pointer",
                }}
                aria-label={`Start chat with ${user.name || user.email}`}
                onMouseEnter={(e) => {
                  if (!startingUserId) {
                    e.currentTarget.style.background = "var(--bg-hover)";
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                }}
              >
                <Avatar
                  name={user.name || user.email}
                  src={user.avatar}
                  size="sm"
                  online={user.isOnline}
                />

                <div style={s.userInfo}>
                  <p style={s.userName}>{user.name || "Unknown"}</p>
                  <p style={s.userEmail}>{user.email}</p>
                </div>

                {startingUserId === user._id ? (
                  <Spinner size={14} />
                ) : user.isOnline ? (
                  <span style={s.onlineDot} aria-label="Online" />
                ) : null}
              </button>
            ))}
        </div>
      </div>
    </div>
  );
}

const s = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.6)",
    zIndex: 200,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "20px",
  },
  panel: {
    width: "100%",
    maxWidth: "420px",
    background: "var(--bg-surface)",
    border: "1px solid var(--border-default)",
    borderRadius: "var(--radius-xl)",
    boxShadow: "var(--shadow-lg)",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    maxHeight: "80vh",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "18px 20px 14px",
    borderBottom: "1px solid var(--border-subtle)",
  },
  title: {
    fontWeight: 700,
    fontSize: "0.95rem",
    color: "var(--text-primary)",
  },
  closeBtn: {
    background: "var(--bg-overlay)",
    border: "1px solid var(--border-default)",
    borderRadius: "var(--radius-sm)",
    width: 28,
    height: 28,
    cursor: "pointer",
    color: "var(--text-muted)",
    fontSize: "0.8rem",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    margin: "14px 16px",
    padding: "10px 14px",
    background: "var(--bg-elevated)",
    border: "1px solid var(--border-default)",
    borderRadius: "var(--radius-md)",
    color: "var(--text-primary)",
    fontSize: "0.875rem",
    outline: "none",
    fontFamily: "var(--font-sans)",
  },
  results: {
    flex: 1,
    overflowY: "auto",
    padding: "0 8px 12px",
  },
  center: {
    display: "flex",
    justifyContent: "center",
    padding: "24px",
  },
  errText: {
    fontSize: "0.82rem",
    color: "var(--status-error)",
    padding: "8px 12px",
  },
  muted: {
    fontSize: "0.82rem",
    color: "var(--text-muted)",
    padding: "8px 12px",
    textAlign: "center",
  },
  userRow: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    width: "100%",
    padding: "10px 12px",
    background: "transparent",
    border: "none",
    borderRadius: "var(--radius-md)",
    textAlign: "left",
    transition: "background 0.12s",
  },
  userInfo: {
    flex: 1,
    minWidth: 0,
  },
  userName: {
    fontSize: "0.875rem",
    fontWeight: 600,
    color: "var(--text-primary)",
    overflow: "hidden",
    whiteSpace: "nowrap",
    textOverflow: "ellipsis",
  },
  userEmail: {
    fontSize: "0.75rem",
    color: "var(--text-muted)",
    overflow: "hidden",
    whiteSpace: "nowrap",
    textOverflow: "ellipsis",
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: "var(--status-online)",
    flexShrink: 0,
  },
};