import { io } from "socket.io-client"

export const socket = io(import.meta.env.VITE_API_URL ?? "http://localhost:5000", {
  autoConnect: true,
  withCredentials: true,
  transports: ["websocket", "polling"],   // try WebSocket first, fall back to polling
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
})
