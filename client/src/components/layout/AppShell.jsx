import React, { useState } from "react";
import Sidebar from "./Sidebar";
import ChatPanel from "./ChatPanel";
import InfoPanel from "./InfoPanel";
import { useChat } from "../../context/ChatContext";

const shellStyle = `
.aurora-shell {
  display: flex;
  height: 100%;
  overflow: hidden;
  position: relative;
}

.aurora-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.aurora-content {
  flex: 1;
  display: flex;
  overflow: hidden;
}

@media (max-width: 768px) {
  .aurora-sidebar {
    position: fixed;
    left: 0;
    top: 0;
    bottom: 0;
    z-index: 100;
    transform: translateX(-100%);
    transition: transform 0.25s cubic-bezier(.4,0,.2,1);
    width: 85vw !important;
    max-width: 300px;
  }

  .aurora-sidebar > aside {
    width: 100% !important;
  }

  .aurora-sidebar.open {
    transform: translateX(0);
    box-shadow: var(--shadow-lg);
  }

  .aurora-info {
    position: fixed;
    right: 0;
    top: 0;
    bottom: 0;
    z-index: 100;
    transform: translateX(100%);
    transition: transform 0.25s cubic-bezier(.4,0,.2,1);
    width: 85vw !important;
    max-width: 280px;
  }

  .aurora-info > aside {
    width: 100% !important;
  }

  .aurora-info.open {
    transform: translateX(0);
    box-shadow: var(--shadow-lg);
  }

  .aurora-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.5);
    z-index: 99;
  }

  .aurora-mobile-bar {
    display: flex !important;
  }
}
`;

export default function AppShell() {
  const { selectedConversation } = useChat();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [infoPanelOpen, setInfoPanelOpen] = useState(false);

  const closePanels = () => {
    setSidebarOpen(false);
    setInfoPanelOpen(false);
  };

  return (
    <>
      <style>{shellStyle}</style>

      <div className="aurora-shell">
        {(sidebarOpen || infoPanelOpen) && (
          <div
            className="aurora-overlay"
            onClick={closePanels}
            aria-hidden="true"
          />
        )}

        <div className={`aurora-sidebar${sidebarOpen ? " open" : ""}`}>
          <Sidebar />
        </div>

        <div className="aurora-main">
          <MobileTopBar onMenuClick={() => setSidebarOpen(true)} />

          <div className="aurora-content">
            <ChatPanel
              onInfoToggle={() => setInfoPanelOpen((prev) => !prev)}
              showInfoPanel={infoPanelOpen}
            />

            {infoPanelOpen && selectedConversation && (
              <div className="aurora-info open">
                <InfoPanel onClose={() => setInfoPanelOpen(false)} />
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function MobileTopBar({ onMenuClick }) {
  return (
    <div
      className="aurora-mobile-bar"
      style={{
        display: "none",
        alignItems: "center",
        gap: 12,
        padding: "10px 16px",
        background: "var(--bg-surface)",
        borderBottom: "1px solid var(--border-subtle)",
        flexShrink: 0,
      }}
    >
      <button
        type="button"
        onClick={onMenuClick}
        aria-label="Open sidebar"
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "var(--text-secondary)",
          fontSize: "1.2rem",
          lineHeight: 1,
          padding: "4px",
        }}
      >
        ☰
      </button>

      <span
        style={{
          fontWeight: 700,
          fontSize: "1rem",
          background: "var(--accent-gradient)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
        }}
      >
        AURORA
      </span>
    </div>
  );
}