import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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

function getInitialAvatar(profile, user) {
  return profile?.photoURL || user?.photoURL || 'avatar-blue'
}

function isRemoteAvatar(value) {
  return typeof value === 'string' && value.startsWith('http')
}

function Profile() {
  const { user, profile, updateProfileData, deleteAccount } = useAuth()
  const navigate = useNavigate()
  const [displayName, setDisplayName] = useState(profile?.displayName || user?.displayName || '')
  const [username, setUsername] = useState(profile?.username || '')
  const [photoURL, setPhotoURL] = useState(getInitialAvatar(profile, user))
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const normalizedUsername = useMemo(() => normalizeUsername(username), [username])
  const currentUsername = profile?.username || ''
  const googlePhotoURL = user?.photoURL || ''
  const hasGooglePhoto = isRemoteAvatar(googlePhotoURL)
  const showingRemoteAvatar = isRemoteAvatar(photoURL)
  const previewClass = showingRemoteAvatar ? '' : photoURL
  const previewInitial = (displayName || user?.email || 'S').charAt(0).toUpperCase()

  useEffect(() => {
    setDisplayName(profile?.displayName || user?.displayName || '')
    setUsername(profile?.username || '')
    setPhotoURL(getInitialAvatar(profile, user))
  }, [profile, user])

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
      setConfirmDelete(false)
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteAccount = async () => {
    setError('')
    setSuccess('')
    setDeleteLoading(true)

    try {
      await deleteAccount()
      navigate('/', { replace: true })
    } catch (err) {
      setError(getApiErrorMessage(err))
      setDeleteLoading(false)
    }
  }

  return (
    <AppLayout
      title="Mi perfil"
      subtitle="Consulta y edita tus datos principales de StudySync."
    >
      <section className="profile-panel" aria-labelledby="profile-title">
        <div className="profile-summary">
          <div className={`profile-avatar-preview ${previewClass}`} aria-hidden="true">
            {showingRemoteAvatar ? <img src={photoURL} alt="" /> : previewInitial}
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
              {hasGooglePhoto && (
                <label className="avatar-option avatar-option-google">
                  <input
                    type="radio"
                    name="avatar"
                    value={googlePhotoURL}
                    checked={photoURL === googlePhotoURL}
                    onChange={(event) => setPhotoURL(event.target.value)}
                  />
                  <img src={googlePhotoURL} alt="" aria-hidden="true" />
                  Foto de Google
                </label>
              )}

              {avatarOptions.map((avatar) => (
                <label key={avatar.id} className={`avatar-option avatar-option-icon ${avatar.value}`} title={avatar.label} aria-label={avatar.label}>
                  <input
                    type="radio"
                    name="avatar"
                    value={avatar.value}
                    checked={photoURL === avatar.value}
                    onChange={(event) => setPhotoURL(event.target.value)}
                  />
                  <span aria-hidden="true">{previewInitial}</span>
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

          <button className="login-btn" type="submit" disabled={loading || deleteLoading}>
            {loading ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </form>

        <section className="delete-account-panel" aria-labelledby="delete-account-title">
          <h3 id="delete-account-title">Eliminar cuenta</h3>
          <p>
            Esta acción borra tu perfil de la base de datos, libera tu username y elimina tu usuario de Firebase Auth.
            Después podrás crear una cuenta nueva con el mismo correo si lo necesitas.
          </p>

          {!confirmDelete ? (
            <button
              className="danger-outline-btn"
              type="button"
              onClick={() => setConfirmDelete(true)}
              disabled={loading || deleteLoading}
            >
              Eliminar cuenta
            </button>
          ) : (
            <div className="delete-confirmation" role="alert">
              <p>¿Seguro que deseas eliminar tu cuenta? Esta acción no se puede deshacer.</p>
              <div className="delete-actions">
                <button
                  className="secondary-btn"
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  disabled={deleteLoading}
                >
                  Cancelar
                </button>
                <button
                  className="danger-btn"
                  type="button"
                  onClick={handleDeleteAccount}
                  disabled={deleteLoading}
                >
                  {deleteLoading ? 'Eliminando...' : 'Sí, eliminar cuenta'}
                </button>
              </div>
            </div>
          )}
        </section>
      </section>
    </AppLayout>
  )
}

export default Profile
