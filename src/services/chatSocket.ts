import { socket } from "../lib/socket"

// ── Send a message ────────────────────────────────────────────────────────────
export const sendMessage = (msg: string, chatId: string | null) => {
  socket.emit("send_message", { msg, chatId })
}

// ── Listeners ─────────────────────────────────────────────────────────────────
export const onReceiveMessage = (callback: (data: any) => void) => {
  socket.off("receive_message")
  socket.on("receive_message", callback)
}

export const onChatHistory = (callback: (data: any) => void) => {
  socket.off("chat_history")
  socket.on("chat_history", callback)
}

export const removeSocketListeners = () => {
  socket.off("receive_message")
  socket.off("chat_history")
  socket.off("suggestions")
}
