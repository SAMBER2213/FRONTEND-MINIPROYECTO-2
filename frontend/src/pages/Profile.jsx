import { useEffect, useMemo, useState } from 'react'
import AppLayout from '../layouts/AppLayout'
import { useAuth } from '../context/useAuth'
import { checkUsernameAvailability, getApiErrorMessage } from '../services/api'
import '../styles/Profile.css'

const usernamePattern = /^[a-z0-9_]{3,20}$/

const avatarOptions = [
  { id: 'blue', label: 'Azul', value: 'avatar-blue' },
  { id: 'green', label: 'Verde', value: 'avatar-green' },
  { id: 'purple', label: 'Morado', value: 'avatar-purple' },
  { id: 'orange', label: 'Naranja', value: 'avatar-orange' },
]

function normalizeUsername(value) {
  return value.trim().toLowerCase()
}

function Profile() {
  const { user, profile, updateProfileData } = useAuth()
  const [displayName, setDisplayName] = useState(profile?.displayName || '')
  const [username, setUsername] = useState(profile?.username || '')
  const initialAvatar = profile?.photoURL?.startsWith?.('avatar-') ? profile.photoURL : 'avatar-blue'
  const [photoURL, setPhotoURL] = useState(initialAvatar)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  const normalizedUsername = useMemo(() => normalizeUsername(username), [username])
  const currentUsername = profile?.username || ''

  useEffect(() => {
    setDisplayName(profile?.displayName || '')
    setUsername(profile?.username || '')
    setPhotoURL(profile?.photoURL?.startsWith?.('avatar-') ? profile.photoURL : 'avatar-blue')
  }, [profile])

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setSuccess('')

    if (!displayName.trim()) {
      setError('El nombre visible es obligatorio.')
      return
    }

    if (!usernamePattern.test(normalizedUsername)) {
      setError('El username debe tener 3 a 20 caracteres: letras minúsculas, números o guion bajo.')
      return
    }

    setLoading(true)

    try {
      if (normalizedUsername !== currentUsername) {
        const availability = await checkUsernameAvailability(user, normalizedUsername)
        if (!availability?.data?.available) {
          setError('Ese username ya está en uso. Prueba con otro.')
          setLoading(false)
          return
        }
      }

      await updateProfileData({
        displayName: displayName.trim(),
        username: normalizedUsername,
        photoURL,
      })

      setSuccess('Perfil actualizado correctamente.')
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AppLayout
      title="Mi perfil"
      subtitle="Consulta y edita tus datos principales de StudySync."
    >
      <section className="profile-panel" aria-labelledby="profile-title">
        <div className="profile-summary">
          <div className={`profile-avatar-preview ${photoURL}`} aria-hidden="true">
            {(displayName || user?.email || 'S').charAt(0).toUpperCase()}
          </div>
          <div>
            <h2 id="profile-title">Datos del usuario</h2>
            <p>{user?.email}</p>
          </div>
        </div>

        <form className="profile-form" onSubmit={handleSubmit} noValidate>
          <div className="input-group">
            <label htmlFor="profile-display-name">Nombre visible</label>
            <input
              id="profile-display-name"
              type="text"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="Ej: Juan García"
              required
              autoComplete="name"
            />
          </div>

          <div className="input-group">
            <label htmlFor="profile-username">Username único</label>
            <input
              id="profile-username"
              type="text"
              value={username}
              onChange={(event) => setUsername(normalizeUsername(event.target.value))}
              placeholder="Ej: juan_garcia"
              required
              aria-describedby="profile-username-help"
              autoComplete="username"
            />
            <small id="profile-username-help" className="field-help">
              3 a 20 caracteres. Solo letras minúsculas, números y guion bajo.
            </small>
          </div>

          <fieldset className="avatar-fieldset">
            <legend>Avatar</legend>
            <div className="avatar-options">
              {avatarOptions.map((avatar) => (
                <label key={avatar.id} className={`avatar-option ${avatar.value}`}>
                  <input
                    type="radio"
                    name="avatar"
                    value={avatar.value}
                    checked={photoURL === avatar.value}
                    onChange={(event) => setPhotoURL(event.target.value)}
                  />
                  <span aria-hidden="true">{(displayName || 'S').charAt(0).toUpperCase()}</span>
                  {avatar.label}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="input-group">
            <label htmlFor="profile-email">Correo electrónico</label>
            <input
              id="profile-email"
              type="email"
              value={user?.email || ''}
              readOnly
              aria-readonly="true"
            />
            <small className="field-help">El correo se muestra como dato de la cuenta autenticada.</small>
          </div>

          {error && <p className="error-msg" role="alert">{error}</p>}
          {success && <p className="success-msg" role="status">{success}</p>}

          <button className="login-btn" type="submit" disabled={loading}>
            {loading ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </form>
      </section>
    </AppLayout>
  )
}

export default Profile
