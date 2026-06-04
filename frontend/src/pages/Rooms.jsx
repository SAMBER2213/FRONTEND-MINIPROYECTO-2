import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AppLayout from '../layouts/AppLayout'
import { useAuth } from '../context/useAuth'
import {
  createRoom,
  deleteRoom,
  getApiErrorMessage,
  getMyRooms,
  getRoomByCode,
  updateRoom,
} from '../services/api'
import '../styles/Rooms.css'

const DEFAULT_ROOM_FORM = {
  name: '',
  description: '',
  maxParticipants: 10,
  isPrivate: false,
}

function formatDate(value) {
  if (!value) return 'Sin fecha'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function buildRoomPayload(form) {
  return {
    name: form.name.trim(),
    description: form.description.trim(),
    isPrivate: Boolean(form.isPrivate),
    maxParticipants: Number(form.maxParticipants) || 10,
  }
}

function validateRoomPayload(payload) {
  if (!payload.name || payload.name.length < 3) return 'El nombre de la sala debe tener al menos 3 caracteres.'
  if (payload.description.length > 300) return 'La descripción no puede superar 300 caracteres.'
  if (!Number.isInteger(payload.maxParticipants) || payload.maxParticipants < 2 || payload.maxParticipants > 20) {
    return 'El máximo de participantes debe estar entre 2 y 20.'
  }
  return ''
}

function getStoredRoomCode(roomId) {
  return window.sessionStorage.getItem(`studysync:roomCode:${roomId}`) || ''
}

function storeRoomCode(roomId, roomCode) {
  if (roomId && roomCode) {
    window.sessionStorage.setItem(`studysync:roomCode:${roomId}`, roomCode)
  }
}

function Rooms() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [createForm, setCreateForm] = useState(DEFAULT_ROOM_FORM)
  const [joinRoomKey, setJoinRoomKey] = useState('')
  const [rooms, setRooms] = useState([])
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingRoomId, setEditingRoomId] = useState('')
  const [editForm, setEditForm] = useState(DEFAULT_ROOM_FORM)
  const [loadingRooms, setLoadingRooms] = useState(true)
  const [creating, setCreating] = useState(false)
  const [joining, setJoining] = useState(false)
  const [updatingRoomId, setUpdatingRoomId] = useState('')
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

  const resetCreateForm = () => {
    setCreateForm(DEFAULT_ROOM_FORM)
  }

  const handleCreateFormChange = (field, value) => {
    setCreateForm((current) => ({ ...current, [field]: value }))
  }

  const handleEditFormChange = (field, value) => {
    setEditForm((current) => ({ ...current, [field]: value }))
  }

  const handleCreateRoom = async (event) => {
    event.preventDefault()
    setError('')
    setSuccess('')

    const payload = buildRoomPayload(createForm)
    const validationError = validateRoomPayload(payload)
    if (validationError) {
      setError(validationError)
      return
    }

    setCreating(true)

    try {
      const response = await createRoom(user, payload)
      setSuccess('Sala creada correctamente.')
      resetCreateForm()
      setShowCreateForm(false)
      if (response.data?.roomCode) storeRoomCode(response.data.id, response.data.roomCode)
      await loadRooms()
      navigate(`/salas/${response.data.id}`, {
        replace: true,
        state: { roomCode: response.data.roomCode || '' },
      })
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setCreating(false)
    }
  }

  const handleJoinRoom = async (event) => {
    event.preventDefault()
    setError('')
    setSuccess('')

    const cleanRoomKey = joinRoomKey.trim()
    if (!cleanRoomKey) {
      setError('Pega un ID o código de sala válido para unirte.')
      return
    }

    setJoining(true)

    try {
      const response = await getRoomByCode(user, cleanRoomKey)
      const room = response.data
      const roomCode = room.roomCode || cleanRoomKey
      storeRoomCode(room.id, roomCode)
      setSuccess(`Entrando a ${room.name}.`)
      setJoinRoomKey('')
      navigate(`/salas/${room.id}`, { state: { roomCode } })
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setJoining(false)
    }
  }

  const openEditRoom = (room) => {
    setError('')
    setSuccess('')
    setShowCreateForm(false)
    setEditingRoomId(room.id)
    setEditForm({
      name: room.name || '',
      description: room.description || '',
      maxParticipants: room.maxParticipants ?? 10,
      isPrivate: Boolean(room.isPrivate),
    })
  }

  const cancelEditRoom = () => {
    setEditingRoomId('')
    setEditForm(DEFAULT_ROOM_FORM)
  }

  const handleUpdateRoom = async (event, room) => {
    event.preventDefault()
    setError('')
    setSuccess('')

    if (room.hostUid !== user?.uid && !room.isHost) {
      setError('Solo el anfitrión puede editar la sala.')
      return
    }

    const payload = buildRoomPayload(editForm)
    const validationError = validateRoomPayload(payload)
    if (validationError) {
      setError(validationError)
      return
    }

    setUpdatingRoomId(room.id)

    try {
      const response = await updateRoom(user, room.id, payload)
      if (response.data?.roomCode) storeRoomCode(response.data.id, response.data.roomCode)
      setSuccess('Sala actualizada correctamente.')
      cancelEditRoom()
      await loadRooms()
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setUpdatingRoomId('')
    }
  }

  const handleDeleteRoom = async (room) => {
    if (room.hostUid !== user?.uid && !room.isHost) {
      setError('Solo el anfitrión puede eliminar la sala.')
      return
    }

    const confirmed = window.confirm('¿Deseas eliminar esta sala? Esta acción no se puede deshacer.')
    if (!confirmed) return

    setDeletingRoomId(room.id)
    setError('')
    setSuccess('')

    try {
      await deleteRoom(user, room.id)
      window.sessionStorage.removeItem(`studysync:roomCode:${room.id}`)
      setSuccess('Sala eliminada correctamente.')
      if (editingRoomId === room.id) cancelEditRoom()
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
      subtitle="Crea, edita, elimina y únete a espacios colaborativos con ID único."
    >
      <div className="rooms-grid rooms-management-grid">
        <section className="rooms-panel join-room-panel" aria-labelledby="join-room-title">
          <h2 id="join-room-title">Unirse a una sala</h2>
          <p>
            Pega el ID único o el código corto que te compartió el anfitrión. Las salas privadas
            requieren el código válido.
          </p>

          <form className="rooms-form join-room-form" onSubmit={handleJoinRoom} noValidate>
            <div className="input-group">
              <label htmlFor="join-room-key">ID o código de sala</label>
              <input
                id="join-room-key"
                type="text"
                value={joinRoomKey}
                onChange={(event) => setJoinRoomKey(event.target.value)}
                placeholder="Ej: ABCD1234"
                aria-describedby="join-room-help"
                autoComplete="off"
                required
              />
              <p id="join-room-help" className="form-hint">
                Usa el ID que aparece en la tarjeta de la sala o el código compartido por el anfitrión.
              </p>
            </div>

            <button className="login-btn" type="submit" disabled={joining}>
              {joining ? 'Validando sala...' : 'Unirme a la sala'}
            </button>
          </form>

          <div className="room-note-card" role="note">
            <h3>Criterio C1</h3>
            <p>
              Editar y eliminar están bloqueados para invitados. Unirse valida el ID/código antes de entrar.
            </p>
          </div>
        </section>

        <section className="rooms-panel rooms-main-panel" aria-labelledby="my-rooms-title">
          <div className="rooms-topbar">
            <div>
              <h2 id="my-rooms-title">Mis salas</h2>
              <p>Salas creadas por ti. Como anfitrión puedes editarlas o eliminarlas.</p>
            </div>
            <div className="rooms-topbar-actions">
              <button className="secondary-btn" type="button" onClick={loadRooms} disabled={loadingRooms}>
                {loadingRooms ? 'Actualizando...' : 'Actualizar'}
              </button>
              <button
                className="create-room-btn"
                type="button"
                onClick={() => {
                  setError('')
                  setSuccess('')
                  setEditingRoomId('')
                  setShowCreateForm((current) => !current)
                }}
                aria-expanded={showCreateForm}
              >
                <span aria-hidden="true">+</span>
                Crear sala
              </button>
            </div>
          </div>

          {showCreateForm && (
            <form className="rooms-form create-room-form" onSubmit={handleCreateRoom} noValidate>
              <div className="input-group">
                <label htmlFor="room-name">Nombre de la sala</label>
                <input
                  id="room-name"
                  type="text"
                  value={createForm.name}
                  onChange={(event) => handleCreateFormChange('name', event.target.value)}
                  placeholder="Ej: Sala Cálculo III"
                  required
                />
              </div>

              <div className="input-group">
                <label htmlFor="room-description">Descripción</label>
                <textarea
                  id="room-description"
                  value={createForm.description}
                  onChange={(event) => handleCreateFormChange('description', event.target.value)}
                  placeholder="Ej: Repaso para el parcial."
                  rows="3"
                  maxLength="300"
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
                    value={createForm.maxParticipants}
                    onChange={(event) => handleCreateFormChange('maxParticipants', event.target.value)}
                  />
                </div>

                <label className="checkbox-field">
                  <input
                    type="checkbox"
                    checked={createForm.isPrivate}
                    onChange={(event) => handleCreateFormChange('isPrivate', event.target.checked)}
                  />
                  Sala privada
                </label>
              </div>

              <div className="create-form-actions">
                <button className="secondary-btn" type="button" onClick={() => setShowCreateForm(false)} disabled={creating}>
                  Cancelar
                </button>
                <button className="login-btn" type="submit" disabled={creating}>
                  {creating ? 'Creando...' : 'Guardar sala'}
                </button>
              </div>
            </form>
          )}

          {error && <p className="error-msg" role="alert">{error}</p>}
          {success && <p className="success-msg" role="status">{success}</p>}

          {loadingRooms ? (
            <div className="rooms-empty-state">Cargando salas...</div>
          ) : rooms.length === 0 ? (
            <div className="rooms-empty-state">
              Aún no has creado salas. Crea la primera para empezar a organizar tus espacios de estudio.
            </div>
          ) : (
            <div className="rooms-list rooms-list-grid">
              {rooms.map((room) => {
                const isHost = room.hostUid === user?.uid || room.isHost
                const isEditing = editingRoomId === room.id
                const storedCode = getStoredRoomCode(room.id)
                const visibleCode = room.roomCode || storedCode || room.id

                return (
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
                        <dd>{visibleCode}</dd>
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

                    {isEditing ? (
                      <form className="rooms-form edit-room-form" onSubmit={(event) => handleUpdateRoom(event, room)} noValidate>
                        <div className="input-group">
                          <label htmlFor={`edit-room-name-${room.id}`}>Nombre de la sala</label>
                          <input
                            id={`edit-room-name-${room.id}`}
                            type="text"
                            value={editForm.name}
                            onChange={(event) => handleEditFormChange('name', event.target.value)}
                            required
                          />
                        </div>

                        <div className="input-group">
                          <label htmlFor={`edit-room-description-${room.id}`}>Descripción</label>
                          <textarea
                            id={`edit-room-description-${room.id}`}
                            value={editForm.description}
                            onChange={(event) => handleEditFormChange('description', event.target.value)}
                            rows="3"
                            maxLength="300"
                          />
                        </div>

                        <div className="rooms-form-row">
                          <div className="input-group">
                            <label htmlFor={`edit-room-max-${room.id}`}>Máximo de participantes</label>
                            <input
                              id={`edit-room-max-${room.id}`}
                              type="number"
                              min="2"
                              max="20"
                              value={editForm.maxParticipants}
                              onChange={(event) => handleEditFormChange('maxParticipants', event.target.value)}
                            />
                          </div>

                          <label className="checkbox-field">
                            <input
                              type="checkbox"
                              checked={editForm.isPrivate}
                              onChange={(event) => handleEditFormChange('isPrivate', event.target.checked)}
                            />
                            Sala privada
                          </label>
                        </div>

                        <div className="room-actions">
                          <button className="login-btn" type="submit" disabled={updatingRoomId === room.id}>
                            {updatingRoomId === room.id ? 'Guardando...' : 'Guardar cambios'}
                          </button>
                          <button className="secondary-btn" type="button" onClick={cancelEditRoom} disabled={updatingRoomId === room.id}>
                            Cancelar
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div className="room-actions">
                        <button
                          className="secondary-btn"
                          type="button"
                          onClick={() => navigate(`/salas/${room.id}`, { state: { roomCode: visibleCode } })}
                        >
                          Entrar a la sala
                        </button>
                        {isHost && (
                          <button
                            className="secondary-btn"
                            type="button"
                            onClick={() => openEditRoom(room)}
                          >
                            Editar
                          </button>
                        )}
                        {isHost && (
                          <button
                            className="danger-outline-btn"
                            type="button"
                            onClick={() => handleDeleteRoom(room)}
                            disabled={deletingRoomId === room.id}
                          >
                            {deletingRoomId === room.id ? 'Eliminando...' : 'Eliminar'}
                          </button>
                        )}
                      </div>
                    )}

                    {!isHost && (
                      <p className="host-only-note">Solo el anfitrión puede editar o eliminar esta sala.</p>
                    )}
                  </article>
                )
              })}
            </div>
          )}
        </section>
      </div>
    </AppLayout>
  )
}

export default Rooms
