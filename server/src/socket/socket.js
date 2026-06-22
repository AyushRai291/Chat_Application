import { Server } from "socket.io";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import User from "../models/User.js";

const CLIENT_URL = "http://localhost:5173";

// Socket.io ka single shared instance.
// Controllers isko getIO() se use kar sakte hain.
let ioInstance = null;

// userId -> Set(socketIds)
// Same user ke multiple tabs/devices ko properly handle karne ke liye.
const onlineUsers = new Map();

const parseCookies = (cookieHeader = "") => {
  return cookieHeader.split(";").reduce((cookies, cookie) => {
    const [key, ...valueParts] = cookie.trim().split("=");

    if (!key) return cookies;

    cookies[key] = decodeURIComponent(valueParts.join("="));
    return cookies;
  }, {});
};

const getOnlineUserIds = () => Array.from(onlineUsers.keys());

export const isUserOnline = (userId) => {
  return onlineUsers.has(userId.toString());
};

const serializeUser = (user) => ({
  _id: user._id.toString(),
  name: user.name,
  email: user.email,
  avatar: user.avatar,
  isOnline: user.isOnline,
  lastSeen: user.lastSeen ? new Date(user.lastSeen).toISOString() : null,
});

const getOnlineUsers = async () => {
  const userIds = getOnlineUserIds();

  const users = await User.find({
    _id: { $in: userIds },
  }).select("name email avatar isOnline lastSeen");

  return users.map(serializeUser);
};

const buildPresenceUser = (userId, user, fallback = {}) => {
  if (user) {
    return serializeUser(user);
  }

  return {
    _id: userId,
    name: fallback.name || "",
    email: fallback.email || "",
    avatar: fallback.avatar || "",
    isOnline: fallback.isOnline ?? false,
    lastSeen: fallback.lastSeen || null,
  };
};

const buildSocketUser = (user) => ({
  _id: user._id.toString(),
  name: user.name,
  email: user.email,
  avatar: user.avatar,
});

const toIdString = (value) => value._id?.toString() || value.toString();

const addUniqueId = (values, nextValue) => {
  return Array.from(new Set([...values.map(toIdString), nextValue.toString()]));
};

const getRecipientIds = (conversation, senderId) => {
  return conversation.participants
    .map(toIdString)
    .filter((participantId) => participantId !== senderId.toString());
};

const getMessageStatus = ({ conversation, senderId, deliveredTo, readBy }) => {
  const recipientIds = getRecipientIds(conversation, senderId);

  if (recipientIds.length === 0) {
    return "read";
  }

  const deliveredIds = new Set(deliveredTo.map(toIdString));
  const readIds = new Set(readBy.map(toIdString));

  if (recipientIds.every((participantId) => readIds.has(participantId))) {
    return "read";
  }

  if (recipientIds.every((participantId) => deliveredIds.has(participantId))) {
    return "delivered";
  }

  return "sent";
};

const buildReceipt = (message) => ({
  messageId: message._id.toString(),
  status: message.status,
  deliveredTo: message.deliveredTo.map(toIdString),
  readBy: message.readBy.map(toIdString),
});

const findUserConversation = (conversationId, userId) => {
  if (!mongoose.Types.ObjectId.isValid(conversationId)) {
    return null;
  }

  return Conversation.findOne({
    _id: conversationId,
    participants: userId,
  }).select("participants");
};

const emitToOtherParticipants = (conversation, senderId, eventName, payload) => {
  conversation.participants.forEach((participantId) => {
    const receiverId = participantId.toString();

    if (receiverId === senderId) {
      return;
    }

    ioInstance.to(`user:${receiverId}`).emit(eventName, payload);
  });
};

const emitToParticipants = (conversation, eventName, payload) => {
  conversation.participants.forEach((participantId) => {
    ioInstance.to(`user:${participantId.toString()}`).emit(eventName, payload);
  });
};

