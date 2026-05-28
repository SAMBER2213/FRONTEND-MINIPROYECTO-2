import { useState } from 'react'
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
} from 'firebase/auth'
import { useNavigate } from 'react-router-dom'
import { auth, googleProvider } from '../config/firebase'
import { useAuth } from '../context/useAuth'
import { getApiErrorMessage, getMyProfile } from '../services/api'
import '../styles/LoginCard.css'

const usernamePattern = /^[a-z0-9_]{3,20}$/

const avatarOptions = [
  {
    id: 'blue',
    label: 'Avatar azul',
    url: 'https://api.dicebear.com/7.x/initials/svg?seed=StudySync&backgroundColor=2563eb&textColor=ffffff',
  },
  {
    id: 'purple',
    label: 'Avatar morado',
    url: 'https://api.dicebear.com/7.x/initials/svg?seed=StudySync&backgroundColor=7c3aed&textColor=ffffff',
  },
  {
    id: 'green',
    label: 'Avatar verde',
    url: 'https://api.dicebear.com/7.x/initials/svg?seed=StudySync&backgroundColor=059669&textColor=ffffff',
  },
  {
    id: 'orange',
    label: 'Avatar naranja',
    url: 'https://api.dicebear.com/7.x/initials/svg?seed=StudySync&backgroundColor=ea580c&textColor=ffffff',
  },
]

function normalizeUsername(value) {
  return value.trim().toLowerCase()
}

function buildAvatarUrl(baseUrl, username, displayName) {
  const seed = normalizeUsername(username) || displayName.trim() || 'StudySync'
  return baseUrl.replace('seed=StudySync', `seed=${encodeURIComponent(seed)}`)
}

function validateRegisterForm({ displayName, username, email, password }) {
  if (!displayName.trim()) return 'Escribe tu nombre para el perfil.'
  if (!usernamePattern.test(normalizeUsername(username))) {
    return 'El username debe tener 3 a 20 caracteres: letras minúsculas, números o guion bajo.'
  }
  if (!email.trim()) return 'Escribe tu correo electrónico.'
  if (password.length < 6) return 'La contraseña debe tener al menos 6 caracteres.'
  return ''
}

