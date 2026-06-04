import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import AppLayout from '../layouts/AppLayout'
import { useAuth } from '../context/useAuth'
import { getApiErrorMessage, getRoomById, getRoomMessages } from '../services/api'
import { createRealtimeClient, joinRoom } from '../services/realtime'
import '../styles/Rooms.css'

function formatDate(value) {
  if (!value) return 'Sin fecha'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function formatTime(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function copyText(value) {
  if (!value) return Promise.resolve()
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(value)
  return Promise.resolve()
}

function getStoredRoomCode(roomId) {
  return window.sessionStorage.getItem(`studysync:roomCode:${roomId}`) || ''
}

function storeRoomCode(roomId, roomCode) {
  if (roomId && roomCode) {
    window.sessionStorage.setItem(`studysync:roomCode:${roomId}`, roomCode)
  }
}

function RoomDetail() {
  const { roomId } = useParams()
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const socketRef = useRef(null)
  const [room, setRoom] = useState(null)
  const [participants, setParticipants] = useState([])
  const [messages, setMessages] = useState([])
  const [messageText, setMessageText] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [socketState, setSocketState] = useState('Conectando...')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState('')
  const navigationRoomCode = typeof location.state?.roomCode === 'string' ? location.state.roomCode : ''

  useEffect(() => {
    let isMounted = true
    let socket = null

    const loadRoom = async () => {
      setLoading(true)
      setError('')
      setCopied('')

      try {
        const [roomResponse, messagesResponse] = await Promise.all([
          getRoomById(user, roomId),
          getRoomMessages(user, roomId).catch(() => ({ data: [] })),
        ])
        if (!isMounted) return

        setRoom(roomResponse.data)
        if (roomResponse.data?.roomCode) storeRoomCode(roomId, roomResponse.data.roomCode)
        setMessages(messagesResponse.data || [])
        setParticipants([])
        setSocketState('Conectando al servidor en tiempo real...')

        socket = createRealtimeClient()
        socketRef.current = socket

        socket.on('connect', async () => {
          if (!user) return
          const token = await user.getIdToken()
          const roomCodeForJoin = navigationRoomCode || getStoredRoomCode(roomId) || roomResponse.data?.roomCode || ''
          joinRoom(socket, roomId, token, roomCodeForJoin)
        })

        socket.on('room_joined', (payload) => {
          if (!isMounted) return
          setParticipants(payload.participants || [])
          setRoom((current) => current ? ({
            ...current,
            participantCount: (payload.participants || []).length,
          }) : current)
          setSocketState('Conectado por WebSockets.')
        })

        socket.on('participant_joined', (payload) => {
          if (!isMounted) return
          setParticipants(payload.participants || [])
          setRoom((current) => current ? ({
            ...current,
            participantCount: (payload.participants || []).length,
          }) : current)
        })

        socket.on('participant_left', (payload) => {
          if (!isMounted) return
          setParticipants((current) => {
            const updated = current.filter((participant) => participant.uid !== payload.uid)
            setRoom((previous) => previous ? ({
              ...previous,
              participantCount: updated.length,
            }) : previous)
            return updated
          })
        })

        socket.on('new_message', (message) => {
          if (!isMounted) return
          setMessages((current) => [...current, message])
        })

        socket.on('disconnect', () => {
          if (!isMounted) return
          setSocketState('Desconectado del servidor en tiempo real.')
        })

        socket.on('error', (payload) => {
          if (!isMounted) return
          setError(payload?.message || 'Ocurrió un error en la conexión de tiempo real.')
          setSending(false)
        })
      } catch (err) {
        if (!isMounted) return
        setError(getApiErrorMessage(err))
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    if (user && roomId) {
      loadRoom()
    }

    return () => {
      isMounted = false
      if (socket) {
        socket.emit('leave_room', { roomId })
        socket.disconnect()
      }
      socketRef.current = null
    }
  }, [user, roomId, navigationRoomCode])

  const participantTotal = useMemo(() => {
    if (participants.length > 0) return participants.length
    return room?.participantCount ?? 0
  }, [participants, room])

  const isCurrentUserHost = room?.hostUid === user?.uid || room?.isHost
  const visibleRoomCode = room?.roomCode || navigationRoomCode || getStoredRoomCode(roomId)

  const handleCopy = async (value, label) => {
    try {
      await copyText(value)
      setCopied(`${label} copiado correctamente.`)
    } catch {
      setCopied(`No se pudo copiar el ${label.toLowerCase()}.`)
    }
  }

  const handleSendMessage = (event) => {
    event.preventDefault()
    setError('')

    const cleanText = messageText.trim()
    if (!cleanText) {
      setError('Escribe un mensaje antes de enviarlo.')
      return
    }

    if (!socketRef.current?.connected) {
      setError('No hay conexión activa con WebSockets. Revisa el servidor de tiempo real.')
      return
    }

    setSending(true)
    socketRef.current.emit('send_message', { roomId, text: cleanText })
    setMessageText('')
    setSending(false)
  }

  return (
    <AppLayout
      title={room?.name || 'Detalle de sala'}
      subtitle="Sala con ID único, participantes conectados y chat sencillo en tiempo real."
    >
      <div className="room-detail-grid">
        <section className="rooms-panel" aria-labelledby="room-overview-title">
          <div className="rooms-panel-header">
            <div>
              <h2 id="room-overview-title">Información general</h2>
              <p>{socketState}</p>
            </div>
            <button className="secondary-btn" type="button" onClick={() => navigate('/salas')}>
              Volver a salas
            </button>
          </div>

          {loading ? (
            <div className="rooms-empty-state">Cargando sala...</div>
          ) : room ? (
            <>
              <div className="room-info-grid">
                <article className="room-info-card">
                  <span className="room-info-label">Nombre</span>
                  <strong>{room.name}</strong>
                  <p>{room.description || 'Sin descripción registrada.'}</p>
                </article>

                <article className="room-info-card">
                  <span className="room-info-label">ID único</span>
                  <strong>{visibleRoomCode || room.id}</strong>
                  {visibleRoomCode ? (
                    <button className="link-btn" type="button" onClick={() => handleCopy(visibleRoomCode, 'ID único')}>
                      Copiar ID
                    </button>
                  ) : (
                    <p>El código está oculto. Pídeselo al anfitrión para entrar como invitado.</p>
                  )}
                </article>

                <article className="room-info-card">
                  <span className="room-info-label">Participantes</span>
                  <strong>{participantTotal} / {room.maxParticipants ?? 10}</strong>
                  <p>{room.isPrivate ? 'Sala privada' : 'Sala pública'}</p>
                </article>

                <article className="room-info-card">
                  <span className="room-info-label">Creada</span>
                  <strong>{formatDate(room.createdAt)}</strong>
                  <p>Anfitrión: {room.hostName || profile?.displayName || user?.displayName || 'Usuario'}</p>
                  <p>{isCurrentUserHost ? 'Tienes permisos de anfitrión.' : 'Entraste como invitado.'}</p>
                </article>
              </div>

              {copied && <p className="success-msg" role="status">{copied}</p>}
              {error && <p className="error-msg" role="alert">{error}</p>}
            </>
          ) : (
            <div className="rooms-empty-state">No se encontró la sala solicitada.</div>
          )}

          <section className="participants-box" aria-labelledby="participants-title">
            <h2 id="participants-title">Participantes conectados</h2>
            {participants.length === 0 ? (
              <div className="rooms-empty-state">Aún no hay participantes conectados.</div>
            ) : (
              <div className="participants-list compact">
                {participants.map((participant) => {
                  const initial = (participant.displayName || 'S').charAt(0).toUpperCase()
                  const hasRemoteAvatar = typeof participant.photoURL === 'string' && participant.photoURL.startsWith('http')
                  const avatarClass = hasRemoteAvatar ? '' : (participant.photoURL || 'avatar-blue')

                  return (
                    <article key={participant.uid} className="participant-card">
                      <div className={`participant-avatar ${avatarClass}`} aria-hidden="true">
                        {hasRemoteAvatar ? <img src={participant.photoURL} alt="" /> : initial}
                      </div>
                      <div>
                        <h3>{participant.displayName}</h3>
                        <p>{participant.uid === user?.uid ? (isCurrentUserHost ? 'Tú / anfitrión' : 'Tú / invitado') : 'Participante conectado'}</p>
                      </div>
                    </article>
                  )
                })}
              </div>
            )}
          </section>
        </section>

        <section className="rooms-panel chat-panel" aria-labelledby="chat-title">
          <h2 id="chat-title">Chat de la sala</h2>
          <p>Chat sencillo usando WebSockets y guardado en Firestore.</p>

          <div className="chat-messages" aria-live="polite">
            {messages.length === 0 ? (
              <div className="rooms-empty-state">Aún no hay mensajes. Escribe el primero.</div>
            ) : (
              messages.map((message) => {
                const isMine = message.senderUid === user?.uid
                return (
                  <article key={message.id || `${message.senderUid}-${message.createdAt}`} className={`chat-message ${isMine ? 'mine' : ''}`}>
                    <div className="chat-message-header">
                      <strong>{isMine ? 'Tú' : message.senderName}</strong>
                      <span>{formatTime(message.createdAt)}</span>
                    </div>
                    <p>{message.text}</p>
                  </article>
                )
              })
            )}
          </div>

          <form className="chat-form" onSubmit={handleSendMessage}>
            <label htmlFor="chat-message" className="sr-only">Mensaje</label>
            <input
              id="chat-message"
              type="text"
              value={messageText}
              onChange={(event) => setMessageText(event.target.value)}
              placeholder="Escribe un mensaje..."
              maxLength="1000"
            />
            <button className="login-btn" type="submit" disabled={sending || !messageText.trim()}>
              Enviar
            </button>
          </form>
        </section>
      </div>
    </AppLayout>
  )
}

export default RoomDetail