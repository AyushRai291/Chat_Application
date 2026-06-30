import { io } from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

let socket = null;

export function connectSocket() {
  if (!socket) {
    socket = io(SOCKET_URL, {
      withCredentials: true,
      transports: ["websocket"],
      autoConnect: false,
      reconnection: true,
    });
  }

  if (!socket.connected) {
    socket.connect();
  }

  return socket;
}

export function disconnectSocket() {
  if (!socket) return;

  socket.removeAllListeners();
  socket.disconnect();
  socket = null;
}

export function getSocket() {
  return socket;
}
