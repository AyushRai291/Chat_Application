import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import axios from "axios";
import { connectSocket, disconnectSocket, getSocket } from "./lib/socket.js";

axios.defaults.baseURL = "http://localhost:5000";
axios.defaults.withCredentials = true;

const formatLastSeen = (lastSeen) => {
  if (!lastSeen) {
    return "active now";
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(lastSeen));
};

const getDisplayName = (user) => {
  return user?.name || user?.email || user?._id || "Unknown user";
};

function App() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [currentUser, setCurrentUser] = useState(null);
  const [userSearch, setUserSearch] = useState("");
  const [foundUsers, setFoundUsers] = useState([]);

  const [conversationId, setConversationId] = useState("");
  const [text, setText] = useState("");
  const [messages, setMessages] = useState([]);

  const [status, setStatus] = useState("Not connected");
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [presenceUpdates, setPresenceUpdates] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);

  const conversationIdRef = useRef("");
  const isTypingRef = useRef(false);
  const typingStopTimerRef = useRef(null);

  useEffect(() => {
    if (conversationIdRef.current && isTypingRef.current) {
      emitTypingStop(conversationIdRef.current);
    }

    conversationIdRef.current = conversationId.trim();
    setTypingUsers([]);
  }, [conversationId]);

  const emitTypingStart = (targetConversationId) => {
    const socket = getSocket();

    if (!socket?.connected || !targetConversationId || isTypingRef.current) {
      return;
    }

    socket.emit("typing:start", {
      conversationId: targetConversationId,
    });

    isTypingRef.current = true;
  };

  const emitTypingStop = (targetConversationId = conversationIdRef.current) => {
    const socket = getSocket();

    if (!socket?.connected || !targetConversationId || !isTypingRef.current) {
      return;
    }

    socket.emit("typing:stop", {
      conversationId: targetConversationId,
    });

    isTypingRef.current = false;
  };

  const scheduleTypingStop = () => {
    if (typingStopTimerRef.current) {
      clearTimeout(typingStopTimerRef.current);
    }

    typingStopTimerRef.current = setTimeout(() => {
      emitTypingStop();
    }, 1200);
  };

  // Login ke baad backend JWT ko httpOnly cookie me save karta hai.
  // Client JS cookie read nahi karega, browser automatically bhejega.
  const handleLogin = async (event) => {
    event.preventDefault();

    const { data } = await axios.post("/api/auth/login", {
      email,
      password,
    });

    setCurrentUser(data.user);
    setStatus(`Logged in as ${data.user.name}. Cookie saved.`);
  };

  // Testing ke liye self/saved conversation bana rahe hain.
  const handleCreateSavedConversation = async () => {
    const { data } = await axios.post("/api/conversations", {
      isSelf: true,
    });

    setConversationId(data.conversation._id);
    setMessages([]);
    setStatus("Saved conversation ready.");
  };

  const handleSearchUsers = async () => {
    const { data } = await axios.get("/api/users", {
      params: {
        search: userSearch,
      },
    });

    setFoundUsers(data.users);
    setStatus(`Found ${data.users.length} user(s).`);
  };

  const handleCreateDirectConversation = async (receiverId) => {
    const { data } = await axios.post("/api/conversations", {
      receiverId,
    });

    setConversationId(data.conversation._id);
    setMessages([]);
    setTypingUsers([]);
    setStatus("Direct conversation ready.");
  };

  // Socket connect karte waqt old listeners clear karna important hai.
  // Warna button baar baar click karne par duplicate events fire honge.
  const handleConnectSocket = () => {
    const socket = connectSocket();

    socket.off("connect");
    socket.off("connect_error");
    socket.off("pong:client");
    socket.off("message:new");
    socket.off("presence:online-users");
    socket.off("presence:update");
    socket.off("typing:start");
    socket.off("typing:stop");

    socket.on("connect", () => {
      setStatus(`Socket connected: ${socket.id}`);
    });

    socket.on("connect_error", (err) => {
      setStatus(`Socket error: ${err.message}`);
    });

    socket.on("pong:client", (data) => {
      setStatus(data.message);
    });

    socket.on("presence:online-users", (data) => {
      const users = Array.isArray(data.users)
        ? data.users
        : (data.userIds || []).map((userId) => ({ _id: userId }));

      setOnlineUsers(users);
    });

    socket.on("presence:update", (data) => {
      const fallbackUser = {
        _id: data.userId,
        isOnline: data.isOnline,
        lastSeen: data.lastSeen,
      };
      const user = data.user || fallbackUser;

      setPresenceUpdates((currentUpdates) =>
        [{ ...data, user }, ...currentUpdates].slice(0, 5)
      );

      setStatus(
        data.isOnline
          ? `${getDisplayName(user)} is online`
          : `${getDisplayName(user)} went offline`
      );
    });

    socket.on("typing:start", (data) => {
      if (data.conversationId !== conversationIdRef.current) {
        return;
      }

      setTypingUsers((currentUsers) => {
        const alreadyTyping = currentUsers.some(
          (user) => user._id === data.user._id
        );

        if (alreadyTyping) {
          return currentUsers;
        }

        return [...currentUsers, data.user];
      });
    });

    socket.on("typing:stop", (data) => {
      if (data.conversationId !== conversationIdRef.current) {
        return;
      }

      setTypingUsers((currentUsers) =>
        currentUsers.filter((user) => user._id !== data.user._id)
      );
    });

    socket.on("message:new", (data) => {
      // Sirf current conversation ke messages UI me add karenge.
      if (data.conversationId !== conversationIdRef.current) {
        return;
      }

      setMessages((currentMessages) => {
        // Duplicate guard: same message dobara aaye to repeat add nahi hoga.
        const alreadyExists = currentMessages.some(
          (message) => message._id === data.message._id
        );

        if (alreadyExists) {
          return currentMessages;
        }

        return [...currentMessages, data.message];
      });

      if (data.message.sender?._id) {
        setTypingUsers((currentUsers) =>
          currentUsers.filter((user) => user._id !== data.message.sender._id)
        );
      }

      setStatus("New message received.");
    });
  };

  const handlePing = () => {
    const socket = connectSocket();
    socket.emit("ping:server");
  };

  const handleSendMessage = async (event) => {
    event.preventDefault();

    if (!conversationId.trim() || !text.trim()) {
      setStatus("Conversation ID and message text are required.");
      return;
    }

    setStatus("Message sent. Waiting for socket event.");
    emitTypingStop();

    // HTTP request message ko DB me save karegi.
    // UI me message socket event se add hoga, direct response se nahi.
    await axios.post("/api/messages", {
      conversationId: conversationId.trim(),
      text: text.trim(),
    });

    setText("");
  };

  const handleTextChange = (event) => {
    const nextText = event.target.value;
    const targetConversationId = conversationIdRef.current;

    setText(nextText);

    if (!targetConversationId) {
      return;
    }

    if (!nextText.trim()) {
      emitTypingStop(targetConversationId);
      return;
    }

    emitTypingStart(targetConversationId);
    scheduleTypingStop();
  };

  const handleDisconnect = () => {
    emitTypingStop();

    if (typingStopTimerRef.current) {
      clearTimeout(typingStopTimerRef.current);
      typingStopTimerRef.current = null;
    }

    disconnectSocket();

    if (currentUser) {
      const lastSeen = new Date().toISOString();
      const offlineUser = {
        ...currentUser,
        isOnline: false,
        lastSeen,
      };

      setOnlineUsers((users) =>
        users.filter((user) => user._id !== currentUser._id)
      );
      setPresenceUpdates((currentUpdates) =>
        [
          {
            userId: currentUser._id,
            isOnline: false,
            lastSeen,
            user: offlineUser,
          },
          ...currentUpdates,
        ].slice(0, 5)
      );
    }

    setStatus("Socket disconnected");
    setTypingUsers([]);
  };

  return (
    <main style={{ maxWidth: 680, margin: "60px auto", fontFamily: "Arial" }}>
      <h1>Socket Test</h1>

      <form onSubmit={handleLogin}>
        <input
          style={{ display: "block", width: "100%", marginBottom: 12, padding: 10 }}
          placeholder="Email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />

        <input
          style={{ display: "block", width: "100%", marginBottom: 12, padding: 10 }}
          placeholder="Password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />

        <button type="submit">Login</button>
      </form>

      <div style={{ marginTop: 20, display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button onClick={handleCreateSavedConversation}>
          Create Saved Conversation
        </button>
        <button onClick={handleConnectSocket}>Connect Socket</button>
        <button onClick={handlePing}>Ping</button>
        <button onClick={handleDisconnect}>Disconnect</button>
      </div>

      <section style={{ marginTop: 20 }}>
        <h3>Users</h3>

        <input
          style={{ width: "70%", padding: 10 }}
          placeholder="Search users by name or email"
          value={userSearch}
          onChange={(event) => setUserSearch(event.target.value)}
        />

        <button
          onClick={handleSearchUsers}
          style={{ width: "30%", padding: 10 }}
        >
          Search
        </button>

        <ul>
          {foundUsers.map((user) => (
            <li key={user._id}>
              <strong>{getDisplayName(user)}</strong>
              {user.email ? ` - ${user.email}` : ""}
              {user.isOnline ? " - online" : ""}
              <button
                onClick={() => handleCreateDirectConversation(user._id)}
                style={{ marginLeft: 8 }}
              >
                Chat
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section style={{ marginTop: 20 }}>
        <h3>Presence</h3>
        <p>Online users: {onlineUsers.length}</p>

        <ul>
          {onlineUsers.map((user) => (
            <li key={user._id}>
              <strong>{getDisplayName(user)}</strong>
              {user.email ? ` - ${user.email}` : ""} - online
            </li>
          ))}
        </ul>

        <h4>Last presence updates</h4>

        <ul>
          {presenceUpdates.map((update, index) => (
            <li key={`${update.userId}-${index}`}>
              <strong>{getDisplayName(update.user)}</strong> -{" "}
              {update.isOnline
                ? "online"
                : `offline - last seen ${formatLastSeen(update.lastSeen)}`}
            </li>
          ))}
        </ul>
      </section>

      <input
        style={{ display: "block", width: "100%", marginTop: 20, padding: 10 }}
        placeholder="Conversation ID"
        value={conversationId}
        onChange={(event) => setConversationId(event.target.value)}
      />

      <form onSubmit={handleSendMessage} style={{ marginTop: 12 }}>
        <input
          style={{ width: "75%", padding: 10 }}
          placeholder="Type message"
          value={text}
          onChange={handleTextChange}
        />

        <button type="submit" style={{ width: "25%", padding: 10 }}>
          Send
        </button>
      </form>

      <p style={{ marginTop: 20 }}>{status}</p>

      {typingUsers.length > 0 && (
        <p>
          {typingUsers.map(getDisplayName).join(", ")}{" "}
          {typingUsers.length === 1 ? "is" : "are"} typing...
        </p>
      )}

      <ul>
        {messages.map((message) => (
          <li key={message._id}>{message.text}</li>
        ))}
      </ul>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
