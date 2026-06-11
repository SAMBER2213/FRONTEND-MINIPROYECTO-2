/**
 * VideoGrid.jsx — Grid dinámico estilo Google Meet
 *
 * Fixes:
 *  1. Avatar = foto de perfil real (photoURL) cuando cámara apagada
 *  2. Nombres correctos por participante (no se repiten)
 *  3. Iconos SVG minimalistas estilo Google Meet (verde=activo, rojo=desactivado)
 */
import { useEffect, useRef, useState, useCallback } from 'react'
import '../styles/VideoGrid.css'

/* ── Paleta de colores para avatares sin foto ────────────────────── */
const AVATAR_COLORS = ['av-blue','av-green','av-purple','av-orange','av-pink','av-teal','av-red','av-indigo']
function avatarColor(uid = '') {
  let h = 0
  for (let i = 0; i < uid.length; i++) h = (h * 31 + uid.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

/* ── Iconos SVG minimalistas ─────────────────────────────────────── */
function MicIcon({ active }) {
  if (active) {
    return (
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="14" height="14">
        <rect x="9" y="2" width="6" height="11" rx="3" fill="currentColor"/>
        <path d="M5 10a7 7 0 0 0 14 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        <line x1="12" y1="17" x2="12" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        <line x1="9" y1="21" x2="15" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="14" height="14">
      <rect x="9" y="2" width="6" height="11" rx="3" fill="currentColor" opacity="0.7"/>
      <path d="M5 10a7 7 0 0 0 14 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.7"/>
      <line x1="12" y1="17" x2="12" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.7"/>
      <line x1="9" y1="21" x2="15" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.7"/>
      <line x1="3" y1="3" x2="21" y2="21" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
    </svg>
  )
}

function CamIcon({ active }) {
  if (active) {
    return (
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="14" height="14">
        <rect x="2" y="6" width="14" height="12" rx="2" fill="currentColor"/>
        <path d="M16 10l5-3v10l-5-3V10z" fill="currentColor"/>
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="14" height="14">
      <rect x="2" y="6" width="14" height="12" rx="2" fill="currentColor" opacity="0.7"/>
      <path d="M16 10l5-3v10l-5-3V10z" fill="currentColor" opacity="0.7"/>
      <line x1="3" y1="3" x2="21" y2="21" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
    </svg>
  )
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
function VideoTile({ stream, displayName, uid, isMuted, isCameraOff, isLocal, photoURL }) {
  const videoRef = useRef(null)
  const speaking = useVoiceActivity(stream, isMuted)
  const showCam  = Boolean(stream && !isCameraOff)
  const initial  = (displayName || 'U').charAt(0).toUpperCase()
  const color    = avatarColor(uid || displayName || '')
  const voiceCls = isMuted ? 'voice-idle' : (speaking ? 'voice-active' : 'voice-idle')

  // ¿Tiene foto de perfil válida?
  const hasPhoto = typeof photoURL === 'string' && photoURL.startsWith('http')

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    video.srcObject = stream || null
    if (stream) video.play().catch(() => {})
  }, [stream])

  return (
    <div className={`vg-tile ${isLocal ? 'vg-local' : ''} ${voiceCls}`}>
      {/* Video siempre montado */}
      <video
        ref={videoRef}
        className={`vg-video${showCam ? ' vg-visible' : ''}`}
        autoPlay
        playsInline
        muted={isLocal}
        aria-label={`Video de ${displayName}`}
      />

      {/* Avatar cuando cámara off — foto de perfil o inicial */}
      {!showCam && (
        <div className={`vg-avatar-wrap ${!hasPhoto ? color : ''}`} aria-hidden="true">
          {hasPhoto
            ? <img src={photoURL} alt={displayName} className="vg-avatar-photo" />
            : <span className="vg-avatar-initial">{initial}</span>
          }
        </div>
      )}

      {/* Footer con nombre y badges */}
      <div className="vg-footer">
        <span className="vg-name">{isLocal ? `${displayName} (Tú)` : displayName}</span>
        <div className="vg-badges" aria-hidden="true">
          <span className={`vg-badge-icon ${isMuted ? 'badge-off' : 'badge-on'}`} title={isMuted ? 'Micrófono apagado' : 'Micrófono activo'}>
            <MicIcon active={!isMuted} />
          </span>
          <span className={`vg-badge-icon ${isCameraOff ? 'badge-off' : 'badge-on'}`} title={isCameraOff ? 'Cámara apagada' : 'Cámara activa'}>
            <CamIcon active={!isCameraOff} />
          </span>
        </div>
      </div>

      {/* Anillo de voz activa */}
      {speaking && !isMuted && <div className="vg-speaking-ring" aria-hidden="true" />}
    </div>
  )
}

/* ── Layout ──────────────────────────────────────────────────────── */
function getLayout(n) {
  if (n === 1) return { cols: 1, solo: true }
  if (n === 2) return { cols: 2, solo: false }
  if (n <= 4)  return { cols: 2, solo: false }
  if (n <= 6)  return { cols: 3, solo: false }
  if (n <= 9)  return { cols: 3, solo: false }
  return       { cols: 4, solo: false }
}

/* ── Grid principal ──────────────────────────────────────────────── */
export function VideoGrid({ localStream, remoteStreams, isMuted, isCameraOff, displayName, myUid, joined, myPhotoURL }) {
  const total = 1 + (remoteStreams?.length || 0)
  const { cols, solo } = getLayout(total)

  if (!joined) {
    return (
      <div className="vg-empty">
        <div className="vg-empty-icon">
          <CamIcon active={false} />
        </div>
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
        photoURL={myPhotoURL}
      />
      {(remoteStreams || []).map(({ peerId, uid, displayName: rName, stream, isMuted: rMuted, isCameraOff: rCamOff, photoURL: rPhoto }) => (
        <VideoTile
          key={peerId}
          stream={stream}
          displayName={rName || 'Participante'}
          uid={uid}
          isMuted={rMuted}
          isCameraOff={rCamOff}
          isLocal={false}
          photoURL={rPhoto}
        />
      ))}
    </div>
  )
}

export default VideoGrid
