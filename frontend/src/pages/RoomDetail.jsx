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

/* ── Audio helpers ───────────────────────────────────────────────── */
function playTone(type = 'join') {
  try {
    const ctx  = new (window.AudioContext || window.webkitAudioContext)()
    const gain = ctx.createGain()
    gain.connect(ctx.destination)

    if (type === 'join') {
      // Pleasant ascending two-note chime
      const freqs = [523.25, 659.25] // C5, E5
      freqs.forEach((freq, i) => {
        const osc = ctx.createOscillator()
        osc.type = 'sine'
        osc.frequency.value = freq
        osc.connect(gain)
        gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.18)
        gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + i * 0.18 + 0.03)
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + i * 0.18 + 0.35)
        osc.start(ctx.currentTime + i * 0.18)
        osc.stop(ctx.currentTime + i * 0.18 + 0.4)
      })
    } else {
      // Descending two-note for leave
      const freqs = [659.25, 523.25]
      freqs.forEach((freq, i) => {
        const osc = ctx.createOscillator()
        osc.type = 'sine'
        osc.frequency.value = freq
        osc.connect(gain)
        gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.18)
        gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + i * 0.18 + 0.03)
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + i * 0.18 + 0.3)
        osc.start(ctx.currentTime + i * 0.18)
        osc.stop(ctx.currentTime + i * 0.18 + 0.35)
      })
    }
    setTimeout(() => ctx.close(), 2000)
  } catch { /**/ }
}

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

