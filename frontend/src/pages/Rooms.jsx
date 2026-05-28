import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AppLayout from '../layouts/AppLayout'
import { useAuth } from '../context/useAuth'
import { createRoom, deleteRoom, getApiErrorMessage, getMyRooms } from '../services/api'
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

function Rooms() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [roomName, setRoomName] = useState('')
  const [description, setDescription] = useState('')
  const [maxParticipants, setMaxParticipants] = useState(10)
  const [isPrivate, setIsPrivate] = useState(false)
  const [rooms, setRooms] = useState([])
  const [loadingRooms, setLoadingRooms] = useState(true)
  const [creating, setCreating] = useState(false)
  const [deletingRoomId, setDeletingRoomId] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const loadRooms = useCallback(async () => {
    if (!user) return

    setLoadingRooms(true)
    setError('')

    try {
      const response = await getMyRooms(user)
      setRooms(response.data || [])
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setLoadingRooms(false)
    }
  }, [user])

  useEffect(() => {
    loadRooms()
  }, [loadRooms])

  const handleCreateRoom = async (event) => {
    event.preventDefault()
    setError('')
    setSuccess('')

    if (!roomName.trim()) {
      setError('Escribe un nombre para la sala.')
      return
    }

    setCreating(true)

    try {
      const response = await createRoom(user, {
        name: roomName.trim(),
        description: description.trim(),
        isPrivate,
        maxParticipants: Number(maxParticipants) || 10,
      })

      setSuccess('Sala creada correctamente. Entrando a la sala...')
      setRoomName('')
      setDescription('')
      setIsPrivate(false)
      setMaxParticipants(10)
      await loadRooms()
      navigate(`/salas/${response.data.id}`, { replace: true })
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setCreating(false)
    }
  }

  const handleDeleteRoom = async (roomId) => {
    const confirmed = window.confirm('¿Deseas eliminar esta sala? Esta acción no se puede deshacer.')
    if (!confirmed) return

    setDeletingRoomId(roomId)
    setError('')
    setSuccess('')

    try {
      await deleteRoom(user, roomId)
      setSuccess('Sala eliminada correctamente.')
      await loadRooms()
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setDeletingRoomId('')
    }
  }

  return (
    <AppLayout
      title="Salas de estudio"
      subtitle="Crea una sala con ID único y visualiza las salas propias registradas en StudySync."
    >
      <div className="rooms-grid">
        <section className="rooms-panel" aria-labelledby="create-room-title">
          <h2 id="create-room-title">Crear nueva sala</h2>
          <p>
            Define el nombre, la descripción y la capacidad de la sala. Al crearla se genera un ID único y
            entras como anfitrión.
          </p>

          <form className="rooms-form" onSubmit={handleCreateRoom} noValidate>
            <div className="input-group">
              <label htmlFor="room-name">Nombre de la sala</label>
              <input
                id="room-name"
                type="text"
                value={roomName}
                onChange={(event) => setRoomName(event.target.value)}
                placeholder="Ej: Sala Cálculo III"
                required
              />
            </div>

            <div className="input-group">
              <label htmlFor="room-description">Descripción</label>
              <textarea
                id="room-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Ej: Repaso para el parcial y resolución de ejercicios."
                rows="4"
              />
            </div>

            <div className="rooms-form-row">
              <div className="input-group">
                <label htmlFor="room-max">Máximo de participantes</label>
                <input
                  id="room-max"
                  type="number"
                  min="2"
                  max="20"
                  value={maxParticipants}
                  onChange={(event) => setMaxParticipants(event.target.value)}
                />
              </div>

              <label className="checkbox-field">
                <input
                  type="checkbox"
                  checked={isPrivate}
                  onChange={(event) => setIsPrivate(event.target.checked)}
                />
                Sala privada
              </label>
            </div>

            {error && <p className="error-msg" role="alert">{error}</p>}
            {success && <p className="success-msg" role="status">{success}</p>}

            <button className="login-btn" type="submit" disabled={creating}>
              {creating ? 'Creando sala...' : 'Crear sala'}
            </button>
          </form>
        </section>

        <section className="rooms-panel" aria-labelledby="my-rooms-title">
          <div className="rooms-panel-header">
            <div>
              <h2 id="my-rooms-title">Mis salas</h2>
              <p>Lista de salas creadas por el usuario autenticado.</p>
            </div>
            <button className="secondary-btn" type="button" onClick={loadRooms} disabled={loadingRooms}>
              {loadingRooms ? 'Actualizando...' : 'Actualizar'}
            </button>
          </div>

          {loadingRooms ? (
            <div className="rooms-empty-state">Cargando salas...</div>
          ) : rooms.length === 0 ? (
            <div className="rooms-empty-state">
              Aún no has creado salas. Crea la primera para empezar a organizar tus espacios de estudio.
            </div>
          ) : (
            <div className="rooms-list">
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
                    <button
                      className="danger-outline-btn"
                      type="button"
                      onClick={() => handleDeleteRoom(room.id)}
                      disabled={deletingRoomId === room.id}
                    >
                      {deletingRoomId === room.id ? 'Eliminando...' : 'Eliminar'}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </AppLayout>
  )
}

export default Rooms