const markMessagesDeliveredForUser = async (userId, user) => {
  const conversations = await Conversation.find({
    participants: userId,
  }).select("participants");

  if (conversations.length === 0) {
    return;
  }

  const conversationById = new Map(
    conversations.map((conversation) => [
      conversation._id.toString(),
      conversation,
    ])
  );

  const messages = await Message.find({
    conversation: { $in: conversations.map((conversation) => conversation._id) },
    sender: { $ne: userId },
    deliveredTo: { $ne: userId },
    deletedForEveryone: false,
  }).select("conversation sender status deliveredTo readBy");

  const receiptsByConversation = new Map();

  for (const message of messages) {
    const conversation = conversationById.get(message.conversation.toString());

    if (!conversation) {
      continue;
    }

    message.deliveredTo = addUniqueId(message.deliveredTo, userId);
    message.status = getMessageStatus({
      conversation,
      senderId: message.sender,
      deliveredTo: message.deliveredTo,
      readBy: message.readBy,
    });

    await message.save();

    const conversationId = conversation._id.toString();
    const currentReceipts = receiptsByConversation.get(conversationId) || [];

    receiptsByConversation.set(conversationId, [
      ...currentReceipts,
      buildReceipt(message),
    ]);
  }

  receiptsByConversation.forEach((receipts, conversationId) => {
    const conversation = conversationById.get(conversationId);

    emitToParticipants(conversation, "receipt:delivered", {
      conversationId,
      user: buildSocketUser(user),
      receipts,
    });
  });
};

const markConversationReadForUser = async ({ conversation, userId, user }) => {
  const messages = await Message.find({
    conversation: conversation._id,
    sender: { $ne: userId },
    readBy: { $ne: userId },
    deletedForEveryone: false,
  }).select("conversation sender status deliveredTo readBy");

  if (messages.length === 0) {
    return;
  }

  const receipts = [];

  for (const message of messages) {
    message.deliveredTo = addUniqueId(message.deliveredTo, userId);
    message.readBy = addUniqueId(message.readBy, userId);
    message.status = getMessageStatus({
      conversation,
      senderId: message.sender,
      deliveredTo: message.deliveredTo,
      readBy: message.readBy,
    });

    await message.save();
    receipts.push(buildReceipt(message));
  }

  emitToParticipants(conversation, "receipt:read", {
    conversationId: conversation._id.toString(),
    user: buildSocketUser(user),
    receipts,
  });
};

const addUserSocket = (userId, socketId) => {
  const existingSockets = onlineUsers.get(userId);
  const wasOffline = !existingSockets;

  if (existingSockets) {
    existingSockets.add(socketId);
  } else {
    onlineUsers.set(userId, new Set([socketId]));
  }

  return wasOffline;
};

const removeUserSocket = (userId, socketId) => {
  const existingSockets = onlineUsers.get(userId);

  if (!existingSockets) {
    return false;
  }

  existingSockets.delete(socketId);

  if (existingSockets.size > 0) {
    return false;
  }

  onlineUsers.delete(userId);
  return true;
};

const emitOnlineUsers = async (target = ioInstance) => {
  const users = await getOnlineUsers();

  target.emit("presence:online-users", {
    userIds: getOnlineUserIds(),
    users,
  });
};

const emitPresenceUpdate = async (payload) => {
  ioInstance.emit("presence:update", payload);
  await emitOnlineUsers();
};

export const getIO = () => ioInstance;