const AVATAR_COLORS = ['av-blue','av-green','av-purple','av-orange','av-pink','av-teal','av-red','av-indigo']
function avatarColor(uid = '') {
  let h = 0
  for (let i = 0; i < uid.length; i++) h = (h * 31 + uid.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

/* ── Screen Share Mini Window ────────────────────────────────────── */
function ScreenShareMiniWindow({ onStop, onReturn, onHide, roomName }) {
  return (
    <div className="screen-mini-window">
      <div className="screen-mini-header">
        <span className="screen-mini-dot" />
        <span className="screen-mini-label">Compartiendo pantalla</span>
        <button className="screen-mini-close" onClick={onHide} title="Ocultar">—</button>
      </div>
      <div className="screen-mini-body">
        <div className="screen-mini-room">{roomName}</div>
        <div className="screen-mini-actions">
          <button className="screen-mini-btn return" onClick={onReturn}>
            ↩ Volver a la llamada
          </button>
          <button className="screen-mini-btn stop" onClick={onStop}>
            ⊠ Dejar de compartir
          </button>
        </div>
      </div>
    </div>
  )
}



/* ── Floating PiP window when tab is hidden ──────────────────────── */
function FloatingCallWindow({ roomName, isMuted, isCameraOff, onReturn, onLeave, onToggleMute, onToggleCam, peerReady }) {
  return (
    <div className="floating-call-window">
      <div className="floating-call-header">
        <span className="floating-call-room">{roomName}</span>
        <button className="floating-call-leave" onClick={onLeave} title="Salir">✕</button>
      </div>
      <div className="floating-call-body">
        <div className="floating-call-info">📹 Llamada en curso</div>
        <div className="floating-call-controls">
          <button
            className={`floating-ctrl-btn${isMuted ? ' off' : ''}`}
            onClick={onToggleMute}
            disabled={!peerReady}
            title={isMuted ? 'Activar mic' : 'Silenciar'}
          >
            {isMuted ? '🎙️✕' : '🎙️'}
          </button>
          <button
            className={`floating-ctrl-btn${isCameraOff ? ' off' : ''}`}
            onClick={onToggleCam}
            disabled={!peerReady}
            title={isCameraOff ? 'Activar cámara' : 'Apagar cámara'}
          >
            {isCameraOff ? '📷✕' : '📷'}
          </button>
          <button className="floating-ctrl-btn return" onClick={onReturn} title="Volver a la llamada">
            ↩
          </button>
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════
   Componente principal
   ═══════════════════════════════════════════════════════════════════ */
function RoomDetail() {
  const { roomId }           = useParams()
  const { user, profile }    = useAuth()
  const navigate             = useNavigate()
  const location             = useLocation()

  const socketRef            = useRef(null)
  const chatMessagesRef      = useRef(null)
  const chatBottomRef        = useRef(null)
  const shouldStickRef       = useRef(true)
  const prevParticipantCount = useRef(0)
  const hasPlayedJoinSound   = useRef(false)

  const [showPreJoin,         setShowPreJoin]         = useState(true)
  const [initialMedia,        setInitialMedia]        = useState({ cameraOn: true, micOn: true })
  const [room,                setRoom]               = useState(null)
  const [participants,        setParticipants]        = useState([])
  const [loading,             setLoading]             = useState(true)
  const [hasJoined,           setHasJoined]           = useState(false)
  const [socketState,         setSocketState]         = useState('Conectando...')
  const [error,               setError]               = useState('')
  const [socket,              setSocket]              = useState(null)
  const [messages,            setMessages]            = useState([])
  const [messageText,         setMessageText]         = useState('')
  const [sending,             setSending]             = useState(false)
  const [chatOpen,            setChatOpen]            = useState(false)
  const [infoOpen,            setInfoOpen]            = useState(false)
  const [copied,              setCopied]              = useState('')
  const [miniWindowVisible,   setMiniWindowVisible]   = useState(true)
  const [isTabHidden,         setIsTabHidden]         = useState(false)
  const [sharingUid,          setSharingUid]          = useState(null)

  /* ── Scroll ──────────────────────────────────────────────────── */
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

  const navCode = typeof location.state?.roomCode === 'string' ? location.state.roomCode : ''

  /* ── WebRTC ──────────────────────────────────────────────────── */
  const {
    localStream, remoteStreams,
    isMuted, isCameraOff,
    mediaError, peerReady,
    toggleMute, toggleCamera,
    callExistingPeers,
    isScreenSharing, screenStream,
    startScreenShare, stopScreenShare,
  } = useWebRTC({
    socket, roomId, myUid: user?.uid,
    enabled: hasJoined && !showPreJoin,
    initialCameraOff: !initialMedia.cameraOn,
    initialMuted: !initialMedia.micOn,
    myDisplayName: profile?.displayName || user?.displayName || 'Yo',
    myPhotoURL: profile?.photoURL || user?.photoURL || null,
  })

  /* ── Tab visibility → floating window ───────────────────────── */
  useEffect(() => {
    if (!hasJoined) return
    const handleVis = () => setIsTabHidden(document.hidden)
    document.addEventListener('visibilitychange', handleVis)
    return () => document.removeEventListener('visibilitychange', handleVis)
  }, [hasJoined])

  /* ── Socket ──────────────────────────────────────────────────── */
  useEffect(() => {
    let mounted = true
    let socketInst = null

    const load = async () => {
      setLoading(true); setError(''); setHasJoined(false)
      setMessages([]); setParticipants([])

      try {
        const roomRes  = await getRoomById(user, roomId)
        if (!mounted) return
        const roomData = roomRes.data
        const code     = navCode || getStoredRoomCode(roomId) || roomData?.roomCode || ''

        setRoom(roomData)
        if (roomData?.roomCode) storeRoomCode(roomId, roomData.roomCode)
        setSocketState('Conectando al servidor...')

        try {
          const msgRes = await getRoomMessages(user, roomId, { limit: 75, roomCode: code })
          if (!mounted) return
          setMessages(msgRes.data || [])
        } catch { /**/ }

        const { createRealtimeClient: makeClient } = await import('../services/realtime')
        socketInst = makeClient()
        socketRef.current = socketInst

        const doJoin = async () => {
          if (!user || !mounted) return
          setSocketState('Validando acceso...')
          const token = await user.getIdToken()
          joinRoom(socketInst, roomId, token, code)
        }

        socketInst.on('connect',           doJoin)
        socketInst.on('connect_error',     () => { if (!mounted) return; setSocketState('Error de conexión.'); setError('No se pudo conectar.') })
        socketInst.on('reconnect_attempt', () => { if (!mounted) return; setHasJoined(false); setSocketState('Reconectando...') })

        socketInst.on('room_joined', (p) => {
          if (!mounted) return
          const parts = p.participants || []
          setParticipants(parts)
          setRoom((r) => r ? ({ ...r, participantCount: parts.length }) : r)
          setHasJoined(true)
          setSocketState('Conectado')
          setSocket(socketInst)
          prevParticipantCount.current = parts.length
          // Play join sound for myself (only once)
          if (!hasPlayedJoinSound.current) {
            hasPlayedJoinSound.current = true
            playTone('join')
          }
        })

        socketInst.on('participant_joined', (p) => {
          if (!mounted) return
          const parts = p.participants || []
          setParticipants(parts)
          setRoom((r) => r ? ({ ...r, participantCount: parts.length }) : r)
          // Play join sound for new participant
          if (parts.length > prevParticipantCount.current) playTone('join')
          prevParticipantCount.current = parts.length
        })

        socketInst.on('participant_left', (p) => {
          if (!mounted) return
          setParticipants((prev) => {
            const updated = prev.filter((x) => x.uid !== p.uid)
            setRoom((r) => r ? ({ ...r, participantCount: updated.length }) : r)
            prevParticipantCount.current = updated.length
            return updated
          })
          playTone('leave')
        })

        socketInst.on('media_state_update', (p) => {
          if (!mounted) return
          if (typeof p.isSharingScreen === 'boolean') {
            setSharingUid(p.isSharingScreen ? p.uid : null)
          }
        })

        socketInst.on('new_message',    (msg) => { if (!mounted) return; setMessages((prev) => appendUnique(prev, msg)); setSending(false); shouldStickRef.current = true })
        socketInst.on('message_saved',  () => { if (mounted) setSending(false) })
        socketInst.on('message_failed', (p) => { if (mounted) { setSending(false); setError(p?.message || 'Error al guardar.') } })
        socketInst.on('chat_error',     (p) => { if (mounted) { setSending(false); setError(p?.message || 'Error al enviar.') } })
        socketInst.on('disconnect',     () => { if (mounted) { setHasJoined(false); setSocketState('Desconectado.') } })
        socketInst.on('error',          (p) => { if (mounted) { setHasJoined(false); setError(p?.message || 'Error.') } })

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
      if (socketInst) { socketInst.emit('leave_room', { roomId }); socketInst.disconnect() }
      socketRef.current = null
      setSocket(null)
    }
  }, [user, roomId, navCode]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (peerReady && participants.length > 0) callExistingPeers(participants)
  }, [peerReady]) // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Screen share ────────────────────────────────────────────── */
  const handleScreenShareClick = async () => {
    if (isScreenSharing) {
      stopScreenShare()
    } else {
      await startScreenShare()
      setMiniWindowVisible(true)
    }
  }

  /* ── Derived ─────────────────────────────────────────────────── */
  const participantTotal = useMemo(() => participants.length || room?.participantCount || 0, [participants, room])
  const visibleCode      = room?.roomCode || navCode || getStoredRoomCode(roomId)
  const isHost           = room?.hostUid === user?.uid || room?.isHost
  const myDisplayName    = profile?.displayName || user?.displayName || 'Tú'
  const canSend          = hasJoined && !sending && Boolean(messageText.trim())

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
    if (!socketRef.current?.connected || !hasJoined) { setError('No estás conectado.'); return }
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

  const handlePreJoinConfirm = ({ cameraOn, micOn }) => {
    setInitialMedia({ cameraOn, micOn })
    setShowPreJoin(false)
  }

  const handlePreJoinCancel = () => { navigate('/salas') }

  const handleLeave = () => {
    if (isScreenSharing) stopScreenShare()
    navigate('/salas')
  }

  /* ═══════════════════════════════════════════════════════════════ */
  return (
    <AppLayout title={room?.name || 'Sala de estudio'} subtitle="">
      {showPreJoin && (
        <PreJoinModal
          roomName={room?.name || 'Sala de estudio'}
          onJoin={handlePreJoinConfirm}
          onCancel={handlePreJoinCancel}
        />
      )}

      {/* Screen share mini window */}
      {isScreenSharing && miniWindowVisible && (
        <ScreenShareMiniWindow
          roomName={room?.name || 'Sala de estudio'}
          onStop={() => { stopScreenShare(); setMiniWindowVisible(false) }}
          onReturn={() => { /* already on page */ }}
          onHide={() => setMiniWindowVisible(false)}
        />
      )}

      {/* Floating call window when tab hidden */}
      {isTabHidden && hasJoined && (
        <FloatingCallWindow
          roomName={room?.name || 'Sala de estudio'}
          isMuted={isMuted}
          isCameraOff={isCameraOff}
          peerReady={peerReady}
          onToggleMute={toggleMute}
          onToggleCam={toggleCamera}
          onReturn={() => { window.focus(); setIsTabHidden(false) }}
          onLeave={handleLeave}
        />
      )}

      <div className="room-shell">
        {/* ── Topbar ──────────────────────────────────────────────── */}
        <div className="room-topbar">
          <div className="room-topbar-left">
            <span className="room-topbar-name">{room?.name || 'Sala de estudio'}</span>
            {visibleCode && <span className="room-topbar-id">ID de la sala: {visibleCode}</span>}
          </div>

          <div className="room-participants-row" aria-label="Participantes conectados">
            {loading ? (
              <span style={{ fontSize: 12, color: '#64748b' }}>Cargando...</span>
            ) : participants.length === 0 ? (
              <span style={{ fontSize: 12, color: '#64748b' }}>Sin participantes aún</span>
            ) : participants.map((p) => {
              const initial  = (p.displayName || 'U').charAt(0).toUpperCase()
              const hasPhoto = typeof p.photoURL === 'string' && p.photoURL.startsWith('http')
              const color    = avatarColor(p.uid)
              const isMe     = p.uid === user?.uid
              return (
                <div key={p.uid} className="room-participant-thumb" title={p.displayName}>
                  <div className={`room-participant-avatar ${hasPhoto ? '' : color} voice-idle`}>
                    {hasPhoto ? <img src={p.photoURL} alt="" /> : initial}
                  </div>
                  <span className="room-participant-name">{isMe ? 'Tú' : p.displayName}</span>
                  <div className="room-participant-badges">
                    {p.isMuted     && <span className="room-participant-badge" title="Micrófono apagado"><svg viewBox="0 0 24 24" fill="none" width="11" height="11"><rect x="9" y="2" width="6" height="11" rx="3" fill="currentColor" opacity="0.7"/><path d="M5 10a7 7 0 0 0 14 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.7"/><line x1="12" y1="17" x2="12" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.7"/><line x1="9" y1="21" x2="15" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.7"/><line x1="3" y1="3" x2="21" y2="21" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/></svg></span>}
                    {p.isCameraOff && <span className="room-participant-badge" title="Cámara apagada"><svg viewBox="0 0 24 24" fill="none" width="11" height="11"><rect x="2" y="6" width="14" height="12" rx="2" fill="currentColor" opacity="0.7"/><path d="M16 10l5-3v10l-5-3V10z" fill="currentColor" opacity="0.7"/><line x1="3" y1="3" x2="21" y2="21" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/></svg></span>}
                  </div>
                </div>
              )
            })}
          </div>

          <div className="room-connected-count">
            <div className="room-connected-dot" />
            {participantTotal} {participantTotal === 1 ? 'conectado' : 'conectados'}
          </div>
        </div>

        {/* ── Main ────────────────────────────────────────────────── */}
        <div className="room-main">
          <div className="room-video-area">
            <div className={`room-connection-toast${hasJoined ? ' connected' : error ? ' error' : ''}`}>
              {hasJoined ? '● Conectado' : error ? `⚠ ${socketState}` : `⏳ ${socketState}`}
            </div>
            <button className="room-info-fab" type="button" title="Información de la sala"
              onClick={() => setInfoOpen(true)} aria-label="Ver información de la sala">?</button>
            {mediaError && <div className="room-media-error" role="alert">{mediaError}</div>}
            <VideoGrid
              localStream={localStream}
              remoteStreams={remoteStreams}
              isMuted={isMuted}
              isCameraOff={isCameraOff}
              displayName={myDisplayName}
              myUid={user?.uid}
              joined={hasJoined}
              myPhotoURL={profile?.photoURL || user?.photoURL || null}
              isScreenSharing={isScreenSharing}
              sharingUid={sharingUid}
            />
          </div>

          {/* ── Chat ──────────────────────────────────────────────── */}
          <div className={`room-chat-drawer${chatOpen ? ' open' : ''}`} aria-label="Chat de la sala">
            <div className="room-chat-header">
              <h3>💬 Chat</h3>
              <button className="room-chat-close" type="button" onClick={() => setChatOpen(false)} aria-label="Cerrar chat">×</button>
            </div>
            <div className="room-chat-messages" ref={chatMessagesRef} onScroll={handleChatScroll}
              aria-live="polite" aria-relevant="additions" aria-label="Mensajes">
              {messages.length === 0 ? (
                <div className="room-chat-empty">
                  <span style={{ fontSize: 28 }}>💬</span>
                  <span>Aún no hay mensajes.<br />¡Sé el primero!</span>
                </div>
              ) : messages.map((msg) => {
                const mine = msg.senderUid === user?.uid
                return (
                  <div key={msg.id || msg.clientMessageId || `${msg.senderUid}-${msg.createdAt}`}
                    className={`chat-msg${mine ? ' mine' : ''}`}>
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
              <input id="chat-input" className="room-chat-input" type="text" value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder={hasJoined ? 'Escribe un mensaje...' : 'Conectando...'}
                maxLength={1000} disabled={!hasJoined} autoComplete="off" />
              <button className="room-chat-send" type="submit" disabled={!canSend} aria-label="Enviar">➤</button>
            </form>
          </div>
        </div>

        {/* ── Bottom controls ──────────────────────────────────────── */}
        <div className="room-bottombar">
          {/* Mic */}
          <button className={`room-ctrl-btn mic${isMuted ? ' off' : ''}`} type="button"
            onClick={toggleMute} disabled={!peerReady} aria-pressed={isMuted}
            title={isMuted ? 'Activar micrófono' : 'Silenciar'}>
            <span className="room-ctrl-icon" aria-hidden="true">
              {isMuted ? (
                <svg viewBox="0 0 24 24" fill="none" width="20" height="20"><rect x="9" y="2" width="6" height="11" rx="3" fill="currentColor" opacity="0.7"/><path d="M5 10a7 7 0 0 0 14 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.7"/><line x1="12" y1="17" x2="12" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.7"/><line x1="9" y1="21" x2="15" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.7"/><line x1="3" y1="3" x2="21" y2="21" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/></svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" width="20" height="20"><rect x="9" y="2" width="6" height="11" rx="3" fill="currentColor"/><path d="M5 10a7 7 0 0 0 14 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><line x1="12" y1="17" x2="12" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><line x1="9" y1="21" x2="15" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
              )}
            </span>
            Micrófono
          </button>

          {/* Cam */}
          <button className={`room-ctrl-btn cam${isCameraOff ? ' off' : ''}`} type="button"
            onClick={toggleCamera} disabled={!peerReady} aria-pressed={isCameraOff}
            title={isCameraOff ? 'Activar cámara' : 'Apagar cámara'}>
            <span className="room-ctrl-icon" aria-hidden="true">
              {isCameraOff ? (
                <svg viewBox="0 0 24 24" fill="none" width="20" height="20"><rect x="2" y="6" width="14" height="12" rx="2" fill="currentColor" opacity="0.7"/><path d="M16 10l5-3v10l-5-3V10z" fill="currentColor" opacity="0.7"/><line x1="3" y1="3" x2="21" y2="21" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/></svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" width="20" height="20"><rect x="2" y="6" width="14" height="12" rx="2" fill="currentColor"/><path d="M16 10l5-3v10l-5-3V10z" fill="currentColor"/></svg>
              )}
            </span>
            Cámara
          </button>

          {/* Screen share */}
          <button
            className={`room-ctrl-btn screenshare${isScreenSharing ? ' active' : ''}`}
            type="button"
            onClick={handleScreenShareClick}
            disabled={!peerReady}
            title={isScreenSharing ? 'Dejar de compartir' : 'Compartir pantalla'}
          >
            <span className="room-ctrl-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" width="20" height="20">
                <rect x="2" y="3" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="2"/>
                <path d="M8 21h8M12 17v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                {isScreenSharing && <line x1="3" y1="3" x2="21" y2="21" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>}
              </svg>
            </span>
            {isScreenSharing ? 'Detener' : 'Pantalla'}
          </button>

          {/* Chat */}
          <button className={`room-ctrl-btn chat-toggle${chatOpen ? ' active' : ''}`} type="button"
            onClick={() => setChatOpen((v) => !v)} aria-pressed={chatOpen}
            title={chatOpen ? 'Cerrar chat' : 'Abrir chat'}>
            <span className="room-ctrl-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" width="20" height="20"><path d="M20 2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4l4 4 4-4h4a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z" fill="currentColor" opacity="0.85"/></svg>
            </span>
            Chat
          </button>

          {/* Leave */}
          <button className="room-ctrl-btn leave" type="button" onClick={handleLeave} title="Salir de la sala">
            <span className="room-ctrl-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" width="20" height="20"><path d="M16 17l5-5-5-5M21 12H9" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
            </span>
            Salir
          </button>
        </div>
      </div>

      {/* ── Info modal ───────────────────────────────────────────── */}
      {infoOpen && (
        <div className="room-info-overlay" role="dialog" aria-modal="true" aria-label="Información de la sala"
          onClick={(e) => { if (e.target === e.currentTarget) setInfoOpen(false) }}>
          <div className="room-info-modal">
            <div className="room-info-modal-header">
              <h2>ℹ Información de la sala</h2>
              <button className="room-info-close" type="button" onClick={() => setInfoOpen(false)} aria-label="Cerrar">×</button>
            </div>
            {loading ? (
              <p style={{ color: '#64748b', fontSize: 14 }}>Cargando...</p>
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
                      <button className="room-info-copy-btn" type="button" onClick={() => handleCopy(visibleCode, 'ID')}>Copiar ID</button>
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
                {error  && <div className="room-info-error">⚠ {error}</div>}
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
