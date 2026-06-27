// import React, { useEffect, useRef, useState } from "react";
// import { createRoot } from "react-dom/client";
// import axios from "axios";
// import { connectSocket, disconnectSocket, getSocket } from "./lib/socket.js";

// axios.defaults.baseURL = "http://localhost:5000";
// axios.defaults.withCredentials = true;

// const formatLastSeen = (lastSeen) => {
//   if (!lastSeen) {
//     return "active now";
//   }

//   return new Intl.DateTimeFormat("en-IN", {
//     dateStyle: "medium",
//     timeStyle: "short",
//   }).format(new Date(lastSeen));
// };

// const getDisplayName = (user) => {
//   return user?.name || user?.email || user?._id || "Unknown user";
// };

// const getId = (value) => {
//   return value?._id || value?.toString?.() || value;
// };

// const getReceiptLabel = (message) => {
//   if (message.status === "read") {
//     return "Read";
//   }

//   if (message.status === "delivered") {
//     return "Delivered";
//   }

//   return "Sent";
// };

// const reactionOptions = ["👍", "❤️", "😂"];

// const getMessageText = (message) => {
//   if (message.deletedForEveryone) {
//     return "This message was deleted";
//   }

//   return message.text;
// };

// const getSearchPreview = (message) => {
//   const messageText = getMessageText(message);

//   if (messageText) {
//     return messageText;
//   }

//   const firstAttachment = message.attachments?.[0];

//   if (firstAttachment) {
//     return `Attachment: ${firstAttachment.fileName}`;
//   }

//   return "No preview";
// };

// const getNotificationBody = (notification) => {
//   return notification.body || notification.title || "New notification";
// };

// const getConversationTitle = (conversation, currentUserId) => {
//   if (!conversation) {
//     return "Unknown conversation";
//   }

//   if (conversation.isSelf) {
//     return "Saved Messages";
//   }

//   if (conversation.isGroup) {
//     return conversation.groupName || "Group";
//   }

//   const otherParticipant = conversation.participants?.find(
//     (participant) => getId(participant) !== currentUserId
//   );

//   return getDisplayName(otherParticipant || conversation.participants?.[0]);
// };

// const getAttachmentUrl = (attachment) => {
//   if (attachment.url.startsWith("http")) {
//     return attachment.url;
//   }

//   return `${axios.defaults.baseURL}${attachment.url}`;
// };

// const isImageAttachment = (attachment) => {
//   return attachment.fileType?.startsWith("image/");
// };

// const formatFileSize = (size = 0) => {
//   if (size < 1024) {
//     return `${size} B`;
//   }

//   if (size < 1024 * 1024) {
//     return `${(size / 1024).toFixed(1)} KB`;
//   }

//   return `${(size / (1024 * 1024)).toFixed(1)} MB`;
// };

// function App() {
//   const [email, setEmail] = useState("");
//   const [password, setPassword] = useState("");
//   const [currentUser, setCurrentUser] = useState(null);
//   const [userSearch, setUserSearch] = useState("");
//   const [foundUsers, setFoundUsers] = useState([]);
//   const [messageSearch, setMessageSearch] = useState("");
//   const [searchCurrentConversationOnly, setSearchCurrentConversationOnly] =
//     useState(true);
//   const [messageSearchResults, setMessageSearchResults] = useState([]);
//   const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
//   const [commandFilter, setCommandFilter] = useState("");
//   const [groupName, setGroupName] = useState("");
//   const [groupParticipantIds, setGroupParticipantIds] = useState("");
//   const [groupAddUserId, setGroupAddUserId] = useState("");
//   const [groupRename, setGroupRename] = useState("");

//   const [conversationId, setConversationId] = useState("");
//   const [currentConversation, setCurrentConversation] = useState(null);
//   const [text, setText] = useState("");
//   const [messages, setMessages] = useState([]);
//   const [replyTo, setReplyTo] = useState(null);
//   const [editingMessage, setEditingMessage] = useState(null);
//   const [editText, setEditText] = useState("");
//   const [selectedFiles, setSelectedFiles] = useState([]);
//   const [pendingAttachments, setPendingAttachments] = useState([]);
//   const [notifications, setNotifications] = useState([]);
//   const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);

//   const [status, setStatus] = useState("Not connected");
//   const [onlineUsers, setOnlineUsers] = useState([]);
//   const [presenceUpdates, setPresenceUpdates] = useState([]);
//   const [typingUsers, setTypingUsers] = useState([]);

//   const conversationIdRef = useRef("");
//   const currentUserRef = useRef(null);
//   const isTypingRef = useRef(false);
//   const typingStopTimerRef = useRef(null);
//   const fileInputRef = useRef(null);

//   useEffect(() => {
//     currentUserRef.current = currentUser;
//   }, [currentUser]);

//   useEffect(() => {
//     if (conversationIdRef.current && isTypingRef.current) {
//       emitTypingStop(conversationIdRef.current);
//     }

//     conversationIdRef.current = conversationId.trim();
//     setTypingUsers([]);
//   }, [conversationId]);

//   useEffect(() => {
//     const handleKeyDown = (event) => {
//       if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
//         event.preventDefault();
//         setCommandPaletteOpen(true);
//       }

//       if (event.key === "Escape") {
//         setCommandPaletteOpen(false);
//       }
//     };

//     window.addEventListener("keydown", handleKeyDown);

