/**
 * VideoGrid.jsx
 * Con replaceTrack para screen share: el participante que comparte pantalla
 * se resalta en un tile grande. Los demás ven su pantalla en ese tile.
 * Fix iconos: isMuted/isCameraOff vienen del estado real del servidor.
 */
import { useEffect, useRef, useState, useCallback } from 'react'
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
      <rect x="9" y="2" width="6" height="11" rx="3" fill="currentColor" opacity="0.6"/>
      <path d="M5 10a7 7 0 0 0 14 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.6"/>
      <line x1="12" y1="17" x2="12" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.6"/>
      <line x1="9" y1="21" x2="15" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.6"/>
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
      <rect x="2" y="6" width="14" height="12" rx="2" fill="currentColor" opacity="0.6"/>
      <path d="M16 10l5-3v10l-5-3V10z" fill="currentColor" opacity="0.6"/>
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
      const ctx      = new (window.AudioContext || window.webkitAudioContext)()
      const source   = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 512
      analyser.smoothingTimeConstant = 0.7
      source.connect(analyser)
      refs.current = { ctx, source, analyser }
      const data = new Uint8Array(analyser.frequencyBinCount)
      const THRESH = 14, DEB = 4
      let above = 0, below = 0
      const loop = () => {
        if (!mounted) return
        analyser.getByteFrequencyData(data)
        const avg = data.reduce((a, b) => a + b, 0) / data.length
        if (avg > THRESH) { above++; below = 0; if (above >= DEB) setSpeaking(true) }
        else              { below++; above = 0; if (below >= DEB * 3) setSpeaking(false) }
        refs.current.raf = requestAnimationFrame(loop)
      }
      refs.current.raf = requestAnimationFrame(loop)
    } catch { /**/ }
    return () => {
      mounted = false
      if (refs.current.raf) cancelAnimationFrame(refs.current.raf)
      try { refs.current.source?.disconnect(); refs.current.ctx?.close() } catch { /**/ }
      setSpeaking(false)
    }
  }, [stream, isMuted])
  return speaking
}

/* ── Video tile ──────────────────────────────────────────────────── */
function VideoTile({ stream, displayName, uid, isMuted, isCameraOff, isLocal, photoURL, isSharing, onFullscreen }) {
  const videoRef = useRef(null)
  const speaking = useVoiceActivity(stream, isMuted)
  const showCam  = Boolean(stream && !isCameraOff)
  const initial  = (displayName || 'U').charAt(0).toUpperCase()
  const color    = avatarColor(uid || displayName || '')
  const voiceCls = (!isMuted && speaking) ? 'voice-active' : 'voice-idle'
  const hasPhoto = typeof photoURL === 'string' && photoURL.startsWith('http')

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    video.srcObject = stream || null
    if (stream) video.play().catch(() => {})
  }, [stream])

  return (
    <div className={`vg-tile ${isLocal ? 'vg-local' : ''} ${voiceCls} ${isSharing ? 'vg-sharing' : ''}`}>
      <video
        ref={videoRef}
        className={`vg-video${showCam ? ' vg-visible' : ''}`}
        autoPlay playsInline muted={isLocal}
        style={isSharing ? { transform: 'none', objectFit: 'contain' } : undefined}
      />
      {!showCam && !isSharing && (
        <div className={`vg-avatar-wrap ${!hasPhoto ? color : ''}`} aria-hidden="true">
          {hasPhoto
            ? <img src={photoURL} alt={displayName} className="vg-avatar-photo" />
            : <span className="vg-avatar-initial">{initial}</span>
          }
        </div>
      )}
      {isSharing && (
        <div className="vg-screen-label">
          <svg viewBox="0 0 24 24" fill="none" width="12" height="12">
            <rect x="2" y="3" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="2"/>
            <path d="M8 21h8M12 17v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          {displayName} está compartiendo pantalla
        </div>
      )}
      {isSharing && onFullscreen && (
        <div className="vg-screen-actions">
          <button className="vg-screen-btn" onClick={onFullscreen} title="Pantalla completa">
            <svg viewBox="0 0 24 24" fill="none" width="12" height="12">
              <path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Pantalla completa
          </button>
        </div>
      )}
      <div className="vg-footer">
        <span className="vg-name">{isLocal ? `${displayName} (Tú)` : displayName}</span>
        <div className="vg-badges" aria-hidden="true">
          <span className={`vg-badge-icon ${isMuted ? 'badge-off' : 'badge-on'}`}><MicIcon active={!isMuted} /></span>
          <span className={`vg-badge-icon ${isCameraOff ? 'badge-off' : 'badge-on'}`}><CamIcon active={!isCameraOff} /></span>
        </div>
      </div>
      {speaking && !isMuted && <div className="vg-speaking-ring" aria-hidden="true" />}
    </div>
  )
}

