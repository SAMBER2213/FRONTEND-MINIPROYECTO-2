import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import AppLayout from '../layouts/AppLayout'
import { useAuth } from '../context/useAuth'
import { getApiErrorMessage, getRoomById, getRoomMessages } from '../services/api'
import { createRealtimeClient, joinRoom } from '../services/realtime'
import { VideoGrid, VideoControls } from '../components/VideoGrid'
import { useWebRTC } from '../hooks/useWebRTC'
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

function appendUniqueMessage(currentMessages, incomingMessage) {
  if (!incomingMessage) return currentMessages
  const incomingId = incomingMessage.id || incomingMessage.clientMessageId

  if (incomingId) {
    const exists = currentMessages.some((message) => (
      message.id === incomingId || message.clientMessageId === incomingId
    ))
    if (exists) return currentMessages
  }

  return [...currentMessages, incomingMessage]
}

function RoomDetail() {
  const { roomId } = useParams()
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const socketRef = useRef(null)
  const chatMessagesRef = useRef(null)
  const chatBottomRef = useRef(null)
  const chatScrollFrameRef = useRef(null)
  const shouldStickToBottomRef = useRef(true)

  const [room, setRoom] = useState(null)
  const [participants, setParticipants] = useState([])
  const [messages, setMessages] = useState([])
  const [messageText, setMessageText] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [hasJoinedRoom, setHasJoinedRoom] = useState(false)
  const [socketState, setSocketState] = useState('Conectando...')
  const [chatStatus, setChatStatus] = useState('')
  const [historyStatus, setHistoryStatus] = useState('')
  const [historyLoading, setHistoryLoading] = useState(false)
  const [showScrollButton, setShowScrollButton] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState('')
  const [socket, setSocket] = useState(null)

  const navigationRoomCode = typeof location.state?.roomCode === 'string' ? location.state.roomCode : ''

  // ─── Sprint 4: WebRTC + PeerJS ────────────────────────────────────
  const {
    localStream,
    remoteStreams,
    isMuted,
    isCameraOff,
    mediaError,
    peerReady,
    toggleMute,
    toggleCamera,
    callExistingPeers,
  } = useWebRTC({
    socket,
    roomId,
    myUid: user?.uid,
    enabled: hasJoinedRoom,
  })

  // ─── Chat scroll helpers ──────────────────────────────────────────
  const scrollChatToBottom = useCallback((behavior = 'smooth') => {
    if (chatScrollFrameRef.current) {
      window.cancelAnimationFrame(chatScrollFrameRef.current)
    }
    chatScrollFrameRef.current = window.requestAnimationFrame(() => {
      const container = chatMessagesRef.current
      if (!container) { chatScrollFrameRef.current = null; return }
      container.scrollTo({ top: container.scrollHeight, behavior })
      chatBottomRef.current?.scrollIntoView({ behavior, block: 'end' })
      shouldStickToBottomRef.current = true
      setShowScrollButton(false)
      chatScrollFrameRef.current = null
    })
  }, [])

  useEffect(() => () => {
    if (chatScrollFrameRef.current) window.cancelAnimationFrame(chatScrollFrameRef.current)
  }, [])

  useEffect(() => {
    if (messages.length === 0) { setShowScrollButton(false); return }
    if (shouldStickToBottomRef.current) {
      scrollChatToBottom(messages.length === 1 ? 'auto' : 'smooth')
    } else {
      setShowScrollButton(true)
    }
  }, [messages, scrollChatToBottom])

  // ─── Socket + sala ────────────────────────────────────────────────
  useEffect(() => {
    let isMounted = true
    let socketInstance = null

    const loadRoom = async () => {
      setLoading(true)
      setError('')
      setCopied('')
      setChatStatus('')
      setHistoryStatus('')
      setHasJoinedRoom(false)

      try {
        const roomResponse = await getRoomById(user, roomId)
        if (!isMounted) return

        const roomData = roomResponse.data
        const roomCodeForJoin = navigationRoomCode || getStoredRoomCode(roomId) || roomData?.roomCode || ''

        setRoom(roomData)
        if (roomData?.roomCode) storeRoomCode(roomId, roomData.roomCode)
        shouldStickToBottomRef.current = true
        setMessages([])
        setParticipants([])
        setSocketState('Conectando al servidor en tiempo real...')

        // Cargar historial
        setHistoryLoading(true)
        try {
          const messagesResponse = await getRoomMessages(user, roomId, { limit: 75, roomCode: roomCodeForJoin })
          if (!isMounted) return
          const restoredMessages = messagesResponse.data || []
          setMessages(restoredMessages)
          setHistoryStatus(
            restoredMessages.length > 0
              ? `Historial Firestore cargado: ${restoredMessages.length} mensaje${restoredMessages.length === 1 ? '' : 's'} recuperado${restoredMessages.length === 1 ? '' : 's'}.`
              : 'Historial Firestore cargado: no hay mensajes guardados todavia.'
          )
        } catch (historyError) {
          if (!isMounted) return
          setMessages([])
          setHistoryStatus(`No se pudo cargar el historial desde Firestore: ${getApiErrorMessage(historyError)}`)
        } finally {
          if (isMounted) setHistoryLoading(false)
        }

        socketInstance = createRealtimeClient()
        socketRef.current = socketInstance

        const emitJoinRoom = async () => {
          if (!user || !isMounted) return
          setSocketState('Validando acceso a la sala...')
          const token = await user.getIdToken()
          joinRoom(socketInstance, roomId, token, roomCodeForJoin)
        }

        socketInstance.on('connect', emitJoinRoom)

        socketInstance.on('connect_error', () => {
          if (!isMounted) return
          setHasJoinedRoom(false)
          setSocketState('No se pudo conectar al servidor de tiempo real.')
          setError('No se pudo conectar con WebSockets. Verifica que el backend realtime esté activo.')
        })

        socketInstance.on('reconnect_attempt', () => {
          if (!isMounted) return
          setHasJoinedRoom(false)
          setSocketState('Reconectando al chat...')
        })

        socketInstance.on('room_joined', (payload) => {
          if (!isMounted) return
          const participantList = payload.participants || []
          setParticipants(participantList)
          setRoom((current) => current ? ({
            ...current,
            participantCount: participantList.length,
          }) : current)
          setHasJoinedRoom(true)
          setSocketState('Conectado por WebSockets.')
          setChatStatus('Chat listo.')
          // Sprint 4: exponer el socket al hook de WebRTC y llamar peers existentes
          setSocket(socketInstance)
          // callExistingPeers se llama desde useWebRTC cuando peerReady cambia
        })

        socketInstance.on('participant_joined', (payload) => {
          if (!isMounted) return
          setParticipants(payload.participants || [])
          setRoom((current) => current ? ({
            ...current,
            participantCount: (payload.participants || []).length,
          }) : current)
        })

        socketInstance.on('participant_left', (payload) => {
          if (!isMounted) return
          setParticipants((current) => {
            const updated = current.filter((p) => p.uid !== payload.uid)
            setRoom((prev) => prev ? ({ ...prev, participantCount: updated.length }) : prev)
            return updated
          })
        })

        socketInstance.on('new_message', (message) => {
          if (!isMounted) return
          setMessages((current) => appendUniqueMessage(current, message))
          setSending(false)
          shouldStickToBottomRef.current = true
          setChatStatus('Mensaje recibido en tiempo real.')
          setHistoryStatus('Nuevo mensaje guardado en Firestore.')
        })

        socketInstance.on('message_saved', () => {
          if (!isMounted) return
          setSending(false)
          setChatStatus('Mensaje enviado y guardado.')
          setHistoryStatus('Persistencia confirmada en Firestore.')
        })

        socketInstance.on('message_failed', (payload) => {
          if (!isMounted) return
          setSending(false)
          const msg = payload?.message || 'No se pudo guardar el mensaje en Firestore.'
          setError(msg)
          setHistoryStatus(msg)
        })

        socketInstance.on('chat_error', (payload) => {
          if (!isMounted) return
          setError(payload?.message || 'No se pudo enviar el mensaje.')
          setSending(false)
        })

        socketInstance.on('disconnect', () => {
          if (!isMounted) return
          setHasJoinedRoom(false)
          setSocketState('Desconectado del servidor en tiempo real.')
        })

        socketInstance.on('error', (payload) => {
          if (!isMounted) return
          setHasJoinedRoom(false)
          setError(payload?.message || 'Ocurrió un error en la conexión de tiempo real.')
          setSending(false)
        })

        socketInstance.connect()
      } catch (err) {
        if (!isMounted) return
        setError(getApiErrorMessage(err))
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    if (user && roomId) loadRoom()

    return () => {
      isMounted = false
      if (socketInstance) {
        socketInstance.emit('leave_room', { roomId })
        socketInstance.disconnect()
      }
      socketRef.current = null
      setSocket(null)
    }
  }, [user, roomId, navigationRoomCode])

  // Sprint 4: cuando el peer está listo, llamar a los que ya estaban en la sala
  useEffect(() => {
    if (peerReady && participants.length > 0) {
      callExistingPeers(participants)
    }
  }, [peerReady]) // eslint-disable-line react-hooks/exhaustive-deps

  const participantTotal = useMemo(() => {
    if (participants.length > 0) return participants.length
    return room?.participantCount ?? 0
  }, [participants, room])

  const isCurrentUserHost = room?.hostUid === user?.uid || room?.isHost
  const visibleRoomCode = room?.roomCode || navigationRoomCode || getStoredRoomCode(roomId)
  const canSendMessage = hasJoinedRoom && !sending && Boolean(messageText.trim())

  const handleCopy = async (value, label) => {
    try {
      await copyText(value)
      setCopied(`${label} copiado correctamente.`)
    } catch {
      setCopied(`No se pudo copiar el ${label.toLowerCase()}.`)
    }
  }

  const handleChatScroll = () => {
    const container = chatMessagesRef.current
    if (!container) return
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight
    const isNearBottom = distanceFromBottom < 96
    shouldStickToBottomRef.current = isNearBottom
    setShowScrollButton(!isNearBottom && messages.length > 0)
  }

  const handleSendMessage = (event) => {
    event.preventDefault()
    setError('')
    const cleanText = messageText.trim()
    if (!cleanText) { setError('Escribe un mensaje antes de enviarlo.'); return }
    if (!socketRef.current?.connected || !hasJoinedRoom) {
      setError('Aún no estás conectado a la sala por WebSockets.')
      return
    }
    const clientMessageId = `client-${user.uid}-${Date.now()}`
    shouldStickToBottomRef.current = true
    setSending(true)
    setChatStatus('Enviando mensaje por WebSocket...')
    socketRef.current.emit('send_message', { roomId, text: cleanText, clientMessageId })
    setMessageText('')
  }

  return (
    <AppLayout
      title={room?.name || 'Detalle de sala'}
      subtitle="Sala de estudio con video P2P, chat en tiempo real e historial en Firestore."
    >
      <div className="room-detail-grid">
        {/* ─── Panel izquierdo: info + participantes ─────────────────── */}
        <section className="rooms-panel room-summary-panel" aria-labelledby="room-overview-title">
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
                    <p>El código está oculto. Pídeselo al anfitrión.</p>
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
                        <p>
                          {participant.uid === user?.uid
                            ? (isCurrentUserHost ? 'Tú / anfitrión' : 'Tú / invitado')
                            : 'Participante conectado'}
                        </p>
                        {/* Sprint 4: indicadores de estado de media */}
                        {participant.isMuted     && <span className="media-badge muted">🔇</span>}
                        {participant.isCameraOff && <span className="media-badge">📷</span>}
                      </div>
                    </article>
                  )
                })}
              </div>
            )}
          </section>
        </section>

        {/* ─── Panel derecho: video + chat ───────────────────────────── */}
        <section className="rooms-panel chat-panel" aria-labelledby="chat-title">

          {/* Sprint 4 (US-09, US-12): Grid de video */}
          {hasJoinedRoom && (
            <>
              <VideoControls
                isMuted={isMuted}
                isCameraOff={isCameraOff}
                onToggleMute={toggleMute}
                onToggleCamera={toggleCamera}
                peerReady={peerReady}
                mediaError={mediaError}
              />
              <VideoGrid
                localStream={localStream}
                remoteStreams={remoteStreams}
                isMuted={isMuted}
                isCameraOff={isCameraOff}
                displayName={profile?.displayName || user?.displayName || 'Tú'}
              />
            </>
          )}

          {/* Chat */}
          <div className="chat-header-row">
            <div>
              <h2 id="chat-title">Chat de la sala</h2>
              <p>Mensajería instantánea con historial persistente en Firestore.</p>
            </div>
            <span className={`chat-live-badge ${hasJoinedRoom ? 'online' : ''}`}>
              {hasJoinedRoom ? 'En línea' : 'Conectando'}
            </span>
          </div>

          {chatStatus    && <p className="chat-status"         role="status">{chatStatus}</p>}
          {historyLoading && <p className="chat-history-status" role="status">Cargando historial desde Firestore...</p>}
          {historyStatus && <p className="chat-history-status" role="status">{historyStatus}</p>}

          <div className="chat-messages-shell">
            <div
              className="chat-messages"
              ref={chatMessagesRef}
              onScroll={handleChatScroll}
              aria-live="polite"
              aria-relevant="additions text"
              aria-label="Mensajes del chat de la sala"
            >
              {messages.length === 0 ? (
                <div className="chat-empty-state">
                  <strong>Aún no hay mensajes guardados</strong>
                  <span>El historial de Firestore se mostrará aquí al entrar o recargar.</span>
                </div>
              ) : (
                messages.map((message) => {
                  const isMine = message.senderUid === user?.uid
                  return (
                    <article
                      key={message.id || message.clientMessageId || `${message.senderUid}-${message.createdAt}`}
                      className={`chat-message ${isMine ? 'mine' : ''}`}
                    >
                      <div className="chat-message-header">
                        <strong>{isMine ? 'Tú' : message.senderName}</strong>
                        <span>{formatTime(message.createdAt) || 'Ahora'}</span>
                        {message.persistedAt && <em className="message-storage-badge">DB</em>}
                      </div>
                      <p>{message.text}</p>
                    </article>
                  )
                })
              )}
              <div ref={chatBottomRef} className="chat-bottom-anchor" aria-hidden="true" />
            </div>

            {showScrollButton && (
              <button className="scroll-bottom-btn" type="button" onClick={() => scrollChatToBottom()}>
                Bajar al último mensaje
              </button>
            )}
          </div>

          <form className="chat-form" onSubmit={handleSendMessage}>
            <label htmlFor="chat-message" className="sr-only">Mensaje</label>
            <input
              id="chat-message"
              type="text"
              value={messageText}
              onChange={(event) => setMessageText(event.target.value)}
              placeholder={hasJoinedRoom ? 'Escribe un mensaje...' : 'Conectando al chat...'}
              maxLength="1000"
              disabled={!hasJoinedRoom}
            />
            <button className="login-btn" type="submit" disabled={!canSendMessage}>
              {sending ? 'Enviando...' : 'Enviar'}
            </button>
          </form>
        </section>
      </div>
    </AppLayout>
  )
}

export default RoomDetail