//     return () => {
//       window.removeEventListener("keydown", handleKeyDown);
//     };
//   }, []);

//   const emitTypingStart = (targetConversationId) => {
//     const socket = getSocket();

//     if (!socket?.connected || !targetConversationId || isTypingRef.current) {
//       return;
//     }

//     socket.emit("typing:start", {
//       conversationId: targetConversationId,
//     });

//     isTypingRef.current = true;
//   };

//   const emitTypingStop = (targetConversationId = conversationIdRef.current) => {
//     const socket = getSocket();

//     if (!socket?.connected || !targetConversationId || !isTypingRef.current) {
//       return;
//     }

//     socket.emit("typing:stop", {
//       conversationId: targetConversationId,
//     });

//     isTypingRef.current = false;
//   };

//   const scheduleTypingStop = () => {
//     if (typingStopTimerRef.current) {
//       clearTimeout(typingStopTimerRef.current);
//     }

//     typingStopTimerRef.current = setTimeout(() => {
//       emitTypingStop();
//     }, 1200);
//   };

//   const emitMessagesRead = (
//     targetConversationId = conversationIdRef.current,
//   ) => {
//     const socket = getSocket();

//     if (!socket?.connected || !targetConversationId) {
//       return;
//     }

//     socket.emit("messages:read", {
//       conversationId: targetConversationId,
//     });
//   };

//   const applyReceiptUpdates = ({ receipts }) => {
//     const receiptByMessageId = new Map(
//       receipts.map((receipt) => [receipt.messageId, receipt]),
//     );

//     setMessages((currentMessages) =>
//       currentMessages.map((message) => {
//         const receipt = receiptByMessageId.get(message._id);

//         if (!receipt) {
//           return message;
//         }

//         return {
//           ...message,
//           status: receipt.status || message.status,
//           deliveredTo: receipt.deliveredTo || message.deliveredTo || [],
//           readBy: receipt.readBy || message.readBy || [],
//         };
//       }),
//     );
//   };

//   const applyMessageUpdate = (updatedMessage) => {
//     setMessages((currentMessages) =>
//       currentMessages.map((message) =>
//         message._id === updatedMessage._id ? updatedMessage : message,
//       ),
//     );
//   };

//   const applyNotificationUpdate = (updatedNotification) => {
//     setNotifications((currentNotifications) =>
//       currentNotifications.map((notification) =>
//         notification._id === updatedNotification._id
//           ? updatedNotification
//           : notification,
//       ),
//     );
//   };

//   const handleLoadNotifications = async () => {
//     const { data } = await axios.get("/api/notifications", {
//       params: {
//         limit: 20,
//       },
//     });

//     setNotifications(data.notifications || []);
//     setUnreadNotificationCount(data.unreadCount || 0);
//     setStatus(`Loaded ${(data.notifications || []).length} notification(s).`);
//   };

//   const handleMarkNotificationRead = async (notificationId) => {
//     const { data } = await axios.patch(
//       `/api/notifications/${notificationId}/read`,
//     );

//     applyNotificationUpdate(data.notification);
//     setUnreadNotificationCount(data.unreadCount || 0);
//     setStatus("Notification marked as read.");

//     return data.notification;
//   };

//   const handleMarkAllNotificationsRead = async () => {
//     const { data } = await axios.patch("/api/notifications/read-all");

//     setNotifications((currentNotifications) =>
//       currentNotifications.map((notification) => ({
//         ...notification,
//         isRead: true,
//         readAt: notification.readAt || new Date().toISOString(),
//       })),
//     );
//     setUnreadNotificationCount(data.unreadCount || 0);
//     setStatus("All notifications marked as read.");
//   };

//   const handleOpenNotification = async (notification) => {
//     const nextNotification = notification.isRead
//       ? notification
//       : await handleMarkNotificationRead(notification._id);
//     const targetConversation = nextNotification?.conversation;
//     const targetConversationId = getId(targetConversation);

//     if (!targetConversationId) {
//       return;
//     }

//     setConversationId(targetConversationId);
//     setCurrentConversation(targetConversation);
//     setReplyTo(null);
//     setEditingMessage(null);
//     setTypingUsers([]);

//     await loadMessages(targetConversationId);

//     setStatus("Notification conversation opened.");
//   };

//   // Login ke baad backend JWT ko httpOnly cookie me save karta hai.
//   // Client JS cookie read nahi karega, browser automatically bhejega.

//   const loadMessages = async (
//     targetConversationId = conversationIdRef.current,
//   ) => {
//     const id = targetConversationId?.trim();

//     if (!id) return;

//     const { data } = await axios.get(`/api/messages/${id}`);

//     setMessages(data.messages || []);
//   };

//   const handleLogin = async (event) => {
//     event.preventDefault();

//     const { data } = await axios.post("/api/auth/login", {
//       email,
//       password,
//     });

//     setCurrentUser(data.user);
//     setStatus(`Logged in as ${data.user.name}. Cookie saved.`);
//   };

//   // Testing ke liye self/saved conversation bana rahe hain.
//   const handleCreateSavedConversation = async () => {
//     const { data } = await axios.post("/api/conversations", {
//       isSelf: true,
//     });

//     const id = data.conversation._id;

//     setConversationId(id);
//     setCurrentConversation(data.conversation);
//     setReplyTo(null);
//     setEditingMessage(null);
//     setSelectedFiles([]);
//     setPendingAttachments([]);
//     setTypingUsers([]);