function getLayout(n) {
  if (n === 1) return { cols: 1, solo: true }
  if (n === 2) return { cols: 2, solo: false }
  if (n <= 4)  return { cols: 2, solo: false }
  if (n <= 6)  return { cols: 3, solo: false }
  if (n <= 9)  return { cols: 3, solo: false }
  return       { cols: 4, solo: false }
}

/* ── Grid principal ──────────────────────────────────────────────── */
export function VideoGrid({
  localStream, remoteStreams,
  isMuted, isCameraOff,
  displayName, myUid, joined, myPhotoURL,
  isScreenSharing,      // yo estoy compartiendo
  sharingUid,           // uid del participante remoto que comparte (si aplica)
}) {
  const videoRef = useRef(null)

  const handleFullscreen = useCallback((videoEl) => {
    if (videoEl && videoEl.requestFullscreen) videoEl.requestFullscreen()
  }, [])

  const total = 1 + (remoteStreams?.length || 0)
  const { cols, solo } = getLayout(total)

  // ¿Hay alguien compartiendo pantalla? (remoto, via socket event)
  const sharingRemote = sharingUid ? (remoteStreams || []).find((s) => s.uid === sharingUid) : null

  if (!joined) {
    return (
      <div className="vg-empty">
        <div className="vg-empty-icon"><CamIcon active={false} /></div>
        <p>Conectando a la sala...</p>
      </div>
    )
  }

  // Si alguien (remoto o yo) comparte pantalla, ese tile va primero y grande
  const hasScreenShare = isScreenSharing || Boolean(sharingRemote)

  return (
    <div className={`vg-root${hasScreenShare ? ' vg-has-screen' : ''}`}>
      {/* Si hay screen share remoto, va primero arriba grande */}
      {sharingRemote && (
        <div className="vg-screen-featured">
          <VideoTile
            stream={sharingRemote.stream}
            displayName={sharingRemote.displayName}
            uid={sharingRemote.uid}
            isMuted={sharingRemote.isMuted}
            isCameraOff={false}
            isLocal={false}
            photoURL={sharingRemote.photoURL}
            isSharing={true}
            onFullscreen={() => {
              const v = document.getElementById(`vg-video-featured`)
              if (v?.requestFullscreen) v.requestFullscreen()
            }}
          />
        </div>
      )}

      {/* Si yo comparto, mi tile va primero arriba grande */}
      {isScreenSharing && !sharingRemote && (
        <div className="vg-screen-featured">
          <VideoTile
            stream={localStream}
            displayName={displayName}
            uid={myUid}
            isMuted={isMuted}
            isCameraOff={false}
            isLocal={true}
            photoURL={myPhotoURL}
            isSharing={true}
          />
        </div>
      )}

      {/* Grid de participantes */}
      <div
        className={`vg-grid${solo && !hasScreenShare ? ' vg-grid-solo' : ''}`}
        style={{ '--vg-cols': hasScreenShare ? Math.min(cols, 4) : cols }}
        data-count={total}
      >
        {/* Mi tile (local) — si estoy compartiendo ya aparece arriba, aquí va pequeño */}
        <VideoTile
          stream={localStream}
          displayName={displayName}
          uid={myUid}
          isMuted={isMuted}
          isCameraOff={isCameraOff}
          isLocal
          photoURL={myPhotoURL}
          isSharing={false}
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
            isSharing={false}
          />
        ))}
      </div>
    </div>
  )
}

export default VideoGrid
