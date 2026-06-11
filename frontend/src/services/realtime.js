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
 * Sprint 4 (TS-03): Solicita al backend la configuración ICE (STUN + ExpressTURN).
 * Devuelve una promesa que resuelve con el array RTCIceServer[].
 */
export function getIceServers(socket) {
  return new Promise((resolve) => {
    socket.once('ice_servers', ({ iceServers }) => resolve(iceServers))
    socket.emit('get_ice_servers')
  })
}

/**
 * Sprint 4 (TS-03): Registra el peerId de PeerJS en el servidor
 * para que los demás participantes puedan iniciar llamadas.
 */
export function registerPeer(socket, roomId, peerId) {
  socket.emit('register_peer', { roomId, peerId })
}

export { REALTIME_URL }