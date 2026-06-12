/**
 * VideoGrid.jsx — Layout estilo Google Meet:
 * - Sin screen share: grid normal centrado
 * - Con screen share: pantalla grande izquierda, participantes columna derecha
 */
import { useEffect, useRef, useState } from 'react'
import '../styles/VideoGrid.css'

const AVATAR_COLORS = ['av-blue','av-green','av-purple','av-orange','av-pink','av-teal','av-red','av-indigo']
function avatarColor(uid = '') {
  let h = 0
  for (let i = 0; i < uid.length; i++) h = (h * 31 + uid.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

function MicIcon({ active }) {
  return active ? (
    <svg viewBox="0 0 24 24" fill="none" width="14" height="14">
      <rect x="9" y="2" width="6" height="11" rx="3" fill="currentColor"/>
      <path d="M5 10a7 7 0 0 0 14 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <line x1="12" y1="17" x2="12" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <line x1="9" y1="21" x2="15" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" fill="none" width="14" height="14">
      <rect x="9" y="2" width="6" height="11" rx="3" fill="currentColor" opacity="0.5"/>
      <path d="M5 10a7 7 0 0 0 14 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.5"/>
      <line x1="12" y1="17" x2="12" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.5"/>
      <line x1="9" y1="21" x2="15" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.5"/>
      <line x1="3" y1="3" x2="21" y2="21" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
    </svg>
  )
}

function CamIcon({ active }) {
  return active ? (
    <svg viewBox="0 0 24 24" fill="none" width="14" height="14">
      <rect x="2" y="6" width="14" height="12" rx="2" fill="currentColor"/>
      <path d="M16 10l5-3v10l-5-3V10z" fill="currentColor"/>
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" fill="none" width="14" height="14">
      <rect x="2" y="6" width="14" height="12" rx="2" fill="currentColor" opacity="0.5"/>
      <path d="M16 10l5-3v10l-5-3V10z" fill="currentColor" opacity="0.5"/>
      <line x1="3" y1="3" x2="21" y2="21" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
    </svg>
  )
}

function useVoiceActivity(stream, isMuted) {
  const [speaking, setSpeaking] = useState(false)
  const refs = useRef({})
  useEffect(() => {
    if (!stream || isMuted) { setSpeaking(false); return }
    if (!stream.getAudioTracks().length) return
    let mounted = true
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      const src = ctx.createMediaStreamSource(stream)
      const an  = ctx.createAnalyser()
      an.fftSize = 512; an.smoothingTimeConstant = 0.7
      src.connect(an)
      refs.current = { ctx, src, an }
      const data = new Uint8Array(an.frequencyBinCount)
      let above = 0, below = 0
      const loop = () => {
        if (!mounted) return
        an.getByteFrequencyData(data)
        const avg = data.reduce((a, b) => a + b, 0) / data.length
        if (avg > 14) { above++; below = 0; if (above >= 4) setSpeaking(true) }
        else          { below++; above = 0; if (below >= 12) setSpeaking(false) }
        refs.current.raf = requestAnimationFrame(loop)
      }
      refs.current.raf = requestAnimationFrame(loop)
    } catch { /**/ }
    return () => {
      mounted = false
      if (refs.current.raf) cancelAnimationFrame(refs.current.raf)
      try { refs.current.src?.disconnect(); refs.current.ctx?.close() } catch { /**/ }
      setSpeaking(false)
    }
  }, [stream, isMuted])
  return speaking
}

/* ── Screen tile: pantalla compartida grande ─────────────────────── */
function ScreenTile({ stream, displayName, onFullscreen }) {
  const videoRef = useRef(null)
  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    v.srcObject = stream || null
    if (stream) v.play().catch(() => {})
  }, [stream])

  return (
    <div className="vg-screen-main">
      <video ref={videoRef} className="vg-screen-video" autoPlay playsInline muted />
      <div className="vg-screen-badge">
        <svg viewBox="0 0 24 24" fill="none" width="13" height="13">
          <rect x="2" y="3" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="2"/>
          <path d="M8 21h8M12 17v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
        {displayName} está compartiendo pantalla
      </div>
      {onFullscreen && (
        <button className="vg-screen-fullscreen" onClick={onFullscreen} title="Pantalla completa">
          <svg viewBox="0 0 24 24" fill="none" width="14" height="14">
            <path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Pantalla completa
        </button>
      )}
    </div>
  )
}

