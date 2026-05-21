import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { auth } from '../config/firebase'
import { useAuth } from '../context/useAuth'
import { getApiErrorMessage } from '../services/api'
import '../styles/Profile.css'

const usernamePattern = /^[a-z0-9_]{3,20}$/

function CompleteProfile() {
  const { user, profile, completeProfile } = useAuth()
  const navigate = useNavigate()
  const [displayName, setDisplayName] = useState(user?.displayName || '')
  const [username, setUsername] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  const normalizedUsername = useMemo(() => username.trim().toLowerCase(), [username])
  const isUsernameValid = usernamePattern.test(normalizedUsername)

  useEffect(() => {
    if (profile) navigate('/dashboard', { replace: true })
  }, [profile, navigate])

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setSuccess('')

    if (!displayName.trim()) {
      setError('El nombre visible es obligatorio.')
      return
    }

    if (!isUsernameValid) {
      setError('El username debe tener 3 a 20 caracteres: letras minúsculas, números o guion bajo.')
      return
    }

    setLoading(true)

    try {
      await completeProfile({
        displayName: displayName.trim(),
        username: normalizedUsername,
        photoURL: user?.photoURL || null,
      })
      setSuccess('Perfil creado correctamente. Entrando al dashboard...')
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    await signOut(auth)
    navigate('/', { replace: true })
  }

  return (
    <main className="profile-page">
      <section className="profile-card" aria-labelledby="profile-title">
        <div className="logo-circle profile-logo" aria-hidden="true">S</div>
        <h1 id="profile-title">Completa tu perfil</h1>
        <p className="profile-intro">
          Para continuar necesitas un username único. Esto permite identificarte en salas,
          chats y evidencias del proyecto.
        </p>

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
              onChange={(event) => setUsername(event.target.value.trim().toLowerCase())}
              placeholder="Ej: juan_garcia"
              required
              aria-describedby="profile-username-help"
              autoComplete="username"
            />
            <small id="profile-username-help" className="field-help">
              3 a 20 caracteres. Solo letras minúsculas, números y guion bajo.
            </small>
          </div>

          {error && <p className="error-msg" role="alert">{error}</p>}
          {success && <p className="success-msg" role="status">{success}</p>}

          <button className="login-btn" type="submit" disabled={loading}>
            {loading ? 'Guardando...' : 'Guardar perfil'}
          </button>
          <button className="secondary-btn" type="button" onClick={handleLogout} disabled={loading}>
            Salir
          </button>
        </form>
      </section>
    </main>
  )
}

export default CompleteProfile
