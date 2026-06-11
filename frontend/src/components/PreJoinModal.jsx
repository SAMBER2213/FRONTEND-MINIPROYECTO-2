/**
 * PreJoinModal.jsx — Dashboard de pre-entrada estilo Google Meet
 *
 * Diseño completamente nuevo:
 *  - Layout de dos columnas: preview grande a la izquierda, controles a la derecha
 *  - Cámara funciona exactamente igual que en la sala
 *  - Iconos SVG minimalistas (sin emojis)
 *  - Al confirmar, pasa estados cameraOn/micOn a la sala
 */
import { useEffect, useRef, useState } from 'react'
import '../styles/PreJoinModal.css'

/* ── Iconos SVG minimalistas ─────────────────────────────────────── */
function MicIcon({ active }) {
  return active ? (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="22" height="22">
      <rect x="9" y="2" width="6" height="11" rx="3" fill="currentColor"/>
      <path d="M5 10a7 7 0 0 0 14 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <line x1="12" y1="17" x2="12" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <line x1="9" y1="21" x2="15" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="22" height="22">
      <rect x="9" y="2" width="6" height="11" rx="3" fill="currentColor" opacity="0.5"/>
      <path d="M5 10a7 7 0 0 0 14 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.5"/>
      <line x1="12" y1="17" x2="12" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.5"/>
      <line x1="9" y1="21" x2="15" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.5"/>
      <line x1="3" y1="3" x2="21" y2="21" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
    </svg>
  )
}

function CamIcon({ active }) {
  return active ? (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="22" height="22">
      <rect x="2" y="6" width="14" height="12" rx="2" fill="currentColor"/>
      <path d="M16 10l5-3v10l-5-3V10z" fill="currentColor"/>
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="22" height="22">
      <rect x="2" y="6" width="14" height="12" rx="2" fill="currentColor" opacity="0.5"/>
      <path d="M16 10l5-3v10l-5-3V10z" fill="currentColor" opacity="0.5"/>
      <line x1="3" y1="3" x2="21" y2="21" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
    </svg>
  )
}

export function PreJoinModal({ roomName, onJoin, onCancel }) {
  const videoRef  = useRef(null)
  const streamRef = useRef(null)

  const [cameraOn, setCameraOn] = useState(true)
  const [micOn,    setMicOn]    = useState(true)
  const [loading,  setLoading]  = useState(true)
  const [camError, setCamError] = useState('')

  /* ── Pedir permisos y arrancar stream ─────────────────────────── */
  useEffect(() => {
    let active = true

    const startMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        if (!active) { stream.getTracks().forEach(t => t.stop()); return }
        streamRef.current = stream
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
            setCamError('Sin acceso a cámara ni micrófono.')
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

  /* ── Toggle tracks ────────────────────────────────────────────── */
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

  /* ── Entrar ────────────────────────────────────────────────────── */
  const handleJoin = () => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    onJoin({ cameraOn, micOn })
  }

  const camUnavailable = camError.includes('no disponible') || camError.includes('Sin acceso')

  return (
    <div className="pj-overlay" role="dialog" aria-modal="true" aria-label="Vista previa antes de entrar">
      <div className="pj-dashboard">

        {/* ── Columna izquierda: preview de cámara ────────────── */}
        <div className="pj-left">
          <div className="pj-preview-wrap">
            {/* Spinner */}
            {loading && (
              <div className="pj-preview-overlay">
                <div className="pj-spinner" />
                <span>Iniciando cámara…</span>
              </div>
            )}

            {/* Overlay cámara apagada */}
            {!loading && !cameraOn && (
              <div className="pj-preview-overlay">
                <div className="pj-cam-off-circle">
                  <CamIcon active={false} />
                </div>
                <span>Cámara apagada</span>
              </div>
            )}

            {/* Video SIEMPRE en el DOM */}
            <video
              ref={videoRef}
              className={`pj-preview-video${!loading && cameraOn ? ' visible' : ''}`}
              autoPlay
              muted
              playsInline
            />

            {/* Badge nombre */}
            {!loading && <div className="pj-preview-name-badge">Vista previa</div>}

            {/* Chips de estado */}
            {!loading && (
              <div className="pj-preview-status">
                {!micOn    && <span className="pj-status-chip mic-off">Sin micrófono</span>}
                {!cameraOn && <span className="pj-status-chip cam-off">Sin cámara</span>}
              </div>
            )}
          </div>

          {/* Controles de cámara y micrófono bajo el preview */}
          <div className="pj-preview-controls">
            <button
              className={`pj-media-btn${micOn ? ' active' : ' off'}`}
              type="button"
              onClick={toggleMic}
              title={micOn ? 'Silenciar micrófono' : 'Activar micrófono'}
            >
              <MicIcon active={micOn} />
            </button>

            <button
              className={`pj-media-btn${cameraOn ? ' active' : ' off'}`}
              type="button"
              onClick={toggleCamera}
              disabled={camUnavailable}
              title={cameraOn ? 'Apagar cámara' : 'Activar cámara'}
            >
              <CamIcon active={cameraOn} />
            </button>
          </div>
        </div>

        {/* ── Columna derecha: info y acción ──────────────────── */}
        <div className="pj-right">
          <div className="pj-right-inner">
            <div className="pj-room-label">Vas a unirte a</div>
            <h2 className="pj-room-name">{roomName || 'Sala de estudio'}</h2>

            <div className="pj-device-status">
              <div className={`pj-device-row${micOn ? '' : ' off'}`}>
                <span className="pj-device-icon"><MicIcon active={micOn} /></span>
                <span className="pj-device-text">{micOn ? 'Micrófono activo' : 'Micrófono silenciado'}</span>
              </div>
              <div className={`pj-device-row${cameraOn ? '' : ' off'}`}>
                <span className="pj-device-icon"><CamIcon active={cameraOn} /></span>
                <span className="pj-device-text">{cameraOn ? 'Cámara activa' : 'Cámara apagada'}</span>
              </div>
            </div>

            {camError && <div className="pj-media-error" role="alert">⚠ {camError}</div>}

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

      </div>
    </div>
  )
}
