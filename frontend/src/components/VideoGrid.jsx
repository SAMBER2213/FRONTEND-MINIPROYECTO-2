/**
 * VideoGrid.jsx — Sprint 4 (US-09, US-12)
 *
 * Cuadrícula dinámica de videos que se adapta al número de participantes.
 * Muestra el video local y todos los streams remotos.
 * Indica visualmente si alguien tiene cámara o micrófono apagados.
 */
import { useEffect, useRef } from 'react'
import '../styles/VideoGrid.css'

function VideoTile({ stream, displayName, isMuted, isCameraOff, isLocal }) {
  const videoRef = useRef(null)

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream
    }
  }, [stream])

  const initial = (displayName || 'U').charAt(0).toUpperCase()

  return (
    <div className={`video-tile ${isCameraOff || !stream ? 'cam-off' : ''} ${isLocal ? 'local' : ''}`}>
      {isCameraOff || !stream ? (
        <div className="video-avatar" aria-label={`${displayName} sin cámara`}>
          <span>{initial}</span>
        </div>
      ) : (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          aria-label={`Video de ${displayName}`}
        />
      )}
      <div className="video-tile-footer">
        <span className="video-name">{isLocal ? 'Tú' : displayName}</span>
        <div className="video-status-icons" aria-hidden="true">
          {isMuted     && <span className="status-icon muted"    title="Micrófono apagado">🔇</span>}
          {isCameraOff && <span className="status-icon cam-icon" title="Cámara apagada">📷</span>}
        </div>
      </div>
    </div>
  )
}

export function VideoGrid({ localStream, remoteStreams, isMuted, isCameraOff, displayName }) {
  const total = 1 + remoteStreams.length
  const gridClass = `video-grid count-${Math.min(total, 9)}`

  return (
    <section className="video-grid-wrapper" aria-label="Cuadrícula de video de participantes">
      <div className={gridClass}>
        {/* Video local */}
        <VideoTile
          stream={localStream}
          displayName={displayName}
          isMuted={isMuted}
          isCameraOff={isCameraOff}
          isLocal
        />
        {/* Videos remotos */}
        {remoteStreams.map(({ peerId, displayName: remoteName, stream, isMuted: rMuted, isCameraOff: rCamOff }) => (
          <VideoTile
            key={peerId}
            stream={stream}
            displayName={remoteName || 'Participante'}
            isMuted={rMuted}
            isCameraOff={rCamOff}
            isLocal={false}
          />
        ))}
      </div>
    </section>
  )
}

export function VideoControls({ isMuted, isCameraOff, onToggleMute, onToggleCamera, peerReady, mediaError }) {
  return (
    <div className="video-controls" role="toolbar" aria-label="Controles de video">
      {mediaError && (
        <p className="video-media-error" role="alert">{mediaError}</p>
      )}
      <button
        className={`video-ctrl-btn ${isMuted ? 'active' : ''}`}
        type="button"
        onClick={onToggleMute}
        disabled={!peerReady}
        aria-pressed={isMuted}
        title={isMuted ? 'Activar micrófono' : 'Silenciar'}
      >
        {isMuted ? '🔇 Activar mic' : '🎤 Silenciar'}
      </button>
      <button
        className={`video-ctrl-btn ${isCameraOff ? 'active' : ''}`}
        type="button"
        onClick={onToggleCamera}
        disabled={!peerReady}
        aria-pressed={isCameraOff}
        title={isCameraOff ? 'Activar cámara' : 'Apagar cámara'}
      >
        {isCameraOff ? '📷 Activar cam' : '🎥 Apagar cam'}
      </button>
      {!peerReady && !mediaError && (
        <span className="video-connecting">Conectando video P2P...</span>
      )}
    </div>
  )
}