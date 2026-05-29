const API_BASE_URL = import.meta.env.VITE_MAIN_API_URL || 'http://localhost:3001'

async function getToken(firebaseUser) {
  if (!firebaseUser) {
    throw new Error('No hay usuario autenticado')
  }
  return firebaseUser.getIdToken()
}

async function request(path, firebaseUser, options = {}) {
  const token = await getToken(firebaseUser)
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  })

  const payload = await response.json().catch(() => ({}))

  if (!response.ok) {
    const error = new Error(payload.error || 'Error de conexión con el servidor')
    error.status = response.status
    error.payload = payload
    throw error
  }

  return payload
}

export async function getMyProfile(firebaseUser) {
  return request('/api/users/me', firebaseUser)
}

export async function saveProfile(firebaseUser, profile) {
  return request('/api/users/profile', firebaseUser, {
    method: 'POST',
    body: JSON.stringify(profile),
  })
}

export async function updateMyProfile(firebaseUser, profile) {
  return request('/api/users/me', firebaseUser, {
    method: 'PUT',
    body: JSON.stringify(profile),
  })
}

export async function deleteMyAccount(firebaseUser) {
  return request('/api/users/me', firebaseUser, {
    method: 'DELETE',
  })
}

export async function checkUsernameAvailability(firebaseUser, username) {
  const cleanUsername = encodeURIComponent(username.trim().toLowerCase())
  return request(`/api/users/username/${cleanUsername}/available`, firebaseUser)
}

export async function createRoom(firebaseUser, roomData) {
  return request('/api/rooms', firebaseUser, {
    method: 'POST',
    body: JSON.stringify(roomData),
  })
}

export async function getMyRooms(firebaseUser) {
  return request('/api/rooms/my', firebaseUser)
}

export async function getRoomById(firebaseUser, roomId) {
  return request(`/api/rooms/${roomId}`, firebaseUser)
}

export async function deleteRoom(firebaseUser, roomId) {
  return request(`/api/rooms/${roomId}`, firebaseUser, {
    method: 'DELETE',
  })
}

export async function getRoomMessages(firebaseUser, roomId, limit = 50) {
  return request(`/api/rooms/${roomId}/messages?limit=${limit}`, firebaseUser)
}

export function getApiErrorMessage(error) {
  if (error?.status === 409) return 'Ese username ya está en uso. Prueba con otro.'
  if (error?.status === 404) return error.message || 'No se encontró la información solicitada.'
  if (error?.status === 400) return error.message || 'Revisa los campos del formulario.'
  if (error?.status === 401) return 'Tu sesión expiró. Inicia sesión nuevamente.'
  if (error?.status === 403) return error.message || 'No tienes permiso para realizar esta acción.'
  return error?.message || 'Ocurrió un error inesperado.'
}

export async function updateRoom(firebaseUser, roomId, roomData) {
  return request(`/api/rooms/${roomId}`, firebaseUser, {
    method: 'PUT',
    body: JSON.stringify(roomData),
  })
}

export async function getRoomByCode(firebaseUser, roomCode) {
  return request(`/api/rooms/join/${encodeURIComponent(roomCode.toUpperCase().trim())}`, firebaseUser)
}