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

const getId = (value) => {
  return value?._id || value?.toString?.() || value;
};

const getReceiptLabel = (message) => {
  if (message.status === "read") {
    return "Read";
  }

  if (message.status === "delivered") {
    return "Delivered";
  }

  return "Sent";
};

const reactionOptions = ["👍", "❤️", "😂"];

const getMessageText = (message) => {
  if (message.deletedForEveryone) {
    return "This message was deleted";
  }

  return message.text;
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
  const [replyTo, setReplyTo] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [editText, setEditText] = useState("");

  const [status, setStatus] = useState("Not connected");
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [presenceUpdates, setPresenceUpdates] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);

  const conversationIdRef = useRef("");
  const currentUserRef = useRef(null);
  const isTypingRef = useRef(false);
  const typingStopTimerRef = useRef(null);

  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

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

  const emitMessagesRead = (targetConversationId = conversationIdRef.current) => {
    const socket = getSocket();

    if (!socket?.connected || !targetConversationId) {
      return;
    }

    socket.emit("messages:read", {
      conversationId: targetConversationId,
    });
  };

  const applyReceiptUpdates = ({ receipts }) => {
    const receiptByMessageId = new Map(
      receipts.map((receipt) => [receipt.messageId, receipt])
    );

    setMessages((currentMessages) =>
      currentMessages.map((message) => {
        const receipt = receiptByMessageId.get(message._id);

        if (!receipt) {
          return message;
        }

        return {
          ...message,
          status: receipt.status || message.status,
          deliveredTo: receipt.deliveredTo || message.deliveredTo || [],
          readBy: receipt.readBy || message.readBy || [],
        };
      })
    );
  };

  const applyMessageUpdate = (updatedMessage) => {
    setMessages((currentMessages) =>
      currentMessages.map((message) =>
        message._id === updatedMessage._id ? updatedMessage : message
      )
    );
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
    setReplyTo(null);
    setEditingMessage(null);
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
    setReplyTo(null);
    setEditingMessage(null);
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
    socket.off("receipt:delivered");
    socket.off("receipt:read");
    socket.off("message:updated");
    socket.off("message:deleted-for-me");
    socket.off("message:deleted-for-everyone");
    socket.off("message:reaction-updated");

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

    socket.on("receipt:delivered", (data) => {
      if (data.conversationId !== conversationIdRef.current) {
        return;
      }

      applyReceiptUpdates(data);
      setStatus(`${getDisplayName(data.user)} received message(s).`);
    });

    socket.on("receipt:read", (data) => {
      if (data.conversationId !== conversationIdRef.current) {
        return;
      }

      applyReceiptUpdates(data);
      setStatus(`${getDisplayName(data.user)} read message(s).`);
    });

    socket.on("message:updated", (data) => {
      if (data.conversationId !== conversationIdRef.current) {
        return;
      }

      applyMessageUpdate(data.message);
      setStatus("Message edited.");
    });

    socket.on("message:deleted-for-me", (data) => {
      if (data.conversationId !== conversationIdRef.current) {
        return;
      }

      setMessages((currentMessages) =>
        currentMessages.filter((message) => message._id !== data.messageId)
      );
      setStatus("Message deleted for you.");
    });

    socket.on("message:deleted-for-everyone", (data) => {
      if (data.conversationId !== conversationIdRef.current) {
        return;
      }

      applyMessageUpdate(data.message);
      setStatus("Message deleted for everyone.");
    });

    socket.on("message:reaction-updated", (data) => {
      if (data.conversationId !== conversationIdRef.current) {
        return;
      }

      applyMessageUpdate(data.message);
      setStatus("Reaction updated.");
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

      const currentUserId = currentUserRef.current?._id;

      if (currentUserId && getId(data.message.sender) !== currentUserId) {
        emitMessagesRead(data.conversationId);
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
      replyTo: replyTo?._id,
    });

    setText("");
    setReplyTo(null);
  };

  const handleStartEdit = (message) => {
    setEditingMessage(message);
    setEditText(message.text || "");
    setReplyTo(null);
  };

  const handleSaveEdit = async (event) => {
    event.preventDefault();

    if (!editingMessage || !editText.trim()) {
      setStatus("Edit text is required.");
      return;
    }

    const { data } = await axios.patch(`/api/messages/${editingMessage._id}`, {
      text: editText.trim(),
    });

    applyMessageUpdate(data.message);
    setEditingMessage(null);
    setEditText("");
    setStatus("Edit saved. Waiting for socket event.");
  };

  const handleDeleteForMe = async (messageId) => {
    await axios.delete(`/api/messages/${messageId}/for-me`);
    setMessages((currentMessages) =>
      currentMessages.filter((message) => message._id !== messageId)
    );
    setStatus("Delete for me requested.");
  };

  const handleDeleteForEveryone = async (messageId) => {
    const { data } = await axios.delete(
      `/api/messages/${messageId}/for-everyone`
    );

    applyMessageUpdate(data.message);
    setStatus("Delete for everyone requested.");
  };

  const handleToggleReaction = async (messageId, emoji) => {
    const { data } = await axios.post(`/api/messages/${messageId}/reactions`, {
      emoji,
    });

    applyMessageUpdate(data.message);
    setStatus("Reaction sent. Waiting for socket event.");
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

      {replyTo && (
        <div style={{ marginTop: 12, padding: 8, border: "1px solid #aaa" }}>
          Replying to {getDisplayName(replyTo.sender)}: {getMessageText(replyTo)}
          <button onClick={() => setReplyTo(null)} style={{ marginLeft: 8 }}>
            Cancel
          </button>
        </div>
      )}

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

      {editingMessage && (
        <form onSubmit={handleSaveEdit} style={{ marginTop: 12 }}>
          <input
            style={{ width: "75%", padding: 10 }}
            placeholder="Edit message"
            value={editText}
            onChange={(event) => setEditText(event.target.value)}
          />

          <button type="submit" style={{ width: "12.5%", padding: 10 }}>
            Save
          </button>

          <button
            type="button"
            onClick={() => {
              setEditingMessage(null);
              setEditText("");
            }}
            style={{ width: "12.5%", padding: 10 }}
          >
            Cancel
          </button>
        </form>
      )}

      <button onClick={() => emitMessagesRead()} style={{ marginTop: 8 }}>
        Mark Conversation Read
      </button>

      <p style={{ marginTop: 20 }}>{status}</p>

      {typingUsers.length > 0 && (
        <p>
          {typingUsers.map(getDisplayName).join(", ")}{" "}
          {typingUsers.length === 1 ? "is" : "are"} typing...
        </p>
      )}

      <ul>
        {messages.map((message) => (
          <li key={message._id}>
            {message.replyTo && (
              <blockquote style={{ margin: "6px 0", color: "#555" }}>
                Reply to {getDisplayName(message.replyTo.sender)}:{" "}
                {message.replyTo.deletedForEveryone
                  ? "This message was deleted"
                  : message.replyTo.text}
              </blockquote>
            )}

            <div>
              {getMessageText(message)}
              {message.isEdited ? " (edited)" : ""}
            </div>

            <small>
              {getDisplayName(message.sender)} -{" "}
              {getId(message.sender) === currentUser?._id
                ? getReceiptLabel(message)
                : "Received"}
            </small>

            {message.reactions?.length > 0 && (
              <div>
                {message.reactions.map((reaction) => (
                  <span
                    key={`${message._id}-${getId(reaction.user)}`}
                    style={{ marginRight: 8 }}
                  >
                    {reaction.emoji} {getDisplayName(reaction.user)}
                  </span>
                ))}
              </div>
            )}

            <div style={{ marginTop: 6 }}>
              {!message.deletedForEveryone && (
                <button onClick={() => setReplyTo(message)}>Reply</button>
              )}

              {!message.deletedForEveryone &&
                reactionOptions.map((emoji) => (
                  <button
                    key={`${message._id}-${emoji}`}
                    onClick={() => handleToggleReaction(message._id, emoji)}
                    style={{ marginLeft: 4 }}
                  >
                    {emoji}
                  </button>
                ))}

              {getId(message.sender) === currentUser?._id &&
                !message.deletedForEveryone && (
                  <button
                    onClick={() => handleStartEdit(message)}
                    style={{ marginLeft: 4 }}
                  >
                    Edit
                  </button>
                )}

              <button
                onClick={() => handleDeleteForMe(message._id)}
                style={{ marginLeft: 4 }}
              >
                Delete Me
              </button>

              {getId(message.sender) === currentUser?._id &&
                !message.deletedForEveryone && (
                  <button
                    onClick={() => handleDeleteForEveryone(message._id)}
                    style={{ marginLeft: 4 }}
                  >
                    Delete Everyone
                  </button>
                )}
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