/* ── Participant tile ─────────────────────────────────────────────── */
function VideoTile({ stream, displayName, uid, isMuted, isCameraOff, isLocal, photoURL, compact }) {
  const videoRef = useRef(null)
  const speaking = useVoiceActivity(stream, isMuted)
  const showCam  = Boolean(stream && !isCameraOff)
  const initial  = (displayName || 'U').charAt(0).toUpperCase()
  const color    = avatarColor(uid || displayName || '')
  const hasPhoto = typeof photoURL === 'string' && photoURL.startsWith('http')
  const voiceCls = (!isMuted && speaking) ? 'voice-active' : 'voice-idle'

  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    v.srcObject = stream || null
    if (stream) v.play().catch(() => {})
  }, [stream])

  return (
    <div className={`vg-tile ${isLocal ? 'vg-local' : ''} ${voiceCls} ${compact ? 'vg-compact' : ''}`}>
      <video
        ref={videoRef}
        className={`vg-video${showCam ? ' vg-visible' : ''}`}
        autoPlay playsInline muted={isLocal}
      />
      {!showCam && (
        <div className={`vg-avatar-wrap ${!hasPhoto ? color : ''}`}>
          {hasPhoto
            ? <img src={photoURL} alt={displayName} className="vg-avatar-photo" />
            : <span className="vg-avatar-initial">{initial}</span>
          }
        </div>
      )}
      <div className="vg-footer">
        <span className="vg-name">{isLocal ? `${displayName} (Tú)` : displayName}</span>
        <div className="vg-badges">
          <span className={`vg-badge-icon ${isMuted ? 'badge-off' : 'badge-on'}`}><MicIcon active={!isMuted} /></span>
          <span className={`vg-badge-icon ${isCameraOff ? 'badge-off' : 'badge-on'}`}><CamIcon active={!isCameraOff} /></span>
        </div>
      </div>
      {speaking && !isMuted && <div className="vg-speaking-ring" />}
    </div>
  )
}

function getLayout(n) {
  if (n === 1) return { cols: 1, solo: true }
  if (n === 2) return { cols: 2 }
  if (n <= 4)  return { cols: 2 }
  if (n <= 9)  return { cols: 3 }
  return       { cols: 4 }
}

/* ── Grid principal ──────────────────────────────────────────────── */
export function VideoGrid({
  localStream, screenStream, remoteStreams,
  isMuted, isCameraOff, displayName, myUid, joined, myPhotoURL,
  isScreenSharing,
}) {
  // Separar streams de pantalla (remotos) de streams de video
  const remoteScreens = (remoteStreams || []).filter((s) => s.isScreen)
  const remoteVideos  = (remoteStreams || []).filter((s) => !s.isScreen)

  // ¿Hay alguna pantalla compartida? (mía o remota)
  const activeScreen = isScreenSharing
    ? { stream: screenStream, displayName, uid: myUid, isLocal: true }
    : remoteScreens.length > 0
      ? { stream: remoteScreens[0].stream, displayName: remoteScreens[0].displayName, uid: remoteScreens[0].uid, isLocal: false }
      : null

  const hasScreen = Boolean(activeScreen)
  const total = 1 + remoteVideos.length
  const { cols, solo } = getLayout(total)

  if (!joined) {
    return (
      <div className="vg-empty">
        <div className="vg-empty-icon"><CamIcon active={false} /></div>
        <p>Conectando a la sala...</p>
      </div>
    )
  }

  // ── Layout con pantalla compartida (estilo Google Meet) ──────────
  if (hasScreen) {
    return (
      <div className="vg-meet-layout">
        {/* Pantalla grande izquierda */}
        <ScreenTile
          stream={activeScreen.stream}
          displayName={activeScreen.displayName}
          onFullscreen={!activeScreen.isLocal ? () => {
            const v = document.querySelector('.vg-screen-video')
            if (v?.requestFullscreen) v.requestFullscreen()
          } : null}
        />
        {/* Participantes en columna derecha */}
        <div className="vg-sidebar">
          <VideoTile
            stream={localStream}
            displayName={displayName}
            uid={myUid}
            isMuted={isMuted}
            isCameraOff={isCameraOff}
            isLocal
            photoURL={myPhotoURL}
            compact
          />
          {remoteVideos.map(({ key, uid, displayName: rName, stream, isMuted: rM, isCameraOff: rC, photoURL: rP }) => (
            <VideoTile
              key={key}
              stream={stream}
              displayName={rName || 'Participante'}
              uid={uid}
              isMuted={rM}
              isCameraOff={rC}
              isLocal={false}
              photoURL={rP}
              compact
            />
          ))}
        </div>
      </div>
    )
  }

  // ── Layout normal sin pantalla ───────────────────────────────────
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
      {remoteVideos.map(({ key, uid, displayName: rName, stream, isMuted: rM, isCameraOff: rC, photoURL: rP }) => (
        <VideoTile
          key={key}
          stream={stream}
          displayName={rName || 'Participante'}
          uid={uid}
          isMuted={rM}
          isCameraOff={rC}
          isLocal={false}
          photoURL={rP}
        />
      ))}
    </div>
  )
}

export default VideoGrid