export const setupSocket = (httpServer) => {
  ioInstance = new Server(httpServer, {
    cors: {
      origin: CLIENT_URL,
      credentials: true,
    },
  });

  // Dev server restart ke baad DB me stale online users reh sakte hain.
  // Startup pe unhe offline mark kar dete hain.
  User.updateMany(
    { isOnline: true },
    { $set: { isOnline: false, lastSeen: new Date() } }
  ).catch((err) => {
    console.error("Presence cleanup failed:", err.message);
  });

  // Socket auth middleware.
  // Ye Express protectRoute jaisa hai, bas socket connection ke liye.
  ioInstance.use(async (socket, next) => {
    try {
      const cookies = parseCookies(socket.handshake.headers.cookie);
      const token = cookies.jwt;

      if (!token) {
        return next(new Error("Unauthorized - No token"));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId).select("-password");

      if (!user) {
        return next(new Error("Unauthorized - User not found"));
      }

      // Token valid hai, ab socket ke saath user attach rahega.
      socket.user = user;
      next();
    } catch (err) {
      next(new Error("Unauthorized - Invalid token"));
    }
  });

  ioInstance.on("connection", async (socket) => {
    const userId = socket.user._id.toString();
    const typingConversationIds = new Set();

    socket.join(`user:${userId}`);

    const wasOffline = addUserSocket(userId, socket.id);

    if (wasOffline) {
      const user = await User.findByIdAndUpdate(
        userId,
        {
          isOnline: true,
          lastSeen: null,
        },
        { new: true }
      ).select("name email avatar isOnline lastSeen");

      await emitPresenceUpdate({
        userId,
        isOnline: true,
        lastSeen: null,
        user: buildPresenceUser(userId, user, {
          isOnline: true,
          lastSeen: null,
        }),
      });
    }

    // Newly connected client ko current online users list bhej dete hain.
    await emitOnlineUsers(socket);
    await markMessagesDeliveredForUser(userId, socket.user);

    console.log(`Socket connected: ${socket.id} user:${userId}`);

    socket.on("ping:server", () => {
      socket.emit("pong:client", {
        message: "Socket connected successfully",
      });
    });

    socket.on("typing:start", async ({ conversationId } = {}) => {
      const conversation = await findUserConversation(conversationId, userId);

      if (!conversation) {
        return;
      }

      typingConversationIds.add(conversation._id.toString());

      emitToOtherParticipants(conversation, userId, "typing:start", {
        conversationId: conversation._id.toString(),
        user: buildSocketUser(socket.user),
      });
    });

    socket.on("typing:stop", async ({ conversationId } = {}) => {
      const conversation = await findUserConversation(conversationId, userId);

      if (!conversation) {
        return;
      }

      typingConversationIds.delete(conversation._id.toString());

      emitToOtherParticipants(conversation, userId, "typing:stop", {
        conversationId: conversation._id.toString(),
        user: buildSocketUser(socket.user),
      });
    });

    socket.on("messages:read", async ({ conversationId } = {}) => {
      const conversation = await findUserConversation(conversationId, userId);

      if (!conversation) {
        return;
      }

      await markConversationReadForUser({
        conversation,
        userId,
        user: socket.user,
      });
    });

    socket.on("disconnect", async () => {
      typingConversationIds.forEach((conversationId) => {
        Conversation.findById(conversationId)
          .select("participants")
          .then((conversation) => {
            if (!conversation) {
              return;
            }

            emitToOtherParticipants(conversation, userId, "typing:stop", {
              conversationId,
              user: buildSocketUser(socket.user),
            });
          })
          .catch((err) => {
            console.error("Typing cleanup failed:", err.message);
          });
      });

      const isNowOffline = removeUserSocket(userId, socket.id);

      if (isNowOffline) {
        const lastSeen = new Date();

        const user = await User.findByIdAndUpdate(
          userId,
          {
            isOnline: false,
            lastSeen,
          },
          { new: true }
        ).select("name email avatar isOnline lastSeen");

        await emitPresenceUpdate({
          userId,
          isOnline: false,
          lastSeen: lastSeen.toISOString(),
          user: buildPresenceUser(userId, user, {
            isOnline: false,
            lastSeen: lastSeen.toISOString(),
          }),
        });
      }

      console.log(`Socket disconnected: ${socket.id} user:${userId}`);
    });
  });

  return ioInstance;
};
