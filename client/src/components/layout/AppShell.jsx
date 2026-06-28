import React, { useEffect, useState } from "react";
import Sidebar from "./Sidebar";
import ChatPanel from "./ChatPanel";
import InfoPanel from "./InfoPanel";
import { useChat } from "../../context/ChatContext";

export default function AppShell() {
  const { selectedConversation } = useChat();

  const [mobileView, setMobileView] = useState(() => {
    if (typeof window === "undefined") return "sidebar";
    return window.matchMedia("(max-width: 768px)").matches
      ? "sidebar"
      : "chat";
  });

  const [infoPanelOpen, setInfoPanelOpen] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 768px)");

    const handleChange = () => {
      if (media.matches) {
        setMobileView(selectedConversation ? "chat" : "sidebar");
      } else {
        setMobileView("chat");
        setInfoPanelOpen(false);
      }
    };

    handleChange();
    media.addEventListener("change", handleChange);

    return () => media.removeEventListener("change", handleChange);
  }, [selectedConversation]);

  useEffect(() => {
    if (!selectedConversation) return;

    if (window.matchMedia("(max-width: 768px)").matches) {
      setMobileView("chat");
    }
  }, [selectedConversation]);

  const isMobileSidebar = mobileView === "sidebar";
  const isMobileChat = mobileView === "chat";

  return (
    <div className="aurora-shell">
        {infoPanelOpen && (
          <div
            className="aurora-overlay"
            onClick={() => setInfoPanelOpen(false)}
            aria-hidden="true"
          />
        )}

        <div
          className={`aurora-sidebar-wrap${
            isMobileSidebar ? " mobile-visible" : ""
          }`}
        >
          <Sidebar />
        </div>

        <div
          className={`aurora-main${isMobileChat ? " mobile-visible" : ""}`}
        >
          <MobileTopBar
            showBack={Boolean(selectedConversation)}
            onBack={() => {
              setInfoPanelOpen(false);
              setMobileView("sidebar");
            }}
          />

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
  );
}

function MobileTopBar({ showBack, onBack }) {
  return (
    <div className="aurora-mobile-bar">
      {showBack && (
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to conversations"
          className="aurora-mobile-back"
        >
          {"\u2190"}
        </button>
      )}

      <span className="aurora-mobile-title">AURORA</span>
    </div>
  );
}
