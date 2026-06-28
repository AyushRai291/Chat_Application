import React, { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { useChat } from "../../context/ChatContext";
import { userService } from "../../services/userService";
import Avatar from "../ui/Avatar";
import Spinner from "../ui/Spinner";

const getId = (value) => String(value?._id || value || "");

export default function GroupCreateModal({ onClose }) {
  const { user: currentUser } = useAuth();
  const { createGroupConversation } = useChat();

  const [groupName, setGroupName] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const debounceRef = useRef(null);

  const selectedIds = useMemo(
    () => new Set(selectedUsers.map((item) => getId(item))),
    [selectedUsers],
  );

  const visibleResults = useMemo(() => {
    const currentUserId = getId(currentUser);

    return results.filter((item) => {
      const id = getId(item);
      return id && id !== currentUserId && !selectedIds.has(id);
    });
  }, [currentUser, results, selectedIds]);

  const canCreate = groupName.trim().length >= 2 && selectedUsers.length > 0;

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const searchUsers = (value) => {
    const clean = value.trim();

    setQuery(value);
    setError("");

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!clean) {
      setResults([]);
      setLoading(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      setError("");

      try {
        const users = await userService.searchUsers(clean);
        setResults(users);
      } catch (err) {
        setError(err?.response?.data?.message || "Search failed.");
      } finally {
        setLoading(false);
      }
    }, 350);
  };

  const addUser = (nextUser) => {
    const id = getId(nextUser);
    if (!id || selectedIds.has(id)) return;

    setSelectedUsers((prev) => [...prev, nextUser]);
    setError("");
  };

  const removeUser = (userId) => {
    const id = getId(userId);
    setSelectedUsers((prev) => prev.filter((item) => getId(item) !== id));
  };

  const handleCreate = async () => {
    if (!canCreate || creating) return;

    setCreating(true);
    setError("");

    try {
      const conversation = await createGroupConversation({
        groupName: groupName.trim(),
        participantIds: selectedUsers.map((item) => getId(item)),
      });

      if (conversation?._id) {
        onClose?.();
      }
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to create group.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div style={s.overlay} role="dialog" aria-modal="true" aria-label="Create group">
      <div style={s.panel}>
        <div style={s.header}>
          <span style={s.title}>Create Group</span>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={s.closeBtn}
            disabled={creating}
          >
            ✕
          </button>
        </div>

        <div style={s.body}>
          <label style={s.label}>
            Group name
            <input
              autoFocus
              placeholder="Example: Project Team"
              value={groupName}
              onChange={(event) => {
                setGroupName(event.target.value);
                setError("");
              }}
              maxLength={80}
              aria-label="Group name"
              style={s.input}
            />
          </label>

          <label style={s.label}>
            Add members
            <input
              placeholder="Search by name or email…"
              value={query}
              onChange={(event) => searchUsers(event.target.value)}
              aria-label="Search users"
              style={s.input}
            />
          </label>

          {selectedUsers.length > 0 && (
            <div style={s.selectedBox} aria-label="Selected members">
              {selectedUsers.map((item) => (
                <button
                  key={item._id}
                  type="button"
                  style={s.chip}
                  onClick={() => removeUser(item._id)}
                  disabled={creating}
                  title="Remove member"
                >
                  <span style={s.chipText}>{item.name || item.email}</span>
                  <span aria-hidden="true">×</span>
                </button>
              ))}
            </div>
          )}

          <div style={s.results}>
            {loading && (
              <div style={s.center}>
                <Spinner size={20} />
              </div>
            )}

            {error && <p style={s.errText}>{error}</p>}

            {!loading && !error && query.trim() && visibleResults.length === 0 && (
              <p style={s.muted}>No users found for &quot;{query}&quot;</p>
            )}

            {!loading &&
              visibleResults.map((item) => (
                <button
                  key={item._id}
                  type="button"
                  onClick={() => addUser(item)}
                  disabled={creating}
                  style={s.userRow}
                  aria-label={`Add ${item.name || item.email} to group`}
                  onMouseEnter={(event) => {
                    if (!creating) {
                      event.currentTarget.style.background = "var(--bg-hover)";
                    }
                  }}
                  onMouseLeave={(event) => {
                    event.currentTarget.style.background = "transparent";
                  }}
                >
                  <Avatar
                    name={item.name || item.email}
                    src={item.avatar}
                    size="sm"
                    online={item.isOnline}
                  />

                  <div style={s.userInfo}>
                    <p style={s.userName}>{item.name || "Unknown"}</p>
                    <p style={s.userEmail}>{item.email}</p>
                  </div>

                  <span style={s.addText}>Add</span>
                </button>
              ))}
          </div>
        </div>

        <div style={s.footer}>
          <button
            type="button"
            style={s.cancelBtn}
            onClick={onClose}
            disabled={creating}
          >
            Cancel
          </button>

          <button
            type="button"
            style={{
              ...s.createBtn,
              opacity: canCreate && !creating ? 1 : 0.55,
              cursor: canCreate && !creating ? "pointer" : "not-allowed",
            }}
            onClick={handleCreate}
            disabled={!canCreate || creating}
          >
            {creating ? <Spinner size={14} /> : "Create group"}
          </button>
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
    zIndex: 210,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "20px",
  },
  panel: {
    width: "100%",
    maxWidth: "460px",
    background: "var(--bg-surface)",
    border: "1px solid var(--border-default)",
    borderRadius: "var(--radius-xl)",
    boxShadow: "var(--shadow-lg)",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    maxHeight: "84vh",
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
  body: {
    padding: "14px 16px 4px",
    overflowY: "auto",
  },
  label: {
    display: "flex",
    flexDirection: "column",
    gap: "7px",
    marginBottom: "12px",
    fontSize: "0.78rem",
    fontWeight: 700,
    color: "var(--text-secondary)",
  },
  input: {
    padding: "10px 14px",
    background: "var(--bg-elevated)",
    border: "1px solid var(--border-default)",
    borderRadius: "var(--radius-md)",
    color: "var(--text-primary)",
    fontSize: "0.875rem",
    outline: "none",
    fontFamily: "var(--font-sans)",
  },
  selectedBox: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
    margin: "4px 0 12px",
  },
  chip: {
    maxWidth: "100%",
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    padding: "7px 10px",
    borderRadius: "999px",
    border: "1px solid var(--border-default)",
    background: "var(--bg-overlay)",
    color: "var(--text-primary)",
    cursor: "pointer",
    fontSize: "0.78rem",
  },
  chipText: {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    maxWidth: "180px",
  },
  results: {
    minHeight: 100,
    maxHeight: 260,
    overflowY: "auto",
    paddingBottom: "8px",
  },
  center: {
    display: "flex",
    justifyContent: "center",
    padding: "24px",
  },
  errText: {
    fontSize: "0.82rem",
    color: "var(--status-error)",
    padding: "8px 4px",
  },
  muted: {
    fontSize: "0.82rem",
    color: "var(--text-muted)",
    padding: "8px 4px",
    textAlign: "center",
  },
  userRow: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    width: "100%",
    padding: "10px 8px",
    background: "transparent",
    border: "none",
    borderRadius: "var(--radius-md)",
    textAlign: "left",
    transition: "background 0.12s",
    cursor: "pointer",
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
  addText: {
    fontSize: "0.78rem",
    fontWeight: 700,
    color: "var(--accent-primary)",
  },
  footer: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "10px",
    padding: "14px 16px 16px",
    borderTop: "1px solid var(--border-subtle)",
  },
  cancelBtn: {
    border: "1px solid var(--border-default)",
    background: "var(--bg-overlay)",
    color: "var(--text-secondary)",
    borderRadius: "var(--radius-md)",
    padding: "9px 13px",
    cursor: "pointer",
    fontWeight: 700,
  },
  createBtn: {
    border: "1px solid var(--accent-primary)",
    background: "var(--accent-primary)",
    color: "white",
    borderRadius: "var(--radius-md)",
    padding: "9px 14px",
    cursor: "pointer",
    fontWeight: 800,
    minWidth: "116px",
    display: "inline-flex",
    justifyContent: "center",
    alignItems: "center",
  },
};