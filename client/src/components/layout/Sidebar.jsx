import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { useChat } from "../../context/ChatContext";
import Avatar from "../ui/Avatar";
import Spinner from "../ui/Spinner";
import ConversationItem, { getConvName } from "../chat/ConversationItem";
import UserSearch from "../users/UserSearch";
import ConfirmDialog from "../ui/ConfirmDialog";

const SearchIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.35-4.35" />
  </svg>
);

const getId = (value) => String(value?._id || value || "");

const getConversationSortTime = (conversation) => {
  const value =
    conversation?.updatedAt ||
    conversation?.lastMessage?.createdAt ||
    conversation?.createdAt;
  const time = value ? new Date(value).getTime() : 0;

  return Number.isNaN(time) ? 0 : time;
};

export default function Sidebar() {
  const { user, logout } = useAuth();

  const {
    conversations,
    selectedConversation,
    loadingConversations,
    loadConversations,
    selectConversation,
    createSavedConversation,
    error,
    socketConnected,
  } = useChat();

  const [query, setQuery] = useState("");
  const [showUserSearch, setShowUserSearch] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [openingSaved, setOpeningSaved] = useState(false);
  const [confirmLogoutOpen, setConfirmLogoutOpen] = useState(false);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  const filtered = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();

    return conversations
      .slice()
      .sort(
        (first, second) =>
          getConversationSortTime(second) - getConversationSortTime(first)
      )
      .filter((conversation) => {
        if (!cleanQuery) return true;

        const name = getConvName(conversation, user?._id).toLowerCase();
        return name.includes(cleanQuery);
      });
  }, [conversations, query, user?._id]);

  const handleSavedMessages = async () => {
    if (openingSaved) return;

    setOpeningSaved(true);

    try {
      await createSavedConversation();
    } finally {
      setOpeningSaved(false);
    }
  };

  const handleLogout = async () => {
    if (loggingOut) return;

    setLoggingOut(true);

    try {
      await logout();
      setConfirmLogoutOpen(false);
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <>
      {showUserSearch && (
        <UserSearch onClose={() => setShowUserSearch(false)} />
      )}

      <aside
        aria-label="Conversations sidebar"
        style={{
          width: "var(--sidebar-width)",
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          background: "var(--bg-surface)",
          borderRight: "1px solid var(--border-subtle)",
          height: "100%",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "20px 20px 16px",
            borderBottom: "1px solid var(--border-subtle)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: "var(--radius-md)",
                background: "var(--accent-gradient)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1rem",
                boxShadow: "var(--shadow-glow)",
              }}
            >
              ✦
            </div>

            <span
              style={{
                fontSize: "1.1rem",
                fontWeight: 700,
                letterSpacing: "-0.3px",
                background: "var(--accent-gradient)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              AURORA
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span
              title={
                socketConnected
                  ? "Realtime connected"
                  : "Realtime disconnected"
              }
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: socketConnected
                  ? "var(--status-online)"
                  : "var(--status-offline)",
                flexShrink: 0,
              }}
            />

            <button
              type="button"
              onClick={() => setShowUserSearch(true)}
              aria-label="New conversation"
              title="New conversation"
              style={{
                background: "var(--bg-overlay)",
                border: "1px solid var(--border-default)",
                borderRadius: "var(--radius-md)",
                width: 32,
                height: 32,
                cursor: "pointer",
                color: "var(--text-secondary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.1rem",
              }}
            >
              +
            </button>
          </div>
        </div>

        <div style={{ padding: "12px 16px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              background: "var(--bg-elevated)",
              border: "1px solid var(--border-default)",
              borderRadius: "var(--radius-md)",
              padding: "0 12px",
            }}
          >
            <span
              style={{
                color: "var(--text-muted)",
                display: "flex",
                alignItems: "center",
              }}
            >
              <SearchIcon />
            </span>

            <input
              placeholder="Filter conversations…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Filter conversations"
              style={{
                flex: 1,
                background: "transparent",
                border: "none",
                outline: "none",
                color: "var(--text-primary)",
                fontSize: "0.875rem",
                padding: "9px 0",
                fontFamily: "var(--font-sans)",
              }}
            />
          </div>
        </div>

        <div style={{ padding: "0 16px 8px" }}>
          <button
            type="button"
            onClick={handleSavedMessages}
            disabled={openingSaved}
            aria-label="Open Saved Messages"
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "8px 12px",
              borderRadius: "var(--radius-md)",
              background: "var(--bg-elevated)",
              border: "1px solid var(--border-default)",
              cursor: openingSaved ? "not-allowed" : "pointer",
              color: "var(--text-secondary)",
              fontSize: "0.83rem",
              fontWeight: 500,
              fontFamily: "var(--font-sans)",
              transition: "background 0.12s",
              opacity: openingSaved ? 0.65 : 1,
            }}
            onMouseEnter={(e) => {
              if (!openingSaved) {
                e.currentTarget.style.background = "var(--bg-hover)";
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "var(--bg-elevated)";
            }}
          >
            <span style={{ fontSize: "1rem" }}>🔖</span>
            <span style={{ flex: 1, textAlign: "left" }}>Saved Messages</span>
            {openingSaved && <Spinner size={14} />}
          </button>
        </div>

        <nav
          aria-label="Conversation list"
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "0 8px",
          }}
        >
          {error && (
            <p
              style={{
                fontSize: "0.78rem",
                color: "var(--status-error)",
                padding: "8px 12px",
              }}
            >
              {error}
            </p>
          )}

          {loadingConversations && (
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                padding: "32px",
              }}
            >
              <Spinner size={22} />
            </div>
          )}

          {!loadingConversations && filtered.length === 0 && (
            <div style={{ textAlign: "center", padding: "40px 16px" }}>
              <p style={{ fontSize: "1.5rem", marginBottom: "8px" }}>💬</p>

              <p style={{ fontSize: "0.83rem", color: "var(--text-muted)" }}>
                {query
                  ? `No conversations matching "${query}"`
                  : "No conversations yet. Start one!"}
              </p>
            </div>
          )}

          {!loadingConversations &&
            filtered.map((conversation) => (
              <ConversationItem
                key={conversation._id}
                conversation={conversation}
                isActive={
                  getId(selectedConversation) === getId(conversation)
                }
                onClick={() => selectConversation(conversation)}
                currentUserId={user?._id}
              />
            ))}
        </nav>

        <div
          style={{
            padding: "12px 16px",
            borderTop: "1px solid var(--border-subtle)",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            background: "var(--bg-surface)",
          }}
        >
          <Avatar
            name={user?.name || "User"}
            src={user?.avatar}
            size="sm"
            online={socketConnected}
          />

          <div style={{ flex: 1, minWidth: 0 }}>
            <p
              style={{
                fontSize: "0.85rem",
                fontWeight: 600,
                overflow: "hidden",
                whiteSpace: "nowrap",
                textOverflow: "ellipsis",
                color: "var(--text-primary)",
              }}
            >
              {user?.name || "User"}
            </p>

            <p
              style={{
                fontSize: "0.73rem",
                color: socketConnected
                  ? "var(--status-online)"
                  : "var(--text-muted)",
              }}
            >
              {socketConnected ? "● Online" : "○ Connecting…"}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setConfirmLogoutOpen(true)}
            disabled={loggingOut}
            aria-label="Logout"
            title="Logout"
            style={{
              background: "none",
              border: "1px solid transparent",
              borderRadius: "var(--radius-md)",
              cursor: loggingOut ? "not-allowed" : "pointer",
              color: "var(--text-muted)",
              fontSize: "1rem",
              padding: "5px 7px",
              opacity: loggingOut ? 0.5 : 1,
              transition: "color 0.12s, border-color 0.12s",
              lineHeight: 1,
            }}
            onMouseEnter={(e) => {
              if (!loggingOut) {
                e.currentTarget.style.color = "var(--status-error)";
                e.currentTarget.style.borderColor = "rgba(239,68,68,0.3)";
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "var(--text-muted)";
              e.currentTarget.style.borderColor = "transparent";
            }}
          >
            {loggingOut ? "…" : "⏻"}
          </button>
        </div>
      </aside>

      
      <ConfirmDialog
        open={confirmLogoutOpen}
        title="Log out?"
        description="You will be signed out from Aurora on this browser."
        confirmText="Log out"
        cancelText="Cancel"
        busy={loggingOut}
        danger={false}
        onCancel={() => {
          if (!loggingOut) setConfirmLogoutOpen(false);
        }}
        onConfirm={handleLogout}
      />
       
    </>
  );
}
