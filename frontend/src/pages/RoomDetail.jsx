import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import AppLayout from '../layouts/AppLayout'
import { useAuth } from '../context/useAuth'
import { getApiErrorMessage, getRoomById } from '../services/api'
import { createRealtimeClient } from '../services/realtime'
import '../styles/Rooms.css'

function formatDate(value) {
  if (!value) return 'Sin fecha'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function copyText(value) {
  if (!value) return Promise.resolve()
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(value)
  return Promise.resolve()
}

function RoomDetail() {
  const { roomId } = useParams()
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [room, setRoom] = useState(null)
  const [participants, setParticipants] = useState([])
  const [loading, setLoading] = useState(true)
  const [socketState, setSocketState] = useState('Conectando...')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState('')

  useEffect(() => {
    let isMounted = true
    let socket = null

    const loadRoom = async () => {
      setLoading(true)
      setError('')
      setCopied('')

      try {
        const response = await getRoomById(user, roomId)
        if (!isMounted) return

        setRoom(response.data)
        setParticipants([])
        setSocketState('Conectando al servidor en tiempo real...')

        socket = createRealtimeClient()

        socket.on('connect', async () => {
          if (!user) return
          const token = await user.getIdToken()
          socket.emit('join_room', { roomId, token })
        })

        socket.on('room_joined', (payload) => {
          if (!isMounted) return
          setParticipants(payload.participants || [])
          setRoom((current) => current ? ({
            ...current,
            participantCount: (payload.participants || []).length,
          }) : current)
          setSocketState('Conectado por WebSockets. La sala está lista para presencia en tiempo real.')
        })

        socket.on('participant_joined', (payload) => {
          if (!isMounted) return
          setParticipants(payload.participants || [])
          setRoom((current) => current ? ({
            ...current,
            participantCount: (payload.participants || []).length,
          }) : current)
        })

        socket.on('participant_left', (payload) => {
          if (!isMounted) return
          setParticipants((current) => {
            const updated = current.filter((participant) => participant.uid !== payload.uid)
            setRoom((previous) => previous ? ({
              ...previous,
              participantCount: updated.length,
            }) : previous)
            return updated
          })
        })

        socket.on('disconnect', () => {
          if (!isMounted) return
          setSocketState('Desconectado del servidor en tiempo real.')
        })

        socket.on('error', (payload) => {
          if (!isMounted) return
          setError(payload?.message || 'Ocurrió un error en la conexión de tiempo real.')
        })
      } catch (err) {
        if (!isMounted) return
        setError(getApiErrorMessage(err))
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    if (user && roomId) {
      loadRoom()
    }

    return () => {
      isMounted = false
      if (socket) {
        socket.emit('leave_room', { roomId })
        socket.disconnect()
      }
    }
  }, [user, roomId])

  const participantTotal = useMemo(() => {
    if (participants.length > 0) return participants.length
    return room?.participantCount ?? 0
  }, [participants, room])

  const handleCopy = async (value, label) => {
    try {
      await copyText(value)
      setCopied(`${label} copiado correctamente.`)
    } catch {
      setCopied(`No se pudo copiar el ${label.toLowerCase()}.`)
    }
  }

  return (
    <AppLayout
      title={room?.name || 'Detalle de sala'}
      subtitle="Sala creada en Sprint 2 con ID único, presencia inicial y conexión base por WebSockets."
    >
      <div className="room-detail-grid">
        <section className="rooms-panel" aria-labelledby="room-overview-title">
          <div className="rooms-panel-header">
            <div>
              <h2 id="room-overview-title">Información general</h2>
              <p>El anfitrión entra a la sala inmediatamente después de crearla.</p>
            </div>
            <button className="secondary-btn" type="button" onClick={() => navigate('/salas')}>
              Volver a salas
            </button>
          </div>

          {loading ? (
            <div className="rooms-empty-state">Cargando sala...</div>
          ) : room ? (
            <>
              <div className="room-info-grid">
                <article className="room-info-card">
                  <span className="room-info-label">Nombre</span>
                  <strong>{room.name}</strong>
                  <p>{room.description || 'Sin descripción registrada.'}</p>
                </article>

                <article className="room-info-card">
                  <span className="room-info-label">ID único</span>
                  <strong>{room.roomCode || room.id}</strong>
                  <button className="link-btn" type="button" onClick={() => handleCopy(room.roomCode || room.id, 'ID único')}>
                    Copiar ID
                  </button>
                </article>

                <article className="room-info-card">
                  <span className="room-info-label">ID interno</span>
                  <strong>{room.id}</strong>
                  <button className="link-btn" type="button" onClick={() => handleCopy(room.id, 'ID interno')}>
                    Copiar ID interno
                  </button>
                </article>

                <article className="room-info-card">
                  <span className="room-info-label">Capacidad</span>
                  <strong>{participantTotal} / {room.maxParticipants ?? 10}</strong>
                  <p>{room.isPrivate ? 'Sala privada' : 'Sala pública'}</p>
                </article>
              </div>

              <div className="realtime-status-card">
                <h3>Estado del tiempo real</h3>
                <p>{socketState}</p>
                <ul>
                  <li>Host registrado: {room.hostName || profile?.displayName || user?.displayName || 'Usuario'}</li>
                  <li>Creada el: {formatDate(room.createdAt)}</li>
                  <li>WebSockets preparados para presencia de usuarios y futuras interacciones del chat.</li>
                </ul>
              </div>

              {copied && <p className="success-msg" role="status">{copied}</p>}
              {error && <p className="error-msg" role="alert">{error}</p>}
            </>
          ) : (
            <div className="rooms-empty-state">No se encontró la sala solicitada.</div>
          )}
        </section>

        <section className="rooms-panel" aria-labelledby="participants-title">
          <h2 id="participants-title">Participantes conectados</h2>
          <p>
            En Sprint 2 se deja activa la base de presencia. Aquí se muestran los usuarios conectados a la sala.
          </p>

          {participants.length === 0 ? (
            <div className="rooms-empty-state">Por ahora solo está el anfitrión o aún no hay conexión activa.</div>
          ) : (
            <div className="participants-list">
              {participants.map((participant) => {
                const initial = (participant.displayName || 'S').charAt(0).toUpperCase()
                const hasRemoteAvatar = typeof participant.photoURL === 'string' && participant.photoURL.startsWith('http')
                const avatarClass = hasRemoteAvatar ? '' : (participant.photoURL || 'avatar-blue')

                return (
                  <article key={participant.uid} className="participant-card">
                    <div className={`participant-avatar ${avatarClass}`} aria-hidden="true">
                      {hasRemoteAvatar ? <img src={participant.photoURL} alt="" /> : initial}
                    </div>
                    <div>
                      <h3>{participant.displayName}</h3>
                      <p>{participant.uid === user?.uid ? 'Anfitrión / tú' : 'Participante conectado'}</p>
                    </div>
                  </article>
                )
              })}
            </div>
          )}

          <div className="room-note-card">
            <h3>Siguiente paso del proyecto</h3>
            <p>
              La unión por ID para invitados, el chat en tiempo real y el historial de mensajes se fortalecen en el
              siguiente sprint. Aquí queda lista la infraestructura base de salas y WebSockets.
            </p>
          </div>
        </section>
      </div>
    </AppLayout>
  )
}

export default RoomDetail
