/**
 * PreJoinModal.jsx
 *
 * Pantalla de previsualización antes de entrar a la sala,
 * al estilo Google Meet: muestra el feed de cámara en vivo,
 * permite silenciar/apagar cámara y confirmar la entrada.
 */
import { useEffect, useRef, useState } from 'react'
import '../styles/PreJoinModal.css'

export function PreJoinModal({ roomName, onJoin, onCancel }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)

  const [cameraOn, setCameraOn]   = useState(true)
  const [micOn,    setMicOn]      = useState(true)
  const [loading,  setLoading]    = useState(true)
  const [camError, setCamError]   = useState('')

  /* ── Solicitar acceso a medios ─────────────────────────────── */
  useEffect(() => {
    let active = true

    const startMedia = async () => {
      setLoading(true)
      setCamError('')
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        })
        if (!active) { stream.getTracks().forEach(t => t.stop()); return }
        streamRef.current = stream
        if (videoRef.current) videoRef.current.srcObject = stream
      } catch {
        // Intentar solo audio si la cámara falla
        try {
          const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
          if (!active) { audioStream.getTracks().forEach(t => t.stop()); return }
          streamRef.current = audioStream
          setCameraOn(false)
          setCamError('Cámara no disponible. Puedes entrar solo con audio.')
        } catch {
          if (active) setCamError('No se pudo acceder a cámara ni micrófono. Verifica los permisos.')
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    startMedia()

    return () => {
      active = false
      streamRef.current?.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
  }, [])

  /* ── Sincronizar tracks al cambiar toggles ─────────────────── */
  useEffect(() => {
    const stream = streamRef.current
    if (!stream) return
    stream.getVideoTracks().forEach(t => { t.enabled = cameraOn })
  }, [cameraOn])

  useEffect(() => {
    const stream = streamRef.current
    if (!stream) return
    stream.getAudioTracks().forEach(t => { t.enabled = micOn })
  }, [micOn])

  /* ── Confirmar entrada ─────────────────────────────────────── */
  const handleJoin = () => {
    // Detener el stream de preview — useWebRTC creará el suyo propio
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    onJoin({ cameraOn, micOn })
  }

  const hasVideo = cameraOn && !camError.includes('no disponible') && !camError.includes('no se pudo')

  return (
    <div className="pj-overlay" role="dialog" aria-modal="true" aria-label="Vista previa antes de entrar">
      <div className="pj-card">

        {/* ── Título ──────────────────────────────────────────── */}
        <div className="pj-header">
          <span className="pj-badge">🎥</span>
          <div>
            <h2 className="pj-title">Listo para unirte?</h2>
            <p className="pj-subtitle">{roomName || 'Sala de estudio'}</p>
          </div>
        </div>

        {/* ── Preview de cámara ────────────────────────────────── */}
        <div className="pj-preview-wrap">
          {loading && (
            <div className="pj-preview-placeholder">
              <div className="pj-spinner" />
              <span>Iniciando cámara…</span>
            </div>
          )}

          {!loading && hasVideo && (
            <video
              ref={videoRef}
              className="pj-preview-video"
              autoPlay
              muted
              playsInline
            />
          )}

          {!loading && !hasVideo && (
            <div className="pj-preview-placeholder">
              <span className="pj-cam-off-icon">📷</span>
              <span>Cámara apagada</span>
            </div>
          )}

          {/* Overlay con nombre */}
          {!loading && (
            <div className="pj-preview-name-badge">Tú</div>
          )}

          {/* Indicadores de estado encima del video */}
          {!loading && (
            <div className="pj-preview-status">
              {!micOn    && <span className="pj-status-chip">🔇 Silenciado</span>}
              {!cameraOn && <span className="pj-status-chip">📷 Cámara off</span>}
            </div>
          )}
        </div>

        {/* ── Error de media ───────────────────────────────────── */}
        {camError && (
          <div className="pj-media-error" role="alert">⚠ {camError}</div>
        )}

        {/* ── Controles de cámara y micrófono ─────────────────── */}
        <div className="pj-controls">
          <button
            className={`pj-ctrl-btn${micOn ? '' : ' off'}`}
            type="button"
            onClick={() => setMicOn(v => !v)}
            aria-pressed={!micOn}
            title={micOn ? 'Silenciar micrófono' : 'Activar micrófono'}
          >
            <span className="pj-ctrl-icon">{micOn ? '🎤' : '🔇'}</span>
            <span className="pj-ctrl-label">{micOn ? 'Micrófono' : 'Silenciado'}</span>
          </button>

          <button
            className={`pj-ctrl-btn${cameraOn ? '' : ' off'}`}
            type="button"
            onClick={() => setCameraOn(v => !v)}
            disabled={camError.includes('no disponible') || camError.includes('no se pudo')}
            aria-pressed={!cameraOn}
            title={cameraOn ? 'Apagar cámara' : 'Activar cámara'}
          >
            <span className="pj-ctrl-icon">{cameraOn ? '🎥' : '📷'}</span>
            <span className="pj-ctrl-label">{cameraOn ? 'Cámara' : 'Cámara off'}</span>
          </button>
        </div>

        {/* ── Botones de acción ────────────────────────────────── */}
        <div className="pj-actions">
          <button
            className="pj-btn-cancel"
            type="button"
            onClick={onCancel}
          >
            Cancelar
          </button>

          <button
            className="pj-btn-join"
            type="button"
            onClick={handleJoin}
            disabled={loading}
          >
            {loading ? 'Preparando…' : 'Unirme ahora'}
          </button>
        </div>

        {/* ── Indicación de privacidad ─────────────────────────── */}
        <p className="pj-privacy-note">
          Solo los participantes de la sala podrán ver y escucharte.
        </p>
      </div>
    </div>
  )
}
