import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import AppLayout from '../layouts/AppLayout'
import { useAuth } from '../context/useAuth'
import { getApiErrorMessage, getRoomById, getRoomMessages } from '../services/api'
import { createRealtimeClient, joinRoom } from '../services/realtime'
import { VideoGrid } from '../components/VideoGrid'
import { useWebRTC } from '../hooks/useWebRTC'
import { PreJoinModal } from '../components/PreJoinModal'
import '../styles/RoomDetail.css'

/* ── Helpers ─────────────────────────────────────────────────────── */
function formatDate(value) {
  if (!value) return 'Sin fecha'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(d)
}

function formatTime(value) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('es-CO', { hour: '2-digit', minute: '2-digit' }).format(d)
}

function getStoredRoomCode(roomId) {
  return window.sessionStorage.getItem(`studysync:roomCode:${roomId}`) || ''
}

function storeRoomCode(roomId, code) {
  if (roomId && code) window.sessionStorage.setItem(`studysync:roomCode:${roomId}`, code)
}

function appendUnique(list, msg) {
  if (!msg) return list
  const id = msg.id || msg.clientMessageId
  if (id && list.some((m) => m.id === id || m.clientMessageId === id)) return list
  return [...list, msg]
}

/* Paleta de colores para avatares de participantes */
const AVATAR_COLORS = ['av-blue','av-green','av-purple','av-orange','av-pink','av-teal','av-red','av-indigo']
function avatarColor(uid = '') {
  let h = 0
  for (let i = 0; i < uid.length; i++) h = (h * 31 + uid.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

/* ═══════════════════════════════════════════════════════════════════
   Componente principal
   ═══════════════════════════════════════════════════════════════════ */
function RoomDetail() {
  const { roomId }           = useParams()
  const { user, profile }    = useAuth()
  const navigate             = useNavigate()
  const location             = useLocation()

  /* ── Refs ──────────────────────────────────────────────────────── */
  const socketRef            = useRef(null)
  const chatMessagesRef      = useRef(null)
  const chatBottomRef        = useRef(null)
  const shouldStickRef       = useRef(true)

  /* ── Pre-join modal ────────────────────────────────────────────── */
  const [showPreJoin,     setShowPreJoin]     = useState(true)
  const [initialMedia,    setInitialMedia]    = useState({ cameraOn: true, micOn: true })

  /* ── Estado de sala y conexión ─────────────────────────────────── */
  const [room,            setRoom]           = useState(null)
  const [participants,    setParticipants]    = useState([])
  const [loading,         setLoading]         = useState(true)
  const [hasJoined,       setHasJoined]       = useState(false)
  const [socketState,     setSocketState]     = useState('Conectando...')
  const [error,           setError]           = useState('')
  const [socket,          setSocket]          = useState(null)

  /* ── Estado del chat ───────────────────────────────────────────── */
  const [messages,        setMessages]        = useState([])
  const [messageText,     setMessageText]     = useState('')
  const [sending,         setSending]         = useState(false)
  const [chatOpen,        setChatOpen]        = useState(false)

  /* ── Modal info sala ───────────────────────────────────────────── */
  const [infoOpen,        setInfoOpen]        = useState(false)
  const [copied,          setCopied]          = useState('')

  /* ── Scroll del chat ───────────────────────────────────────────── */
  const scrollToBottom = useCallback((behavior = 'smooth') => {
    requestAnimationFrame(() => {
      const c = chatMessagesRef.current
      if (!c) return
      c.scrollTo({ top: c.scrollHeight, behavior })
      shouldStickRef.current = true
    })
  }, [])

  useEffect(() => {
    if (messages.length === 0) return
    if (shouldStickRef.current) scrollToBottom(messages.length === 1 ? 'auto' : 'smooth')
  }, [messages, scrollToBottom])

  /* ── roomCode de navegación ────────────────────────────────────── */
  const navCode = typeof location.state?.roomCode === 'string' ? location.state.roomCode : ''

  /* ── WebRTC ────────────────────────────────────────────────────── */
  const {
    localStream, remoteStreams,
    isMuted, isCameraOff,
    mediaError, peerReady,
    toggleMute, toggleCamera,
    callExistingPeers,
  } = useWebRTC({ socket, roomId, myUid: user?.uid, enabled: hasJoined && !showPreJoin, initialCameraOff: !initialMedia.cameraOn, initialMuted: !initialMedia.micOn })

  /* ── Socket: cargar sala y conectar ────────────────────────────── */
  useEffect(() => {
    let mounted = true
    let socketInst = null

    const load = async () => {
      setLoading(true)
      setError('')
      setHasJoined(false)
      setMessages([])
      setParticipants([])

      try {
        const roomRes  = await getRoomById(user, roomId)
        if (!mounted) return
        const roomData = roomRes.data
        const code     = navCode || getStoredRoomCode(roomId) || roomData?.roomCode || ''

        setRoom(roomData)
        if (roomData?.roomCode) storeRoomCode(roomId, roomData.roomCode)
        setSocketState('Conectando al servidor en tiempo real...')

        /* Historial */
        try {
          const msgRes = await getRoomMessages(user, roomId, { limit: 75, roomCode: code })
          if (!mounted) return
          setMessages(msgRes.data || [])
        } catch { /* silently fail */ }

        /* Socket */
        const { createRealtimeClient: makeClient } = await import('../services/realtime')
        socketInst = makeClient()
        socketRef.current = socketInst

        const doJoin = async () => {
          if (!user || !mounted) return
          setSocketState('Validando acceso...')
          const token = await user.getIdToken()
          joinRoom(socketInst, roomId, token, code)
        }

        socketInst.on('connect',         doJoin)
        socketInst.on('connect_error',   () => { if (!mounted) return; setSocketState('Error de conexión.'); setError('No se pudo conectar al servidor de tiempo real.') })
        socketInst.on('reconnect_attempt', () => { if (!mounted) return; setHasJoined(false); setSocketState('Reconectando...') })

        socketInst.on('room_joined', (p) => {
          if (!mounted) return
          setParticipants(p.participants || [])
          setRoom((r) => r ? ({ ...r, participantCount: (p.participants || []).length }) : r)
          setHasJoined(true)
          setSocketState('Conectado')
          setSocket(socketInst)
        })

        socketInst.on('participant_joined', (p) => {
          if (!mounted) return
          setParticipants(p.participants || [])
          setRoom((r) => r ? ({ ...r, participantCount: (p.participants || []).length }) : r)
        })

        socketInst.on('participant_left', (p) => {
          if (!mounted) return
          setParticipants((prev) => {
            const updated = prev.filter((x) => x.uid !== p.uid)
            setRoom((r) => r ? ({ ...r, participantCount: updated.length }) : r)
            return updated
          })
        })

        socketInst.on('new_message', (msg) => {
          if (!mounted) return
          setMessages((prev) => appendUnique(prev, msg))
          setSending(false)
          shouldStickRef.current = true
        })

        socketInst.on('message_saved',  () => { if (mounted) setSending(false) })
        socketInst.on('message_failed', (p) => { if (mounted) { setSending(false); setError(p?.message || 'Error al guardar mensaje.') } })
        socketInst.on('chat_error',     (p) => { if (mounted) { setSending(false); setError(p?.message || 'Error al enviar mensaje.') } })
        socketInst.on('disconnect',     () => { if (mounted) { setHasJoined(false); setSocketState('Desconectado.') } })
        socketInst.on('error',          (p) => { if (mounted) { setHasJoined(false); setError(p?.message || 'Error de conexión.') } })

        socketInst.connect()
      } catch (err) {
        if (mounted) setError(getApiErrorMessage(err))
      } finally {
        if (mounted) setLoading(false)
      }
    }

    if (user && roomId) load()

    return () => {
      mounted = false
      if (socketInst) {
        socketInst.emit('leave_room', { roomId })
        socketInst.disconnect()
      }
      socketRef.current = null
      setSocket(null)
    }
  }, [user, roomId, navCode]) // eslint-disable-line react-hooks/exhaustive-deps

  /* Llamar peers existentes cuando PeerJS está listo */
  useEffect(() => {
    if (peerReady && participants.length > 0) callExistingPeers(participants)
  }, [peerReady]) // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Datos derivados ───────────────────────────────────────────── */
  const participantTotal    = useMemo(() => participants.length || room?.participantCount || 0, [participants, room])
  const visibleCode         = room?.roomCode || navCode || getStoredRoomCode(roomId)
  const isHost              = room?.hostUid === user?.uid || room?.isHost
  const myDisplayName       = profile?.displayName || user?.displayName || 'Tú'
  const canSend             = hasJoined && !sending && Boolean(messageText.trim())

  /* ── Handlers ──────────────────────────────────────────────────── */
  const handleCopy = async (val, label) => {
    try {
      await navigator.clipboard?.writeText(val)
      setCopied(`${label} copiado`)
      setTimeout(() => setCopied(''), 2200)
    } catch { setCopied('No se pudo copiar') }
  }

  const handleSend = (e) => {
    e.preventDefault()
    const text = messageText.trim()
    if (!text) return
    if (!socketRef.current?.connected || !hasJoined) { setError('No estás conectado a la sala.'); return }
    const clientMessageId = `client-${user.uid}-${Date.now()}`
    shouldStickRef.current = true
    setSending(true)
    socketRef.current.emit('send_message', { roomId, text, clientMessageId })
    setMessageText('')
  }

  const handleChatScroll = () => {
    const c = chatMessagesRef.current
    if (!c) return
    shouldStickRef.current = (c.scrollHeight - c.scrollTop - c.clientHeight) < 80
  }

  /* ── Pre-join handlers ─────────────────────────────────────────── */
  const handlePreJoinConfirm = ({ cameraOn, micOn }) => {
    setInitialMedia({ cameraOn, micOn })
    setShowPreJoin(false)
  }

  const handlePreJoinCancel = () => {
    navigate('/salas')
  }

  /* ═══════════════════════════════════════════════════════════════ */
  return (
    <AppLayout title={room?.name || 'Sala de estudio'} subtitle="">
      {/* ── Modal de pre-entrada (preview de cámara) ──────────── */}
      {showPreJoin && (
        <PreJoinModal
          roomName={room?.name || 'Sala de estudio'}
          onJoin={handlePreJoinConfirm}
          onCancel={handlePreJoinCancel}
        />
      )}

      {/* ── Shell principal ─────────────────────────────────────── */}
      <div className="room-shell">

        {/* ── Barra superior ──────────────────────────────────────── */}
        <div className="room-topbar">
          {/* Nombre e ID */}
          <div className="room-topbar-left">
            <span className="room-topbar-name">{room?.name || 'Sala de estudio'}</span>
            {visibleCode && <span className="room-topbar-id">ID de la sala: {visibleCode}</span>}
          </div>

          {/* Fila de avatares de participantes */}
          <div className="room-participants-row" aria-label="Participantes conectados">
            {loading ? (
              <span style={{ fontSize: 12, color: '#64748b' }}>Cargando...</span>
            ) : participants.length === 0 ? (
              <span style={{ fontSize: 12, color: '#64748b' }}>Sin participantes aún</span>
            ) : participants.map((p) => {
              const initial      = (p.displayName || 'U').charAt(0).toUpperCase()
              const hasPhoto     = typeof p.photoURL === 'string' && p.photoURL.startsWith('http')
              const color        = avatarColor(p.uid)
              const isMe         = p.uid === user?.uid

              return (
                <div key={p.uid} className="room-participant-thumb" title={p.displayName}>
                  <div className={`room-participant-avatar ${hasPhoto ? '' : color} voice-idle`}>
                    {hasPhoto
                      ? <img src={p.photoURL} alt="" />
                      : initial}
                  </div>
                  <span className="room-participant-name">{isMe ? 'Tú' : p.displayName}</span>
                  <div className="room-participant-badges">
                    {p.isMuted     && <span className="room-participant-badge">🔇</span>}
                    {p.isCameraOff && <span className="room-participant-badge">📷</span>}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Badge conectados */}
          <div className="room-connected-count">
            <div className="room-connected-dot" />
            {participantTotal} {participantTotal === 1 ? 'conectado' : 'conectados'}
          </div>
        </div>

        {/* ── Área principal ──────────────────────────────────────── */}
        <div className="room-main">

          {/* ── Área de video ─────────────────────────────────────── */}
          <div className="room-video-area">
            {/* Toast de estado */}
            <div className={`room-connection-toast${hasJoined ? ' connected' : error ? ' error' : ''}`}>
              {hasJoined ? '● Conectado' : error ? `⚠ ${socketState}` : `⏳ ${socketState}`}
            </div>

            {/* Botón flotante de info */}
            <button
              className="room-info-fab"
              type="button"
              title="Información de la sala"
              onClick={() => setInfoOpen(true)}
              aria-label="Ver información de la sala"
            >
              ?
            </button>

            {/* Media error */}
            {mediaError && (
              <div className="room-media-error" role="alert">{mediaError}</div>
            )}

            {/* Grid de video */}
            <VideoGrid
              localStream={localStream}
              remoteStreams={remoteStreams}
              isMuted={isMuted}
              isCameraOff={isCameraOff}
              displayName={myDisplayName}
              myUid={user?.uid}
              joined={hasJoined || loading}
            />
          </div>

          {/* ── Drawer de chat ─────────────────────────────────────── */}
          <div className={`room-chat-drawer${chatOpen ? ' open' : ''}`} aria-label="Chat de la sala">
            <div className="room-chat-header">
              <h3>💬 Chat</h3>
              <button
                className="room-chat-close"
                type="button"
                onClick={() => setChatOpen(false)}
                aria-label="Cerrar chat"
              >×</button>
            </div>

            <div
              className="room-chat-messages"
              ref={chatMessagesRef}
              onScroll={handleChatScroll}
              aria-live="polite"
              aria-relevant="additions"
              aria-label="Mensajes"
            >
              {messages.length === 0 ? (
                <div className="room-chat-empty">
                  <span style={{ fontSize: 28 }}>💬</span>
                  <span>Aún no hay mensajes.<br />¡Sé el primero!</span>
                </div>
              ) : messages.map((msg) => {
                const mine = msg.senderUid === user?.uid
                return (
                  <div
                    key={msg.id || msg.clientMessageId || `${msg.senderUid}-${msg.createdAt}`}
                    className={`chat-msg${mine ? ' mine' : ''}`}
                  >
                    <div className="chat-msg-header">
                      <span className="chat-msg-sender">{mine ? 'Tú' : msg.senderName}</span>
                      <span className="chat-msg-time">{formatTime(msg.createdAt) || 'Ahora'}</span>
                    </div>
                    <div className="chat-msg-bubble">{msg.text}</div>
                  </div>
                )
              })}
              <div ref={chatBottomRef} />
            </div>

            <form className="room-chat-input-row" onSubmit={handleSend}>
              <label htmlFor="chat-input" className="sr-only">Mensaje</label>
              <input
                id="chat-input"
                className="room-chat-input"
                type="text"
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder={hasJoined ? 'Escribe un mensaje...' : 'Conectando...'}
                maxLength={1000}
                disabled={!hasJoined}
                autoComplete="off"
              />
              <button
                className="room-chat-send"
                type="submit"
                disabled={!canSend}
                aria-label="Enviar mensaje"
              >
                ➤
              </button>
            </form>
          </div>
        </div>

        {/* ── Barra de controles inferior ─────────────────────────── */}
        <div className="room-bottombar">
          {/* Micrófono */}
          <button
            className={`room-ctrl-btn mic${isMuted ? ' off' : ''}`}
            type="button"
            onClick={toggleMute}
            disabled={!peerReady}
            aria-pressed={isMuted}
            title={isMuted ? 'Activar micrófono' : 'Silenciar'}
          >
            <span aria-hidden="true">{isMuted ? '🔇' : '🎤'}</span>
            {isMuted ? 'Micrófono' : 'Micrófono'}
          </button>

          {/* Cámara */}
          <button
            className={`room-ctrl-btn cam${isCameraOff ? ' off' : ''}`}
            type="button"
            onClick={toggleCamera}
            disabled={!peerReady}
            aria-pressed={isCameraOff}
            title={isCameraOff ? 'Activar cámara' : 'Apagar cámara'}
          >
            <span aria-hidden="true">{isCameraOff ? '📷' : '🎥'}</span>
            Cámara
          </button>

          {/* Chat toggle */}
          <button
            className={`room-ctrl-btn chat-toggle${chatOpen ? ' active' : ''}`}
            type="button"
            onClick={() => setChatOpen((v) => !v)}
            aria-pressed={chatOpen}
            title={chatOpen ? 'Cerrar chat' : 'Abrir chat'}
          >
            <span aria-hidden="true">💬</span>
            Chat
          </button>

          {/* Salir */}
          <button
            className="room-ctrl-btn leave"
            type="button"
            onClick={() => navigate('/salas')}
            title="Salir de la sala"
          >
            <span aria-hidden="true">✕</span>
            Salir
          </button>
        </div>
      </div>

      {/* ── Modal de información de la sala ─────────────────────── */}
      {infoOpen && (
        <div
          className="room-info-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Información de la sala"
          onClick={(e) => { if (e.target === e.currentTarget) setInfoOpen(false) }}
        >
          <div className="room-info-modal">
            <div className="room-info-modal-header">
              <h2>ℹ Información de la sala</h2>
              <button
                className="room-info-close"
                type="button"
                onClick={() => setInfoOpen(false)}
                aria-label="Cerrar"
              >×</button>
            </div>

            {loading ? (
              <p style={{ color: '#64748b', fontSize: 14 }}>Cargando información...</p>
            ) : room ? (
              <>
                <div className="room-info-grid">
                  <div className="room-info-card">
                    <span className="room-info-card-label">Nombre</span>
                    <span className="room-info-card-value">{room.name}</span>
                    <span className="room-info-card-sub">{room.description || 'Sin descripción'}</span>
                  </div>

                  <div className="room-info-card">
                    <span className="room-info-card-label">ID único</span>
                    <span className="room-info-card-value">{visibleCode || room.id}</span>
                    {visibleCode && (
                      <button
                        className="room-info-copy-btn"
                        type="button"
                        onClick={() => handleCopy(visibleCode, 'ID')}
                      >
                        Copiar ID
                      </button>
                    )}
                  </div>

                  <div className="room-info-card">
                    <span className="room-info-card-label">Participantes</span>
                    <span className="room-info-card-value">{participantTotal} / {room.maxParticipants ?? 10}</span>
                    <span className="room-info-card-sub">{room.isPrivate ? '🔒 Sala privada' : '🌐 Sala pública'}</span>
                  </div>

                  <div className="room-info-card">
                    <span className="room-info-card-label">Creada</span>
                    <span className="room-info-card-value">{formatDate(room.createdAt)}</span>
                    <span className="room-info-card-sub">Anfitrión: {room.hostName || myDisplayName}</span>
                  </div>

                  <div className="room-info-card" style={{ gridColumn: '1 / -1' }}>
                    <span className="room-info-card-label">Tu rol</span>
                    <span className="room-info-card-value">{isHost ? '👑 Anfitrión' : '👤 Invitado'}</span>
                    <span className="room-info-card-sub">Estado: {socketState}</span>
                  </div>
                </div>

                {error && <div className="room-info-error">⚠ {error}</div>}
                {copied && <p className="room-info-status" style={{ color: '#22c55e' }}>✓ {copied}</p>}
              </>
            ) : (
              <p style={{ color: '#64748b', fontSize: 14 }}>No se encontró la sala.</p>
            )}
          </div>
        </div>
      )}
    </AppLayout>
  )
}

export default RoomDetail