//     await loadMessages(id);

//     setStatus("Saved conversation ready.");
//   };

//   const handleSearchUsers = async () => {
//     const { data } = await axios.get("/api/users", {
//       params: {
//         search: userSearch,
//       },
//     });

//     setFoundUsers(data.users);
//     setStatus(`Found ${data.users.length} user(s).`);
//   };

//   const handleSearchMessages = async () => {
//     if (messageSearch.trim().length < 2) {
//       setStatus("Message search must be at least 2 characters.");
//       return;
//     }

//     const params = {
//       search: messageSearch.trim(),
//     };

//     if (searchCurrentConversationOnly && conversationId.trim()) {
//       params.conversationId = conversationId.trim();
//     }

//     const { data } = await axios.get("/api/messages/search", {
//       params,
//     });

//     setMessageSearchResults(data.messages || []);
//     setStatus(
//       `Found ${(data.messages || []).length} message(s)${
//         data.pagination?.hasMore ? " (latest results shown)." : "."
//       }`,
//     );
//   };

//   const handleOpenSearchResult = async (message) => {
//     const targetConversation = message.conversation;
//     const targetConversationId = getId(targetConversation);

//     if (!targetConversationId) {
//       return;
//     }

//     setConversationId(targetConversationId);
//     setCurrentConversation(targetConversation);
//     setReplyTo(null);
//     setEditingMessage(null);
//     setTypingUsers([]);

//     await loadMessages(targetConversationId);

//     setStatus("Search result conversation opened.");
//   };

//   const handleCreateDirectConversation = async (receiverId) => {
//     const { data } = await axios.post("/api/conversations", {
//       receiverId,
//     });

//     const id = data.conversation._id;

//     setConversationId(id);
//     setCurrentConversation(data.conversation);
//     setTypingUsers([]);
//     setReplyTo(null);
//     setEditingMessage(null);
//     setSelectedFiles([]);
//     setPendingAttachments([]);

//     await loadMessages(id);

//     setStatus("Direct conversation ready.");
//   };

//   const handleCreateGroupConversation = async () => {
//     const participantIds = groupParticipantIds
//       .split(",")
//       .map((participantId) => participantId.trim())
//       .filter(Boolean);

//     const { data } = await axios.post("/api/conversations/groups", {
//       groupName,
//       participantIds,
//     });

//     const id = data.conversation._id;

//     setConversationId(id);
//     setCurrentConversation(data.conversation);
//     setMessages([]);
//     setTypingUsers([]);
//     setReplyTo(null);
//     setEditingMessage(null);
//     setGroupRename(data.conversation.groupName);

//     await loadMessages(id);

//     setStatus("Group conversation ready.");
//   };

//   const handleUpdateGroupConversation = async () => {
//     if (!currentConversation?._id) {
//       setStatus("Select a group first.");
//       return;
//     }

//     const { data } = await axios.patch(
//       `/api/conversations/${currentConversation._id}/group`,
//       {
//         groupName: groupRename,
//       }
//     );

//     setCurrentConversation(data.conversation);
//     setStatus("Group updated.");
//   };

//   const handleAddGroupParticipant = async () => {
//     if (!currentConversation?._id || !groupAddUserId.trim()) {
//       setStatus("Group and user ID are required.");
//       return;
//     }

//     const { data } = await axios.post(
//       `/api/conversations/${currentConversation._id}/participants`,
//       {
//         participantId: groupAddUserId.trim(),
//       }
//     );

//     setCurrentConversation(data.conversation);
//     setGroupAddUserId("");
//     setStatus("Participant added.");
//   };

//   const handleRemoveGroupParticipant = async (participantId) => {
//     if (!currentConversation?._id) {
//       return;
//     }

//     const { data } = await axios.delete(
//       `/api/conversations/${currentConversation._id}/participants/${participantId}`
//     );

//     setCurrentConversation(data.conversation);
//     setStatus("Participant removed.");
//   };

//   const handleLeaveGroupConversation = async () => {
//     if (!currentConversation?._id) {
//       return;
//     }

//     await axios.post(`/api/conversations/${currentConversation._id}/leave`);

//     setCurrentConversation(null);
//     setConversationId("");
//     setMessages([]);
//     setStatus("Left group.");
//   };

//   // Socket connect karte waqt old listeners clear karna important hai.
//   // Warna button baar baar click karne par duplicate events fire honge.
//   const handleConnectSocket = () => {
//     const socket = connectSocket();

//     socket.off("connect");
//     socket.off("connect_error");
//     socket.off("pong:client");
//     socket.off("message:new");
//     socket.off("presence:online-users");
//     socket.off("presence:update");
//     socket.off("typing:start");
//     socket.off("typing:stop");
//     socket.off("receipt:delivered");
//     socket.off("receipt:read");
//     socket.off("message:updated");
//     socket.off("message:deleted-for-me");
//     socket.off("message:deleted-for-everyone");
//     socket.off("message:reaction-updated");
//     socket.off("conversation:created");
//     socket.off("conversation:updated");
//     socket.off("notification:new");

//     socket.on("connect", () => {
//       setStatus(`Socket connected: ${socket.id}`);
//     });

//     socket.on("connect_error", (err) => {
//       setStatus(`Socket error: ${err.message}`);
//     });

//     socket.on("pong:client", (data) => {
//       setStatus(data.message);
//     });

