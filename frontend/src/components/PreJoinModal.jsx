/**
 * PreJoinModal.jsx — Vista previa al estilo Google Meet
 *
 * Fixes:
 *  1. El <video> SIEMPRE está en el DOM (oculto) para que videoRef.current
 *     exista cuando el stream llega async. No se desmonta al apagar cámara.
 *  2. Al apagar cámara en el preview, se desactiva el track pero el stream
 *     sigue vivo → useWebRTC recibe los estados correctos al entrar.
 *  3. useWebRTC recibe initialCameraOff / initialMuted y aplica los tracks
 *     inmediatamente — sin doble request de permisos.
 */
import { useEffect, useRef, useState } from 'react'
import '../styles/PreJoinModal.css'

export function PreJoinModal({ roomName, onJoin, onCancel }) {
  const videoRef  = useRef(null)
  const streamRef = useRef(null)

  const [cameraOn, setCameraOn] = useState(true)
  const [micOn,    setMicOn]    = useState(true)
  const [loading,  setLoading]  = useState(true)
  const [camError, setCamError] = useState('')

  /* ── 1. Pedir permisos y arrancar stream ───────────────────── */
  useEffect(() => {
    let active = true

    const startMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        if (!active) { stream.getTracks().forEach(t => t.stop()); return }
        streamRef.current = stream
        // videoRef.current YA existe porque el <video> está siempre en el DOM
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play().catch(() => {})
        }
      } catch {
        try {
          const audioOnly = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
          if (!active) { audioOnly.getTracks().forEach(t => t.stop()); return }
          streamRef.current = audioOnly
          setCameraOn(false)
          setCamError('Cámara no disponible. Puedes entrar solo con audio.')
        } catch {
          if (active) {
            setCameraOn(false)
            setCamError('Sin acceso a cámara ni micrófono. Revisa los permisos del navegador.')
          }
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

  /* ── 2. Apagar/encender tracks SIN destruir el stream ─────── */
  const toggleCamera = () => {
    const next = !cameraOn
    setCameraOn(next)
    streamRef.current?.getVideoTracks().forEach(t => { t.enabled = next })
  }

  const toggleMic = () => {
    const next = !micOn
    setMicOn(next)
    streamRef.current?.getAudioTracks().forEach(t => { t.enabled = next })
  }

  /* ── 3. Entrar: pasar preferencias a useWebRTC ─────────────── */
  const handleJoin = () => {
    // Detener preview — useWebRTC abrirá su propio stream
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    onJoin({ cameraOn, micOn })
  }

  const camUnavailable = camError.includes('no disponible') || camError.includes('Sin acceso')

  return (
    <div className="pj-overlay" role="dialog" aria-modal="true" aria-label="Vista previa antes de entrar">
      <div className="pj-card">

        {/* Título */}
        <div className="pj-header">
          <span className="pj-badge">🎥</span>
          <div>
            <h2 className="pj-title">¿Listo para unirte?</h2>
            <p className="pj-subtitle">{roomName || 'Sala de estudio'}</p>
          </div>
        </div>

        {/* Preview */}
        <div className="pj-preview-wrap">
          {/* Spinner mientras carga */}
          {loading && (
            <div className="pj-preview-overlay">
              <div className="pj-spinner" />
              <span>Iniciando cámara…</span>
            </div>
          )}

          {/* Avatar cuando cámara apagada (encima del video) */}
          {!loading && !cameraOn && (
            <div className="pj-preview-overlay">
              <span className="pj-cam-off-icon">📷</span>
              <span>Cámara apagada</span>
            </div>
          )}

          {/* 
            El <video> SIEMPRE está en el DOM para que videoRef.current exista
            cuando el stream llega de forma asíncrona.
            Se oculta visualmente cuando la cámara está apagada o cargando.
          */}
          <video
            ref={videoRef}
            className={`pj-preview-video${!loading && cameraOn ? ' visible' : ''}`}
            autoPlay
            muted
            playsInline
          />

          {/* Badge "Tú" */}
          {!loading && <div className="pj-preview-name-badge">Tú</div>}

          {/* Chips de estado */}
          {!loading && (
            <div className="pj-preview-status">
              {!micOn    && <span className="pj-status-chip mic-off">🔇 Silenciado</span>}
              {!cameraOn && <span className="pj-status-chip cam-off">📷 Sin cámara</span>}
            </div>
          )}
        </div>

        {/* Error */}
        {camError && <div className="pj-media-error" role="alert">⚠ {camError}</div>}

        {/* Controles */}
        <div className="pj-controls">
          <button
            className={`pj-ctrl-btn${micOn ? '' : ' off'}`}
            type="button"
            onClick={toggleMic}
            aria-pressed={!micOn}
            title={micOn ? 'Silenciar micrófono' : 'Activar micrófono'}
          >
            <span className="pj-ctrl-icon">{micOn ? '🎤' : '🔇'}</span>
            <span className="pj-ctrl-label">{micOn ? 'Micrófono activo' : 'Silenciado'}</span>
          </button>

          <button
            className={`pj-ctrl-btn${cameraOn ? '' : ' off'}`}
            type="button"
            onClick={toggleCamera}
            disabled={camUnavailable}
            aria-pressed={!cameraOn}
            title={cameraOn ? 'Apagar cámara' : 'Activar cámara'}
          >
            <span className="pj-ctrl-icon">{cameraOn ? '🎥' : '📷'}</span>
            <span className="pj-ctrl-label">{cameraOn ? 'Cámara activa' : 'Cámara apagada'}</span>
          </button>
        </div>

        {/* Acciones */}
        <div className="pj-actions">
          <button className="pj-btn-cancel" type="button" onClick={onCancel}>
            Cancelar
          </button>
          <button className="pj-btn-join" type="button" onClick={handleJoin} disabled={loading}>
            {loading ? 'Preparando…' : 'Unirme ahora'}
          </button>
        </div>

        <p className="pj-privacy-note">
          Solo los participantes de la sala podrán verte y escucharte.
        </p>
      </div>
    </div>
  )
}
