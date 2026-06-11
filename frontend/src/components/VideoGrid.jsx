/**
 * VideoGrid.jsx — Grid dinámico estilo Google Meet
 *
 * Layout adaptativo:
 *   1 persona  → tile centrado ocupa ~70% del ancho
 *   2 personas → 2 columnas lado a lado
 *   3-4        → 2 columnas, tiles cuadrados/16:9
 *   5-6        → 3 columnas
 *   7-9        → 3 columnas
 *   10+        → 4 columnas
 *
 * Los tiles siempre llenan el espacio disponible (height: 100%)
 * usando CSS grid con rows automáticas, igual que Meet.
 */
import { useEffect, useRef, useState, useCallback } from 'react'
import '../styles/VideoGrid.css'

/* ── Paleta de colores para avatares ─────────────────────────────── */
const AVATAR_COLORS = ['av-blue','av-green','av-purple','av-orange','av-pink','av-teal','av-red','av-indigo']
function avatarColor(uid = '') {
  let h = 0
  for (let i = 0; i < uid.length; i++) h = (h * 31 + uid.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

/* ── Hook VAD (Voice Activity Detection) ─────────────────────────── */
function useVoiceActivity(stream, isMuted) {
  const [speaking, setSpeaking] = useState(false)
  const refs = useRef({})

  useEffect(() => {
    if (!stream || isMuted) { setSpeaking(false); return }
    const audioTracks = stream.getAudioTracks()
    if (!audioTracks.length) return

    let mounted = true
    try {
      const ctx      = new (window.AudioContext || window.webkitAudioContext)()
      const source   = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 512
      analyser.smoothingTimeConstant = 0.7
      source.connect(analyser)
      refs.current = { ctx, source, analyser }

      const data  = new Uint8Array(analyser.frequencyBinCount)
      const THRESH = 14, DEB = 4
      let above = 0, below = 0

      const loop = () => {
        if (!mounted) return
        analyser.getByteFrequencyData(data)
        const avg = data.reduce((a, b) => a + b, 0) / data.length
        if (avg > THRESH) { above++; below = 0; if (above >= DEB)     setSpeaking(true)  }
        else              { below++; above = 0; if (below >= DEB * 3) setSpeaking(false) }
        refs.current.raf = requestAnimationFrame(loop)
      }
      refs.current.raf = requestAnimationFrame(loop)
    } catch { /* WebAudio no disponible */ }

    return () => {
      mounted = false
      if (refs.current.raf) cancelAnimationFrame(refs.current.raf)
      try { refs.current.source?.disconnect(); refs.current.ctx?.close() } catch { /**/ }
      setSpeaking(false)
    }
  }, [stream, isMuted])

  return speaking
}

/* ── Tile individual ─────────────────────────────────────────────── */
function VideoTile({ stream, displayName, uid, isMuted, isCameraOff, isLocal }) {
  const videoRef = useRef(null)
  const speaking = useVoiceActivity(stream, isMuted)
  const showCam  = Boolean(stream && !isCameraOff)
  const initial  = (displayName || 'U').charAt(0).toUpperCase()
  const color    = avatarColor(uid || displayName || '')
  const voiceCls = isMuted ? 'voice-idle' : (speaking ? 'voice-active' : 'voice-idle')

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    video.srcObject = stream || null
    if (stream) video.play().catch(() => {})
  }, [stream])

  return (
    <div className={`vg-tile ${isLocal ? 'vg-local' : ''} ${voiceCls}`}>
      {/* Video siempre montado para que srcObject funcione */}
      <video
        ref={videoRef}
        className={`vg-video${showCam ? ' vg-visible' : ''}`}
        autoPlay
        playsInline
        muted={isLocal}
        aria-label={`Video de ${displayName}`}
      />

      {/* Avatar cuando cámara off */}
      {!showCam && (
        <div className={`vg-avatar ${color}`} aria-hidden="true">
          {initial}
        </div>
      )}

      {/* Footer con nombre y badges */}
      <div className="vg-footer">
        <span className="vg-name">{isLocal ? `${displayName} (Tú)` : displayName}</span>
        <div className="vg-badges" aria-hidden="true">
          {isMuted     && <span className="vg-badge vg-badge-muted"  title="Micrófono apagado">🔇</span>}
          {isCameraOff && <span className="vg-badge"                 title="Cámara apagada">📷</span>}
        </div>
      </div>

      {/* Indicador de voz activa */}
      {speaking && !isMuted && <div className="vg-speaking-ring" aria-hidden="true" />}
    </div>
  )
}

/* ── Calcular layout según número de tiles ───────────────────────── */
function getLayout(n) {
  if (n === 1) return { cols: 1, solo: true }
  if (n === 2) return { cols: 2, solo: false }
  if (n <= 4)  return { cols: 2, solo: false }
  if (n <= 6)  return { cols: 3, solo: false }
  if (n <= 9)  return { cols: 3, solo: false }
  return       { cols: 4, solo: false }
}

/* ── Grid principal ──────────────────────────────────────────────── */
export function VideoGrid({ localStream, remoteStreams, isMuted, isCameraOff, displayName, myUid, joined }) {
  const total = 1 + (remoteStreams?.length || 0)
  const { cols, solo } = getLayout(total)

  if (!joined) {
    return (
      <div className="vg-empty">
        <div className="vg-empty-icon">🎥</div>
        <p>Conectando a la sala...</p>
      </div>
    )
  }

  return (
    <div
      className={`vg-grid${solo ? ' vg-grid-solo' : ''}`}
      style={{ '--vg-cols': cols }}
      data-count={total}
    >
      <VideoTile
        stream={localStream}
        displayName={displayName}
        uid={myUid}
        isMuted={isMuted}
        isCameraOff={isCameraOff}
        isLocal
      />
      {(remoteStreams || []).map(({ peerId, uid, displayName: rName, stream, isMuted: rMuted, isCameraOff: rCamOff }) => (
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
