import { io } from "socket.io-client"

// export const socket = io("http://localhost:5000", {
export const socket = io("https://ultron-backend-qoe2.onrender.com", {
  autoConnect: true,
  withCredentials: true,
  transports: ["websocket", "polling"],   // try WebSocket first, fall back to polling
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
})
