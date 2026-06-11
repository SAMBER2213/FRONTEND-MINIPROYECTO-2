import { io } from 'socket.io-client'

export const REALTIME_URL = import.meta.env.VITE_REALTIME_API_URL || 'http://localhost:3002'

// polling primero para garantizar conexión en Render,
// luego upgrade automático a WebSocket si el servidor lo soporta
const SOCKET_OPTIONS = {
  transports: ['polling', 'websocket'],
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 20000,
  withCredentials: false,
}

let socketInstance = null

export function getRealtimeClient() {
  if (!socketInstance || socketInstance.disconnected) {
    socketInstance = io(REALTIME_URL, SOCKET_OPTIONS)
  }
  return socketInstance
}

export function createRealtimeClient() {
  return io(REALTIME_URL, {
    ...SOCKET_OPTIONS,
    autoConnect: false,
    forceNew: true,
  })
}

/**
 * Emite join_room incluyendo roomCode si la sala es privada.
 */
export function joinRoom(socket, roomId, token, roomCode = null) {
  const payload = { roomId, token }
  if (roomCode) payload.roomCode = roomCode
  socket.emit('join_room', payload)
}

/**
 * Registra el peerId de PeerJS en el servidor
 * para que los demás participantes puedan iniciar llamadas.
 */
export function registerPeer(socket, roomId, peerId) {
  socket.emit('register_peer', { roomId, peerId })
}