//     socket.on("presence:online-users", (data) => {
//       const users = Array.isArray(data.users)
//         ? data.users
//         : (data.userIds || []).map((userId) => ({ _id: userId }));

//       setOnlineUsers(users);
//     });

//     socket.on("presence:update", (data) => {
//       const fallbackUser = {
//         _id: data.userId,
//         isOnline: data.isOnline,
//         lastSeen: data.lastSeen,
//       };
//       const user = data.user || fallbackUser;

//       setPresenceUpdates((currentUpdates) =>
//         [{ ...data, user }, ...currentUpdates].slice(0, 5),
//       );

//       setStatus(
//         data.isOnline
//           ? `${getDisplayName(user)} is online`
//           : `${getDisplayName(user)} went offline`,
//       );
//     });

//     socket.on("typing:start", (data) => {
//       if (data.conversationId !== conversationIdRef.current) {
//         return;
//       }

//       setTypingUsers((currentUsers) => {
//         const alreadyTyping = currentUsers.some(
//           (user) => user._id === data.user._id,
//         );

//         if (alreadyTyping) {
//           return currentUsers;
//         }

//         return [...currentUsers, data.user];
//       });
//     });

//     socket.on("typing:stop", (data) => {
//       if (data.conversationId !== conversationIdRef.current) {
//         return;
//       }

//       setTypingUsers((currentUsers) =>
//         currentUsers.filter((user) => user._id !== data.user._id),
//       );
//     });

//     socket.on("receipt:delivered", (data) => {
//       if (data.conversationId !== conversationIdRef.current) {
//         return;
//       }

//       applyReceiptUpdates(data);
//       setStatus(`${getDisplayName(data.user)} received message(s).`);
//     });

//     socket.on("receipt:read", (data) => {
//       if (data.conversationId !== conversationIdRef.current) {
//         return;
//       }

//       applyReceiptUpdates(data);
//       setStatus(`${getDisplayName(data.user)} read message(s).`);
//     });

//     socket.on("message:updated", (data) => {
//       if (data.conversationId !== conversationIdRef.current) {
//         return;
//       }

//       applyMessageUpdate(data.message);
//       setStatus("Message edited.");
//     });

//     socket.on("message:deleted-for-me", (data) => {
//       if (data.conversationId !== conversationIdRef.current) {
//         return;
//       }

//       setMessages((currentMessages) =>
//         currentMessages.filter((message) => message._id !== data.messageId),
//       );
//       setStatus("Message deleted for you.");
//     });

//     socket.on("message:deleted-for-everyone", (data) => {
//       if (data.conversationId !== conversationIdRef.current) {
//         return;
//       }

//       applyMessageUpdate(data.message);
//       setStatus("Message deleted for everyone.");
//     });

//     socket.on("message:reaction-updated", (data) => {
//       if (data.conversationId !== conversationIdRef.current) {
//         return;
//       }

//       applyMessageUpdate(data.message);
//       setStatus("Reaction updated.");
//     });

//     socket.on("conversation:created", (data) => {
//       if (data.conversation._id === conversationIdRef.current) {
//         setCurrentConversation(data.conversation);
//       }
//     });

//     socket.on("conversation:updated", (data) => {
//       if (data.conversation._id === conversationIdRef.current) {
//         setCurrentConversation(data.conversation);
//         setGroupRename(data.conversation.groupName || "");
//         setStatus("Conversation updated.");
//       }
//     });

//     socket.on("notification:new", (data) => {
//       const notification = data.notification;

//       if (!notification?._id) {
//         return;
//       }

//       setNotifications((currentNotifications) => [
//         notification,
//         ...currentNotifications.filter(
//           (currentNotification) =>
//             currentNotification._id !== notification._id,
//         ),
//       ].slice(0, 20));

//       if (!notification.isRead) {
//         setUnreadNotificationCount((currentCount) => currentCount + 1);
//       }

//       setStatus(notification.title || "New notification received.");
//     });

//     socket.on("message:new", (data) => {
//       // Sirf current conversation ke messages UI me add karenge.
//       if (data.conversationId !== conversationIdRef.current) {
//         return;
//       }

//       setMessages((currentMessages) => {
//         // Duplicate guard: same message dobara aaye to repeat add nahi hoga.
//         const alreadyExists = currentMessages.some(
//           (message) => message._id === data.message._id,
//         );

//         if (alreadyExists) {
//           return currentMessages;
//         }

//         return [...currentMessages, data.message];
//       });

//       if (data.message.sender?._id) {
//         setTypingUsers((currentUsers) =>
//           currentUsers.filter((user) => user._id !== data.message.sender._id),
//         );
//       }

//       const currentUserId = currentUserRef.current?._id;

//       if (currentUserId && getId(data.message.sender) !== currentUserId) {
//         emitMessagesRead(data.conversationId);
//       }

//       setStatus("New message received.");
//     });
//   };

//   const handlePing = () => {
//     const socket = connectSocket();
//     socket.emit("ping:server");
//   };

//   const handleSendMessage = async (event) => {
//     event.preventDefault();

//     if (
//       !conversationId.trim() ||
//       (!text.trim() && pendingAttachments.length === 0)
//     ) {
//       setStatus("Conversation ID and message text or attachment is required.");
//       return;
//     }

//     setStatus("Message sent. Waiting for socket event.");
//     emitTypingStop();

