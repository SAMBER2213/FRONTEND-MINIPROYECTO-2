/**
 * VideoGrid.jsx — Sprint 4 (US-09, US-12)
 *
 * Grid de video estilo Google Meet:
 * - Borde VERDE = hablando (detectado por AudioContext / VAD)
 * - Borde AZUL  = silencioso / en sala
 * - Avatar con iniciales cuando la cámara está apagada
 * - Grid dinámico 1→2→3→4 columnas según cantidad de participantes
 */
import { useEffect, useRef, useState, useCallback } from 'react'
import '../styles/RoomDetail.css'

/* ── Paleta de colores para avatares ─────────────────────────────── */
const AVATAR_COLORS = ['av-blue','av-green','av-purple','av-orange','av-pink','av-teal','av-red','av-indigo']
function avatarColor(uid = '') {
  let h = 0
  for (let i = 0; i < uid.length; i++) h = (h * 31 + uid.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

/* ── Hook: detecta actividad de voz en un MediaStream (VAD simple) ── */
function useVoiceActivity(stream, isMuted) {
  const [speaking, setSpeaking]   = useState(false)
  const analyserRef               = useRef(null)
  const sourceRef                 = useRef(null)
  const ctxRef                    = useRef(null)
  const rafRef                    = useRef(null)
  const frameCountRef             = useRef(0)

  useEffect(() => {
    if (!stream || isMuted) { setSpeaking(false); return }
    const audioTracks = stream.getAudioTracks()
    if (!audioTracks.length) return

    let mounted = true

    const setup = () => {
      try {
        const ctx      = new (window.AudioContext || window.webkitAudioContext)()
        const source   = ctx.createMediaStreamSource(stream)
        const analyser = ctx.createAnalyser()
        analyser.fftSize            = 512
        analyser.smoothingTimeConstant = 0.7
        source.connect(analyser)
        ctxRef.current     = ctx
        sourceRef.current  = source
        analyserRef.current = analyser

        const data = new Uint8Array(analyser.frequencyBinCount)
        const THRESHOLD = 14  // sensibilidad (0–255)
        const DEBOUNCE  = 4   // frames consecutivos para confirmar

        let consecutiveAbove = 0
        let consecutiveBelow = 0

        const loop = () => {
          if (!mounted) return
          analyser.getByteFrequencyData(data)
          const avg = data.reduce((a, b) => a + b, 0) / data.length

          if (avg > THRESHOLD) {
            consecutiveAbove++
            consecutiveBelow = 0
            if (consecutiveAbove >= DEBOUNCE) setSpeaking(true)
          } else {
            consecutiveBelow++
            consecutiveAbove = 0
            if (consecutiveBelow >= DEBOUNCE * 3) setSpeaking(false)
          }

          rafRef.current = requestAnimationFrame(loop)
        }
        rafRef.current = requestAnimationFrame(loop)
      } catch { /* navegador no soporta WebAudio */ }
    }

    setup()

    return () => {
      mounted = false
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      try {
        sourceRef.current?.disconnect()
        ctxRef.current?.close()
      } catch { /* ignore */ }
      setSpeaking(false)
    }
  }, [stream, isMuted])

  return speaking
}

/* ── Tile de un participante ─────────────────────────────────────── */
function VideoTile({ stream, displayName, uid, isMuted, isCameraOff, isLocal }) {
  const videoRef  = useRef(null)
  const speaking  = useVoiceActivity(isLocal ? stream : stream, isMuted || isCameraOff === undefined ? isMuted : false)
  const showCam   = stream && !isCameraOff
  const initial   = (displayName || 'U').charAt(0).toUpperCase()
  const color     = avatarColor(uid || displayName || '')

  // Determinar clase de borde según actividad de voz
  const voiceClass = isMuted ? 'voice-idle' : (speaking ? 'voice-active' : 'voice-idle')

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    video.srcObject = stream || null
  }, [stream])

  return (
    <div className={`vg-tile-meet ${isLocal ? 'local' : ''} ${voiceClass}`}>
      <video
        ref={videoRef}
        className={`vg-meet-video${showCam ? ' visible' : ''}`}
        autoPlay
        playsInline
        muted={isLocal}
        aria-label={`Video de ${displayName}`}
      />

      {!showCam && (
        <div className={`vg-meet-avatar ${color}`} aria-hidden="true">
          {initial}
        </div>
      )}

      <div className="vg-meet-footer">
        <span className="vg-meet-name">{isLocal ? `${displayName} (Tú)` : displayName}</span>
        <div className="vg-meet-badges" aria-hidden="true">
          {isMuted     && <span className="vg-meet-badge muted-badge"   title="Micrófono apagado">🔇</span>}
          {isCameraOff && <span className="vg-meet-badge"               title="Cámara apagada">📷</span>}
        </div>
      </div>
    </div>
  )
}

/* ── Calcula columnas óptimas (estilo Meet) ──────────────────────── */
function getCols(n) {
  if (n === 1) return 1
  if (n <= 4)  return 2
  if (n <= 9)  return 3
  return 4
}

/* ── Grid principal ──────────────────────────────────────────────── */
export function VideoGrid({ localStream, remoteStreams, isMuted, isCameraOff, displayName, myUid, joined }) {
  const total = 1 + remoteStreams.length
  const cols  = getCols(total)

  if (!joined) {
    return (
      <div className="vg-empty-state">
        <span className="vg-empty-icon">🎥</span>
        <p>Conectando a la sala...</p>
      </div>
    )
  }

  return (
    <div className="vg-grid-meet" style={{ '--vg-cols': cols }}>
      <VideoTile
        stream={localStream}
        displayName={displayName}
        uid={myUid}
        isMuted={isMuted}
        isCameraOff={isCameraOff}
        isLocal
      />
      {remoteStreams.map(({ peerId, uid, displayName: rName, stream, isMuted: rMuted, isCameraOff: rCamOff }) => (
        <VideoTile
          key={peerId}
          stream={stream}
          displayName={rName || 'Participante'}
          uid={uid}
          isMuted={rMuted}
          isCameraOff={rCamOff}
          isLocal={false}
        />
      ))}
    </div>
  )
}

export default VideoGrid
