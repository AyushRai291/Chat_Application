import React, { Suspense, lazy, useEffect, useMemo, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { useChat } from "../../context/ChatContext";
import Avatar from "../ui/Avatar";
import Spinner from "../ui/Spinner";
import ConversationItem, { getConvName } from "../chat/ConversationItem";
import { DialogSuspenseFallback } from "../ui/SuspenseFallback";

const UserSearch = lazy(() => import("../users/UserSearch"));
const GroupCreateModal = lazy(() => import("../users/GroupCreateModal"));
const ConfirmDialog = lazy(() => import("../ui/ConfirmDialog"));
const ProfileSettingsModal = lazy(() => import("../users/ProfileSettingsModal"));

const SearchIcon = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.35-4.35" />
  </svg>
);

const getId = (value) => String(value?._id || value || "");

const getConversationSortTime = (conversation) => {
  const value =
    conversation?.lastMessage?.createdAt ||
    conversation?.updatedAt ||
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
    unreadCountsByConversation,
    clearUnreadCount,
    error,
    socketConnected,
  } = useChat();

  const [query, setQuery] = useState("");
  const [showUserSearch, setShowUserSearch] = useState(false);
  const [showGroupCreate, setShowGroupCreate] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [openingSaved, setOpeningSaved] = useState(false);
  const [confirmLogoutOpen, setConfirmLogoutOpen] = useState(false);
  const [showProfileSettings, setShowProfileSettings] = useState(false);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  const filtered = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();

    return conversations
      .slice()
      .sort(
        (first, second) =>
          getConversationSortTime(second) - getConversationSortTime(first),
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

  const handleConversationClick = (conversation) => {
    clearUnreadCount(conversation._id);
    selectConversation(conversation);
  };

  return (
    <>
      {showUserSearch && (
        <Suspense fallback={<DialogSuspenseFallback />}>
          <UserSearch onClose={() => setShowUserSearch(false)} />
        </Suspense>
      )}

      {showGroupCreate && (
        <Suspense fallback={<DialogSuspenseFallback />}>
          <GroupCreateModal onClose={() => setShowGroupCreate(false)} />
        </Suspense>
      )}

      {showProfileSettings && (
        <Suspense fallback={<DialogSuspenseFallback />}>
          <ProfileSettingsModal onClose={() => setShowProfileSettings(false)} />
        </Suspense>
      )}

      <aside className="aurora-sidebar" aria-label="Conversations sidebar">
        <header className="aurora-sidebar__top">
          <div className="aurora-sidebar__brand-mark" aria-hidden="true">
            ✦
          </div>

          <div className="aurora-sidebar__brand">
            <span className="aurora-sidebar__brand-title">AURORA</span>

            <span className="aurora-sidebar__brand-sub">
              <span
                className="aurora-sidebar__dot"
                data-online={socketConnected ? "true" : undefined}
                aria-hidden="true"
              />
              {socketConnected ? "Realtime online" : "Connecting"}
            </span>
          </div>

          <button
            type="button"
            className="aurora-icon-btn"
            onClick={() => setShowUserSearch(true)}
            aria-label="New conversation"
            title="New conversation"
          >
            +
          </button>
        </header>

        <section className="aurora-sidebar__utility" aria-label="Chat tools">
          <label className="aurora-search">
            <SearchIcon />

            <input
              placeholder="Search conversations"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label="Search conversations"
            />
          </label>

          <button
            type="button"
            className="aurora-saved-card"
            onClick={handleSavedMessages}
            disabled={openingSaved}
            aria-label="Open Saved Messages"
          >
            <span aria-hidden="true">🔖</span>
            <span style={{ flex: 1, textAlign: "left" }}>Saved Messages</span>
            {openingSaved && <Spinner size={14} />}
          </button>

          <button
            type="button"
            className="aurora-saved-card"
            onClick={() => setShowGroupCreate(true)}
            aria-label="Create Group"
          >
            <span aria-hidden="true">👥</span>
            <span style={{ flex: 1, textAlign: "left" }}>Create Group</span>
            <span style={{ color: "var(--text-muted)", fontWeight: 800 }}>
              +
            </span>
          </button>
        </section>

        <nav className="aurora-sidebar__list" aria-label="Conversation list">
          {error && (
            <p className="aurora-sidebar__error" role="alert">
              {error}
            </p>
          )}

          {loadingConversations && (
            <div className="aurora-sidebar__loader">
              <Spinner size={22} />
            </div>
          )}

          {!loadingConversations && filtered.length === 0 && (
            <div className="aurora-sidebar__empty">
              <div className="aurora-sidebar__empty-icon" aria-hidden="true">
                <span>+</span>
              </div>

              <h2>
                {query ? "No matches found" : "No conversations yet"}
              </h2>

              <p>
                {query
                  ? `No conversations matching "${query}"`
                  : "Start with a new chat, group, or saved note."}
              </p>

              {!query && (
                <button
                  type="button"
                  className="aurora-sidebar__empty-btn"
                  onClick={() => setShowUserSearch(true)}
                >
                  Start a conversation
                </button>
              )}
            </div>
          )}

          {!loadingConversations &&
            filtered.map((conversation) => (
              <ConversationItem
                key={conversation._id}
                conversation={conversation}
                isActive={getId(selectedConversation) === getId(conversation)}
                onClick={() => handleConversationClick(conversation)}
                currentUserId={user?._id}
                unreadCount={
                  unreadCountsByConversation[getId(conversation)] || 0
                }
              />
            ))}
        </nav>

        <footer className="aurora-sidebar__profile">
          <button
            type="button"
            className="aurora-sidebar__profile-main"
            onClick={() => setShowProfileSettings(true)}
            aria-label="Open profile settings"
            title="Profile settings"
          >
            <Avatar
              name={user?.name || "User"}
              src={user?.avatar}
              size="sm"
              online={socketConnected}
            />

            <span className="aurora-sidebar__identity">
              <span className="aurora-sidebar__name">{user?.name || "User"}</span>

              <span
                className="aurora-sidebar__status"
                data-online={socketConnected ? "true" : undefined}
              >
                {socketConnected ? "● Online" : "○ Connecting"}
              </span>
            </span>
          </button>

          <button
            type="button"
            className="aurora-icon-btn"
            data-danger="true"
            onClick={() => setConfirmLogoutOpen(true)}
            disabled={loggingOut}
            aria-label="Logout"
            title="Logout"
          >
            {loggingOut ? "…" : "⏻"}
          </button>
        </footer>
      </aside>

      {confirmLogoutOpen && (
        <Suspense fallback={<DialogSuspenseFallback />}>
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
        </Suspense>
      )}
    </>
  );
}
