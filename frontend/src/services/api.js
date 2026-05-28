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

export function getApiErrorMessage(error) {
  if (error?.status === 409) return 'Ese username ya está en uso. Prueba con otro.'
  if (error?.status === 400) return error.message || 'Revisa los campos del formulario.'
  if (error?.status === 401) return 'Tu sesión expiró. Inicia sesión nuevamente.'
  return error?.message || 'Ocurrió un error inesperado.'
}
