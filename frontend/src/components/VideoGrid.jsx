/**
 * VideoGrid.jsx — Sprint 4 (US-09, US-12)
 *
 * Cuadrícula dinámica de videos estilo Google Meet / Zoom.
 * Se adapta al número de participantes con un grid responsivo.
 * Muestra avatares con iniciales cuando la cámara está apagada.
 * Controles de micrófono y cámara accesibles.
 */
import { useEffect, useRef } from 'react'
import '../styles/VideoGrid.css'

function VideoTile({ stream, displayName, isMuted, isCameraOff, isLocal }) {
  const videoRef = useRef(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    if (stream) {
      video.srcObject = stream
    } else {
      video.srcObject = null
    }
  }, [stream])

  const initial  = (displayName || 'U').charAt(0).toUpperCase()
  const showCam  = stream && !isCameraOff

  return (
    <div className={`vg-tile${isCameraOff || !stream ? ' cam-off' : ''}${isLocal ? ' local' : ''}`}>
      {/* Video element — siempre en DOM para evitar re-montajes */}
      <video
        ref={videoRef}
        className={`vg-video${showCam ? ' visible' : ''}`}
        autoPlay
        playsInline
        muted={isLocal}
        aria-label={`Video de ${displayName}`}
      />

      {/* Avatar cuando no hay cámara */}
      {(!showCam) && (
        <div className="vg-avatar" aria-hidden="true">
          <span>{initial}</span>
        </div>
      )}

      {/* Footer con nombre e iconos */}
      <div className="vg-footer">
        <span className="vg-name">{isLocal ? `${displayName} (Tú)` : displayName}</span>
        <div className="vg-badges" aria-hidden="true">
          {isMuted     && <span className="vg-badge muted"   title="Micrófono apagado">🔇</span>}
          {isCameraOff && <span className="vg-badge cam-off" title="Cámara apagada">📷</span>}
        </div>
      </div>
    </div>
  )
}

// Calcula columnas óptimas para n participantes (estilo Meet)
function getGridCols(n) {
  if (n === 1) return 1
  if (n === 2) return 2
  if (n <= 4)  return 2
  if (n <= 6)  return 3
  if (n <= 9)  return 3
  return 4
}

export function VideoGrid({ localStream, remoteStreams, isMuted, isCameraOff, displayName }) {
  const all   = [null, ...remoteStreams] // null = local
  const total = all.length
  const cols  = getGridCols(total)

  return (
    <section
      className="vg-wrapper"
      aria-label="Cuadrícula de video de participantes"
      style={{ '--vg-cols': cols }}
    >
      <VideoTile
        stream={localStream}
        displayName={displayName}
        isMuted={isMuted}
        isCameraOff={isCameraOff}
        isLocal
      />
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
    </section>
  )
}

export function VideoControls({ isMuted, isCameraOff, onToggleMute, onToggleCamera, peerReady, mediaError }) {
  return (
    <div className="vg-controls" role="toolbar" aria-label="Controles de video">
      {mediaError && (
        <p className="vg-media-error" role="alert">{mediaError}</p>
      )}

      <div className="vg-controls-row">
        <button
          className={`vg-ctrl-btn${isMuted ? ' active' : ''}`}
          type="button"
          onClick={onToggleMute}
          disabled={!peerReady}
          aria-pressed={isMuted}
          title={isMuted ? 'Activar micrófono' : 'Silenciar micrófono'}
        >
          <span className="vg-ctrl-icon" aria-hidden="true">{isMuted ? '🔇' : '🎤'}</span>
          <span className="vg-ctrl-label">{isMuted ? 'Activar mic' : 'Silenciar'}</span>
        </button>

        <button
          className={`vg-ctrl-btn${isCameraOff ? ' active' : ''}`}
          type="button"
          onClick={onToggleCamera}
          disabled={!peerReady}
          aria-pressed={isCameraOff}
          title={isCameraOff ? 'Activar cámara' : 'Apagar cámara'}
        >
          <span className="vg-ctrl-icon" aria-hidden="true">{isCameraOff ? '📷' : '🎥'}</span>
          <span className="vg-ctrl-label">{isCameraOff ? 'Activar cam' : 'Apagar cam'}</span>
        </button>

        {!peerReady && !mediaError && (
          <span className="vg-connecting" role="status">
            <span className="vg-spinner" aria-hidden="true" />
            Iniciando video P2P...
          </span>
        )}

        {peerReady && (
          <span className="vg-live-dot" aria-label="Video P2P activo">
            <span aria-hidden="true">●</span> En vivo
          </span>
        )}
      </div>
    </div>
  )
}
