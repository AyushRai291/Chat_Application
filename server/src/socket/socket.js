import { Server } from "socket.io";
import jwt from "jsonwebtoken";
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

    console.log(`Socket connected: ${socket.id} user:${userId}`);

    socket.on("ping:server", () => {
      socket.emit("pong:client", {
        message: "Socket connected successfully",
      });
    });

    socket.on("disconnect", async () => {
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
