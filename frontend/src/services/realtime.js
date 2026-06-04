import { io } from 'socket.io-client'

const REALTIME_URL = import.meta.env.VITE_REALTIME_API_URL || 'http://localhost:3002'

const SOCKET_OPTIONS = {
  transports: ['websocket', 'polling'],
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: 8,
  reconnectionDelay: 700,
  timeout: 10000,
}

let socketInstance = null

export function getRealtimeClient() {
  if (!socketInstance || socketInstance.disconnected) {
    socketInstance = io(REALTIME_URL, SOCKET_OPTIONS)
  }
  return socketInstance
}

// Mantener compatibilidad con el código existente en RoomDetail.
// forceNew evita que dos pantallas compartan listeners de una sesión anterior.
export function createRealtimeClient() {
  return io(REALTIME_URL, {
    ...SOCKET_OPTIONS,
    autoConnect: false,
    forceNew: true,
  })
}

/**
 * Emite join_room incluyendo roomCode si la sala es privada.
 * El backend lo requiere para validar el acceso a salas privadas.
 */
export function joinRoom(socket, roomId, token, roomCode = null) {
  const payload = { roomId, token }
  if (roomCode) payload.roomCode = roomCode
  socket.emit('join_room', payload)
}
