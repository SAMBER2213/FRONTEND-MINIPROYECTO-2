import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AppLayout from '../layouts/AppLayout'
import { useAuth } from '../context/useAuth'
import { getMyRooms, getApiErrorMessage } from '../services/api'
import '../styles/Dashboard.css'

function formatDate(value) {
  if (!value) return 'Sin fecha'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

function Dashboard() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [rooms, setRooms] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadRooms = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError('')
    try {
      const response = await getMyRooms(user)
      setRooms(response.data || [])
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    loadRooms()
  }, [loadRooms])

  return (
    <AppLayout
      title="Dashboard"
      subtitle="Panel principal — tus salas de estudio y accesos rápidos."
    >
      {/* Bienvenida */}
      <section className="dashboard-panel" aria-labelledby="dashboard-title">
        <h2 id="dashboard-title">
          Bienvenido, {profile?.displayName || user?.displayName || 'estudiante'} 👋
        </h2>
        <p>
          Desde aquí puedes ver tus salas creadas, entrar a una sala existente o ir a{' '}
          <button
            className="link-btn"
            type="button"
            onClick={() => navigate('/salas')}
          >
            Salas
          </button>{' '}
          para crear una nueva.
        </p>
      </section>

      {/* Mis salas en el Dashboard — cumple Gating G2 */}
      <section className="dashboard-panel" aria-labelledby="dashboard-rooms-title">
        <div className="rooms-topbar">
          <div>
            <h2 id="dashboard-rooms-title">Mis salas</h2>
            <p>Salas creadas por ti, con su ID único generado en Firestore.</p>
          </div>
          <div className="rooms-topbar-actions">
            <button
              className="secondary-btn"
              type="button"
              onClick={loadRooms}
              disabled={loading}
            >
              {loading ? 'Actualizando...' : 'Actualizar'}
            </button>
            <button
              className="create-room-btn"
              type="button"
              onClick={() => navigate('/salas')}
            >
              <span aria-hidden="true">+</span>
              Crear sala
            </button>
          </div>
        </div>

        {error && <p className="error-msg" role="alert">{error}</p>}

        {loading ? (
          <div className="rooms-empty-state">Cargando salas...</div>
        ) : rooms.length === 0 ? (
          <div className="rooms-empty-state">
            Aún no has creado ninguna sala.{' '}
            <button
              className="link-btn"
              type="button"
              onClick={() => navigate('/salas')}
            >
              Crear primera sala →
            </button>
          </div>
        ) : (
          <div className="rooms-list rooms-list-grid">
            {rooms.map((room) => (
              <article key={room.id} className="room-card">
                <div className="room-card-top">
                  <div>
                    <h3>{room.name}</h3>
                    <p>{room.description || 'Sin descripción registrada.'}</p>
                  </div>
                  <span className={`room-badge ${room.isPrivate ? 'private' : 'public'}`}>
                    {room.isPrivate ? 'Privada' : 'Pública'}
                  </span>
                </div>

                <dl className="room-meta">
                  <div>
                    <dt>ID único</dt>
                    <dd>{room.roomCode || room.id}</dd>
                  </div>
                  <div>
                    <dt>Participantes</dt>
                    <dd>{room.participantCount ?? 0} / {room.maxParticipants ?? 10}</dd>
                  </div>
                  <div>
                    <dt>Creada</dt>
                    <dd>{formatDate(room.createdAt)}</dd>
                  </div>
                </dl>

                <div className="room-actions">
                  <button
                    className="secondary-btn"
                    type="button"
                    onClick={() => navigate(`/salas/${room.id}`)}
                  >
                    Entrar a la sala
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </AppLayout>
  )
}

export default Dashboard