import { io } from 'socket.io-client'

const REALTIME_URL = import.meta.env.VITE_REALTIME_API_URL || 'http://localhost:3002'

export function createRealtimeClient() {
  return io(REALTIME_URL, {
    transports: ['websocket', 'polling'],
    autoConnect: true,
  })
}