//     // HTTP request message ko DB me save karegi.
//     // UI me message socket event se add hoga, direct response se nahi.
//     await axios.post("/api/messages", {
//       conversationId: conversationId.trim(),
//       text: text.trim(),
//       attachments: pendingAttachments,
//       replyTo: replyTo?._id,
//     });

//     setText("");
//     setReplyTo(null);
//     setSelectedFiles([]);
//     setPendingAttachments([]);

//     if (fileInputRef.current) {
//       fileInputRef.current.value = "";
//     }
//   };

//   const handleFileSelection = (event) => {
//     const files = Array.from(event.target.files || []);

//     setSelectedFiles(files);

//     if (files.length > 5) {
//       setStatus("Maximum 5 files allowed.");
//       return;
//     }

//     if (files.length > 0) {
//       setStatus(`${files.length} file(s) selected.`);
//     }
//   };

//   const handleUploadFiles = async () => {
//     const files = selectedFiles;

//     if (!conversationId.trim()) {
//       setStatus("Conversation ID is required before upload.");
//       return;
//     }

//     if (files.length === 0) {
//       setStatus("Select at least one file first.");
//       return;
//     }

//     if (files.length > 5) {
//       setStatus("Maximum 5 files allowed.");
//       return;
//     }

//     const formData = new FormData();

//     formData.append("conversationId", conversationId.trim());
//     files.forEach((file) => {
//       formData.append("files", file);
//     });

//     try {
//       const { data } = await axios.post("/api/messages/upload", formData);

//       setPendingAttachments((currentAttachments) => [
//         ...currentAttachments,
//         ...data.attachments,
//       ]);
//       setSelectedFiles([]);

//       if (fileInputRef.current) {
//         fileInputRef.current.value = "";
//       }

//       setStatus(`${data.attachments.length} file(s) uploaded.`);
//     } catch (err) {
//       setStatus(err.response?.data?.message || "File upload failed.");
//     }
//   };

//   const handleRemovePendingAttachment = (publicId) => {
//     setPendingAttachments((currentAttachments) =>
//       currentAttachments.filter((attachment) => attachment.publicId !== publicId)
//     );
//   };

//   const handleStartEdit = (message) => {
//     setEditingMessage(message);
//     setEditText(message.text || "");
//     setReplyTo(null);
//   };

//   const handleSaveEdit = async (event) => {
//     event.preventDefault();

//     if (!editingMessage || !editText.trim()) {
//       setStatus("Edit text is required.");
//       return;
//     }

//     const { data } = await axios.patch(`/api/messages/${editingMessage._id}`, {
//       text: editText.trim(),
//     });

//     applyMessageUpdate(data.message);
//     setEditingMessage(null);
//     setEditText("");
//     setStatus("Edit saved. Waiting for socket event.");
//   };

//   const handleDeleteForMe = async (messageId) => {
//     await axios.delete(`/api/messages/${messageId}/for-me`);
//     setMessages((currentMessages) =>
//       currentMessages.filter((message) => message._id !== messageId),
//     );
//     setStatus("Delete for me requested.");
//   };

//   const handleDeleteForEveryone = async (messageId) => {
//     const { data } = await axios.delete(
//       `/api/messages/${messageId}/for-everyone`,
//     );

//     applyMessageUpdate(data.message);
//     setStatus("Delete for everyone requested.");
//   };

//   const handleToggleReaction = async (messageId, emoji) => {
//     const { data } = await axios.post(`/api/messages/${messageId}/reactions`, {
//       emoji,
//     });

//     applyMessageUpdate(data.message);
//     setStatus("Reaction sent. Waiting for socket event.");
//   };

//   const handleTextChange = (event) => {
//     const nextText = event.target.value;
//     const targetConversationId = conversationIdRef.current;

//     setText(nextText);

//     if (!targetConversationId) {
//       return;
//     }

//     if (!nextText.trim()) {
//       emitTypingStop(targetConversationId);
//       return;
//     }

//     emitTypingStart(targetConversationId);
//     scheduleTypingStop();
//   };

//   const handleDisconnect = () => {
//     emitTypingStop();

//     if (typingStopTimerRef.current) {
//       clearTimeout(typingStopTimerRef.current);
//       typingStopTimerRef.current = null;
//     }

//     disconnectSocket();

//     if (currentUser) {
//       const lastSeen = new Date().toISOString();
//       const offlineUser = {
//         ...currentUser,
//         isOnline: false,
//         lastSeen,
//       };

//       setOnlineUsers((users) =>
//         users.filter((user) => user._id !== currentUser._id),
//       );
//       setPresenceUpdates((currentUpdates) =>
//         [
//           {
//             userId: currentUser._id,
//             isOnline: false,
//             lastSeen,
//             user: offlineUser,
//           },
//           ...currentUpdates,
//         ].slice(0, 5),
//       );
//     }

//     setStatus("Socket disconnected");
//     setTypingUsers([]);
//   };

//   const commands = [
//     {
//       label: "Connect Socket",
//       action: handleConnectSocket,
//     },
//     {
//       label: "Create Saved Conversation",
//       action: handleCreateSavedConversation,
//     },
//     {
//       label: "Search Users",
//       action: handleSearchUsers,
//     },
//     {
//       label: "Search Messages",
//       action: handleSearchMessages,
//     },
//     {
//       label: "Mark Conversation Read",
//       action: () => emitMessagesRead(),
//     },
//     {
//       label: "Load Notifications",
//       action: handleLoadNotifications,
//     },
//     {
//       label: "Mark All Notifications Read",
//       action: handleMarkAllNotificationsRead,
//     },
//     {
//       label: "Create Group",
//       action: handleCreateGroupConversation,
//     },
//     {
//       label: "Disconnect Socket",
//       action: handleDisconnect,
//     },
//   ];