function LoginCard() {
  const { completeProfile } = useAuth()
  const navigate = useNavigate()
  const [showPassword, setShowPassword] = useState(false)
  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState('')
  const [selectedAvatar, setSelectedAvatar] = useState(avatarOptions[0].url)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isRegister, setIsRegister] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  const resetFeedback = () => {
    setError('')
    setSuccess('')
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    resetFeedback()

    if (isRegister) {
      const validationMessage = validateRegisterForm({ displayName, username, email, password })
      if (validationMessage) {
        setError(validationMessage)
        return
      }
    }

    setLoading(true)

    try {
      if (isRegister) {
        const normalizedUsername = normalizeUsername(username)
        const avatarUrl = buildAvatarUrl(selectedAvatar, normalizedUsername, displayName)
        const credentials = await createUserWithEmailAndPassword(auth, email.trim(), password)

        await updateProfile(credentials.user, {
          displayName: displayName.trim(),
          photoURL: avatarUrl,
        })

        await completeProfile({
          displayName: displayName.trim(),
          username: normalizedUsername,
          photoURL: avatarUrl,
        })

        setSuccess('Cuenta creada correctamente. Redirigiendo al dashboard...')
        navigate('/dashboard', { replace: true })
      } else {
        const credentials = await signInWithEmailAndPassword(auth, email.trim(), password)

        try {
          await getMyProfile(credentials.user)
          setSuccess('Inicio de sesión exitoso. Cargando dashboard...')
          navigate('/dashboard', { replace: true })
        } catch (profileErr) {
          if (profileErr.status === 404) {
            setError('No se encontró un perfil para esta cuenta. Regístrate nuevamente o contacta al equipo.')
          } else {
            throw profileErr
          }
        }
      }
    } catch (err) {
      const firebaseMessages = {
        'auth/user-not-found': 'Usuario no encontrado',
        'auth/wrong-password': 'Contraseña incorrecta',
        'auth/email-already-in-use': 'El correo ya está registrado',
        'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres',
        'auth/invalid-email': 'Correo electrónico inválido',
        'auth/invalid-credential': 'Correo o contraseña incorrectos',
      }
      setError(firebaseMessages[err.code] || getApiErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  const handleGoogle = async () => {
    resetFeedback()
    setLoading(true)

    try {
      const result = await signInWithPopup(auth, googleProvider)
      setSuccess('Autenticación con Google exitosa. Validando perfil...')

      try {
        await getMyProfile(result.user)
        navigate('/dashboard', { replace: true })
      } catch (profileErr) {
        if (profileErr.status === 404) {
          navigate('/complete-profile', { replace: true })
        } else {
          throw profileErr
        }
      }
    } catch (err) {
      if (err.code !== 'auth/popup-closed-by-user') {
        setError(getApiErrorMessage(err) || 'Error al iniciar con Google. Intenta de nuevo.')
      }
    } finally {
      setLoading(false)
    }
  }

  const toggleMode = () => {
    setIsRegister((current) => !current)
    resetFeedback()
  }

  return (
    <div className="login-card" role="main">
      <div className="logo-container">
        <div
          className="logo-circle"
          role="img"
          aria-label="Logo de StudySync"
        >
          S
        </div>
        <h1>StudySync</h1>
        <p>Espacios virtuales de estudio en tiempo real</p>
      </div>

      <form
        className="login-form"
        onSubmit={handleSubmit}
        aria-label={isRegister ? 'Formulario de registro' : 'Formulario de inicio de sesión'}
        noValidate
      >
        {isRegister && (
          <>
            <div className="input-group">
              <label htmlFor="displayName">Nombre visible</label>
              <input
                id="displayName"
                type="text"
                placeholder="Ej: Juan García"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                required
                aria-required="true"
                autoComplete="name"
              />
            </div>

            <div className="input-group">
              <label htmlFor="username">Username único</label>
              <input
                id="username"
                type="text"
                placeholder="Ej: juan_garcia"
                value={username}
                onChange={(event) => setUsername(normalizeUsername(event.target.value))}
                required
                aria-required="true"
                aria-describedby="username-help"
                autoComplete="username"
              />
              <small id="username-help" className="field-help">
                3 a 20 caracteres. Solo letras minúsculas, números y guion bajo.
              </small>
            </div>

            <fieldset className="avatar-fieldset">
              <legend>Avatar</legend>
              <div className="avatar-options" role="radiogroup" aria-label="Seleccionar avatar">
                {avatarOptions.map((avatar) => (
                  <label
                    key={avatar.id}
                    className={`avatar-option ${selectedAvatar === avatar.url ? 'avatar-option--active' : ''}`}
                  >
                    <input
                      type="radio"
                      name="avatar"
                      value={avatar.url}
                      checked={selectedAvatar === avatar.url}
                      onChange={() => setSelectedAvatar(avatar.url)}
                    />
                    <img src={buildAvatarUrl(avatar.url, username, displayName)} alt={avatar.label} />
                  </label>
                ))}
              </div>
            </fieldset>
          </>
        )}

        <div className="input-group">
          <label htmlFor="email">Correo electrónico</label>
          <input
            id="email"
            type="email"
            placeholder="ejemplo@correo.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            aria-required="true"
            aria-label="Correo electrónico"
            autoComplete="email"
          />
        </div>

        <div className="input-group">
          <label htmlFor="password">Contraseña</label>
          <div className="password-container">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Ingresa tu contraseña"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              aria-required="true"
              aria-label="Contraseña"
              autoComplete={isRegister ? 'new-password' : 'current-password'}
            />
            <button
              type="button"
              className="show-btn"
              onClick={() => setShowPassword((current) => !current)}
              aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              aria-pressed={showPassword}
            >
              {showPassword ? 'Ocultar' : 'Mostrar'}
            </button>
          </div>
        </div>

        {error && (
          <p
            className="error-msg"
            role="alert"
            aria-live="assertive"
          >
            {error}
          </p>
        )}

        {success && (
          <p
            className="success-msg"
            role="status"
            aria-live="polite"
          >
            {success}
          </p>
        )}

        <button
          className="login-btn"
          type="submit"
          disabled={loading}
          aria-busy={loading}
          aria-label={loading ? 'Cargando...' : isRegister ? 'Registrarse' : 'Iniciar sesión'}
        >
          {loading ? 'Cargando...' : isRegister ? 'Registrarse' : 'Iniciar sesión'}
        </button>

        <button
          className="google-btn"
          type="button"
          onClick={handleGoogle}
          disabled={loading}
          aria-label="Continuar con Google"
        >
          Continuar con Google
        </button>
      </form>

      <div className="footer-text">
        {isRegister ? '¿Ya tienes cuenta?' : '¿No tienes cuenta?'}{' '}
        <span
          onClick={toggleMode}
          onKeyDown={(event) => { if (event.key === 'Enter') toggleMode() }}
          role="button"
          tabIndex={0}
          aria-label={isRegister ? 'Ir a iniciar sesión' : 'Ir a registrarse'}
        >
          {isRegister ? 'Inicia sesión' : 'Regístrate'}
        </span>
      </div>
    </div>
  )
}

export default LoginCard
