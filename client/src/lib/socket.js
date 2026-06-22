import { io } from "socket.io-client";

const SOCKET_URL = "http://localhost:5000";

let socket = null;

export const connectSocket = () => {
  if (socket) {
    return socket;
  }

  socket = io(SOCKET_URL, {
    withCredentials: true,
    transports: ["websocket"],
    autoConnect: true,
  });

  return socket;
};

export const getSocket = () => socket;

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};