//   const filteredCommands = commands.filter((command) =>
//     command.label.toLowerCase().includes(commandFilter.trim().toLowerCase())
//   );

//   const handleRunCommand = async (command) => {
//     await command.action();
//     setCommandFilter("");
//     setCommandPaletteOpen(false);
//   };

//   return (
//     <main style={{ maxWidth: 680, margin: "60px auto", fontFamily: "Arial" }}>
//       <h1>Socket Test</h1>

//       <button onClick={() => setCommandPaletteOpen(true)}>
//         Command Palette
//       </button>

//       {commandPaletteOpen && (
//         <section style={{ marginTop: 12, border: "1px solid #333", padding: 10 }}>
//           <input
//             autoFocus
//             style={{ display: "block", width: "100%", padding: 10 }}
//             placeholder="Type a command..."
//             value={commandFilter}
//             onChange={(event) => setCommandFilter(event.target.value)}
//           />

//           <ul>
//             {filteredCommands.map((command) => (
//               <li key={command.label}>
//                 <button onClick={() => handleRunCommand(command)}>
//                   {command.label}
//                 </button>
//               </li>
//             ))}
//           </ul>

//           <button onClick={() => setCommandPaletteOpen(false)}>Close</button>
//         </section>
//       )}

//       <form onSubmit={handleLogin}>
//         <input
//           style={{
//             display: "block",
//             width: "100%",
//             marginBottom: 12,
//             padding: 10,
//           }}
//           placeholder="Email"
//           value={email}
//           onChange={(event) => setEmail(event.target.value)}
//         />

//         <input
//           style={{
//             display: "block",
//             width: "100%",
//             marginBottom: 12,
//             padding: 10,
//           }}
//           placeholder="Password"
//           type="password"
//           value={password}
//           onChange={(event) => setPassword(event.target.value)}
//         />

//         <button type="submit">Login</button>
//       </form>

//       <div style={{ marginTop: 20, display: "flex", gap: 8, flexWrap: "wrap" }}>
//         <button onClick={handleCreateSavedConversation}>
//           Create Saved Conversation
//         </button>
//         <button onClick={handleConnectSocket}>Connect Socket</button>
//         <button onClick={handlePing}>Ping</button>
//         <button onClick={handleDisconnect}>Disconnect</button>
//       </div>

//       <section style={{ marginTop: 20 }}>
//         <h3>Users</h3>

//         <input
//           style={{ width: "70%", padding: 10 }}
//           placeholder="Search users by name or email"
//           value={userSearch}
//           onChange={(event) => setUserSearch(event.target.value)}
//         />

//         <button
//           onClick={handleSearchUsers}
//           style={{ width: "30%", padding: 10 }}
//         >
//           Search
//         </button>

//         <ul>
//           {foundUsers.map((user) => (
//             <li key={user._id}>
//               <strong>{getDisplayName(user)}</strong>
//               {user.email ? ` - ${user.email}` : ""}
//               <span> - ID: {user._id}</span>
//               {user.isOnline ? " - online" : ""}
//               <button
//                 onClick={() => handleCreateDirectConversation(user._id)}
//                 style={{ marginLeft: 8 }}
//               >
//                 Chat
//               </button>
//             </li>
//           ))}
//         </ul>
//       </section>

//       <section style={{ marginTop: 20 }}>
//         <h3>Message Search</h3>

//         <input
//           style={{ width: "70%", padding: 10 }}
//           placeholder="Search messages"
//           value={messageSearch}
//           onChange={(event) => setMessageSearch(event.target.value)}
//         />

//         <button
//           onClick={handleSearchMessages}
//           style={{ width: "30%", padding: 10 }}
//         >
//           Search Messages
//         </button>

//         <label style={{ display: "block", marginTop: 8 }}>
//           <input
//             checked={searchCurrentConversationOnly}
//             onChange={(event) =>
//               setSearchCurrentConversationOnly(event.target.checked)
//             }
//             type="checkbox"
//           />
//           Current conversation only
//         </label>

//         <ul>
//           {messageSearchResults.map((message) => (
//             <li key={message._id}>
//               <strong>
//                 {getConversationTitle(message.conversation, currentUser?._id)}
//               </strong>
//               : {getSearchPreview(message)}
//               <button
//                 onClick={() => handleOpenSearchResult(message)}
//                 style={{ marginLeft: 8 }}
//               >
//                 Open
//               </button>
//             </li>
//           ))}
//         </ul>
//       </section>

//       <section style={{ marginTop: 20 }}>
//         <h3>Groups</h3>

//         <input
//           style={{ display: "block", width: "100%", marginBottom: 8, padding: 10 }}
//           placeholder="Group name"
//           value={groupName}
//           onChange={(event) => setGroupName(event.target.value)}
//         />

//         <input
//           style={{ display: "block", width: "100%", marginBottom: 8, padding: 10 }}
//           placeholder="Participant IDs, comma separated"
//           value={groupParticipantIds}
//           onChange={(event) => setGroupParticipantIds(event.target.value)}
//         />

//         <button onClick={handleCreateGroupConversation}>Create Group</button>

//         {currentConversation?.isGroup && (
//           <div style={{ marginTop: 16, border: "1px solid #aaa", padding: 10 }}>
//             <h4>{currentConversation.groupName}</h4>
//             <p>Group ID: {currentConversation._id}</p>
//             <p>Admin: {getId(currentConversation.admin)}</p>

//             <ul>
//               {currentConversation.participants.map((participant) => (
//                 <li key={getId(participant)}>
//                   {getDisplayName(participant)} - {getId(participant)}
//                   {getId(currentConversation.admin) === currentUser?._id &&
//                     getId(participant) !== currentUser?._id && (
//                       <button
//                         onClick={() =>
//                           handleRemoveGroupParticipant(getId(participant))
//                         }
//                         style={{ marginLeft: 8 }}
//                       >
//                         Remove
//                       </button>
//                     )}
//                 </li>
//               ))}
//             </ul>

//             {getId(currentConversation.admin) === currentUser?._id && (
//               <>
//                 <input
//                   style={{ width: "70%", padding: 10 }}
//                   placeholder="Rename group"
//                   value={groupRename}
//                   onChange={(event) => setGroupRename(event.target.value)}
//                 />

//                 <button
//                   onClick={handleUpdateGroupConversation}
//                   style={{ width: "30%", padding: 10 }}
//                 >
//                   Rename
//                 </button>

//                 <input
//                   style={{ display: "block", width: "100%", marginTop: 8, padding: 10 }}
//                   placeholder="User ID to add"
//                   value={groupAddUserId}
//                   onChange={(event) => setGroupAddUserId(event.target.value)}
//                 />

//                 <button onClick={handleAddGroupParticipant}>Add Member</button>
//               </>
//             )}

//             <button
//               onClick={handleLeaveGroupConversation}
//               style={{ marginLeft: 8 }}
//             >
//               Leave Group
//             </button>
//           </div>
//         )}
//       </section>

//       <section style={{ marginTop: 20 }}>
//         <h3>Presence</h3>
//         <p>Online users: {onlineUsers.length}</p>

//         <ul>
//           {onlineUsers.map((user) => (
//             <li key={user._id}>
//               <strong>{getDisplayName(user)}</strong>
//               {user.email ? ` - ${user.email}` : ""} - online
//             </li>
//           ))}
//         </ul>

//         <h4>Last presence updates</h4>

//         <ul>
//           {presenceUpdates.map((update, index) => (
//             <li key={`${update.userId}-${index}`}>
//               <strong>{getDisplayName(update.user)}</strong> -{" "}
//               {update.isOnline
//                 ? "online"
//                 : `offline - last seen ${formatLastSeen(update.lastSeen)}`}
//             </li>
//           ))}
//         </ul>
//       </section>

//       <section style={{ marginTop: 20 }}>
//         <h3>Notifications ({unreadNotificationCount} unread)</h3>

//         <button onClick={handleLoadNotifications}>Load Notifications</button>
//         <button
//           onClick={handleMarkAllNotificationsRead}
//           style={{ marginLeft: 8 }}
//         >
//           Mark All Read
//         </button>

//         <ul>
//           {notifications.map((notification) => (
//             <li key={notification._id}>
//               <strong>{notification.title}</strong>
//               {notification.isRead ? " - read" : " - unread"}
//               <div>{getNotificationBody(notification)}</div>
//               <small>
//                 {notification.createdAt
//                   ? formatLastSeen(notification.createdAt)
//                   : ""}
//               </small>
//               <div style={{ marginTop: 4 }}>
//                 {!notification.isRead && (
//                   <button
//                     onClick={() => handleMarkNotificationRead(notification._id)}
//                   >
//                     Mark Read
//                   </button>
//                 )}

//                 {notification.conversation && (
//                   <button
//                     onClick={() => handleOpenNotification(notification)}
//                     style={{ marginLeft: 8 }}
//                   >
//                     Open Chat
//                   </button>
//                 )}
//               </div>
//             </li>
//           ))}
//         </ul>
//       </section>

//       <input
//         style={{ display: "block", width: "100%", marginTop: 20, padding: 10 }}
//         placeholder="Conversation ID"
//         value={conversationId}
//         onChange={(event) => setConversationId(event.target.value)}
//       />

//       {replyTo && (
//         <div style={{ marginTop: 12, padding: 8, border: "1px solid #aaa" }}>
//           Replying to {getDisplayName(replyTo.sender)}:{" "}
//           {getMessageText(replyTo)}
//           <button onClick={() => setReplyTo(null)} style={{ marginLeft: 8 }}>
//             Cancel
//           </button>
//         </div>
//       )}

//       <div style={{ marginTop: 12 }}>
//         <input
//           ref={fileInputRef}
//           multiple
//           type="file"
//           onChange={handleFileSelection}
//         />

//         <button onClick={handleUploadFiles} style={{ marginLeft: 8 }}>
//           Upload
//         </button>
//       </div>

//       {selectedFiles.length > 0 && (
//         <ul>
//           {selectedFiles.map((file) => (
//             <li key={`${file.name}-${file.size}-${file.lastModified}`}>
//               {file.name} ({formatFileSize(file.size)})
//             </li>
//           ))}
//         </ul>
//       )}

//       {pendingAttachments.length > 0 && (
//         <ul>
//           {pendingAttachments.map((attachment) => (
//             <li key={attachment.publicId}>
//               {attachment.fileName} ({formatFileSize(attachment.fileSize)})
//               <button
//                 onClick={() =>
//                   handleRemovePendingAttachment(attachment.publicId)
//                 }
//                 style={{ marginLeft: 8 }}
//               >
//                 Remove
//               </button>
//             </li>
//           ))}
//         </ul>
//       )}

//       <form onSubmit={handleSendMessage} style={{ marginTop: 12 }}>
//         <input
//           style={{ width: "75%", padding: 10 }}
//           placeholder="Type message"
//           value={text}
//           onChange={handleTextChange}
//         />

//         <button type="submit" style={{ width: "25%", padding: 10 }}>
//           Send
//         </button>
//       </form>

//       {editingMessage && (
//         <form onSubmit={handleSaveEdit} style={{ marginTop: 12 }}>
//           <input
//             style={{ width: "75%", padding: 10 }}
//             placeholder="Edit message"
//             value={editText}
//             onChange={(event) => setEditText(event.target.value)}
//           />

//           <button type="submit" style={{ width: "12.5%", padding: 10 }}>
//             Save
//           </button>

//           <button
//             type="button"
//             onClick={() => {
//               setEditingMessage(null);
//               setEditText("");
//             }}
//             style={{ width: "12.5%", padding: 10 }}
//           >
//             Cancel
//           </button>
//         </form>
//       )}

//       <button onClick={() => emitMessagesRead()} style={{ marginTop: 8 }}>
//         Mark Conversation Read
//       </button>

//       <p style={{ marginTop: 20 }}>{status}</p>

//       {typingUsers.length > 0 && (
//         <p>
//           {typingUsers.map(getDisplayName).join(", ")}{" "}
//           {typingUsers.length === 1 ? "is" : "are"} typing...
//         </p>
//       )}

//       <ul>
//         {messages.map((message) => (
//           <li key={message._id}>
//             {message.replyTo && (
//               <blockquote style={{ margin: "6px 0", color: "#555" }}>
//                 Reply to {getDisplayName(message.replyTo.sender)}:{" "}
//                 {message.replyTo.deletedForEveryone
//                   ? "This message was deleted"
//                   : message.replyTo.text}
//               </blockquote>
//             )}

//             <div>
//               {getMessageText(message)}
//               {message.isEdited ? " (edited)" : ""}
//             </div>

//             {!message.deletedForEveryone && message.attachments?.length > 0 && (
//               <div style={{ marginTop: 8 }}>
//                 {message.attachments.map((attachment) => (
//                   <div key={attachment.publicId || attachment.url}>
//                     {isImageAttachment(attachment) ? (
//                       <img
//                         alt={attachment.fileName}
//                         src={getAttachmentUrl(attachment)}
//                         style={{ maxWidth: 220, display: "block" }}
//                       />
//                     ) : (
//                       <a
//                         href={getAttachmentUrl(attachment)}
//                         rel="noreferrer"
//                         target="_blank"
//                       >
//                         {attachment.fileName}
//                       </a>
//                     )}
//                     <small> {formatFileSize(attachment.fileSize)}</small>
//                   </div>
//                 ))}
//               </div>
//             )}

//             <small>
//               {getDisplayName(message.sender)} -{" "}
//               {getId(message.sender) === currentUser?._id
//                 ? getReceiptLabel(message)
//                 : "Received"}
//             </small>

//             {message.reactions?.length > 0 && (
//               <div>
//                 {message.reactions.map((reaction) => (
//                   <span
//                     key={`${message._id}-${getId(reaction.user)}`}
//                     style={{ marginRight: 8 }}
//                   >
//                     {reaction.emoji} {getDisplayName(reaction.user)}
//                   </span>
//                 ))}
//               </div>
//             )}

//             <div style={{ marginTop: 6 }}>
//               {!message.deletedForEveryone && (
//                 <button onClick={() => setReplyTo(message)}>Reply</button>
//               )}

//               {!message.deletedForEveryone &&
//                 reactionOptions.map((emoji) => (
//                   <button
//                     key={`${message._id}-${emoji}`}
//                     onClick={() => handleToggleReaction(message._id, emoji)}
//                     style={{ marginLeft: 4 }}
//                   >
//                     {emoji}
//                   </button>
//                 ))}

//               {getId(message.sender) === currentUser?._id &&
//                 !message.deletedForEveryone && (
//                   <button
//                     onClick={() => handleStartEdit(message)}
//                     style={{ marginLeft: 4 }}
//                   >
//                     Edit
//                   </button>
//                 )}

//               <button
//                 onClick={() => handleDeleteForMe(message._id)}
//                 style={{ marginLeft: 4 }}
//               >
//                 Delete Me
//               </button>

//               {getId(message.sender) === currentUser?._id &&
//                 !message.deletedForEveryone && (
//                   <button
//                     onClick={() => handleDeleteForEveryone(message._id)}
//                     style={{ marginLeft: 4 }}
//                   >
//                     Delete Everyone
//                   </button>
//                 )}
//             </div>
//           </li>
//         ))}
//       </ul>
//     </main>
//   );
// }

// createRoot(document.getElementById("root")).render(<App />);




import React from "react";
import ReactDOM from "react-dom/client";
import "./styles/global.css";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);