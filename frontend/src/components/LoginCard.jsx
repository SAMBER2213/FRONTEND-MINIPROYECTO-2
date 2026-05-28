import { useState } from 'react'
import {
  createUserWithEmailAndPassword,
  fetchSignInMethodsForEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from 'firebase/auth'
import { useNavigate } from 'react-router-dom'
import { auth, googleProvider } from '../config/firebase'
import { useAuth } from '../context/useAuth'
import { getApiErrorMessage, getMyProfile } from '../services/api'
import '../styles/LoginCard.css'

const usernamePattern = /^[a-z0-9_]{3,20}$/
const institutionalDomain = '@correounivalle.edu.co'

const avatarOptions = [
  { id: 'blue', label: 'Azul', value: 'avatar-blue' },
  { id: 'green', label: 'Verde', value: 'avatar-green' },
  { id: 'purple', label: 'Morado', value: 'avatar-purple' },
  { id: 'orange', label: 'Naranja', value: 'avatar-orange' },
]

function normalizeUsername(value) {
  return value.trim().toLowerCase()
}

function normalizeEmail(value) {
  return value.trim().toLowerCase()
}

function isInstitutionalEmail(value) {
  return normalizeEmail(value).endsWith(institutionalDomain)
}

function validateRegisterForm({ displayName, username, email, password }) {
  if (!displayName.trim()) return 'Escribe tu nombre para el perfil.'
  if (!usernamePattern.test(normalizeUsername(username))) {
    return 'El username debe tener 3 a 20 caracteres: letras minúsculas, números o guion bajo.'
  }
  if (!email.trim()) return 'Escribe tu correo electrónico.'
  if (!isInstitutionalEmail(email)) return `Usa tu correo institucional ${institutionalDomain}.`
  if (password.length < 6) return 'La contraseña debe tener al menos 6 caracteres.'
  return ''
}

function LoginCard() {
  const { completeProfile } = useAuth()
  const navigate = useNavigate()
  const [showPassword, setShowPassword] = useState(false)
  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [avatar, setAvatar] = useState('avatar-blue')
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
        const cleanEmail = normalizeEmail(email)
        const methods = await fetchSignInMethodsForEmail(auth, cleanEmail)
        if (methods.length > 0) {
          setError('El correo ya está registrado. Inicia sesión o usa otro correo institucional.')
          setLoading(false)
          return
        }

        const credentials = await createUserWithEmailAndPassword(auth, cleanEmail, password)
        await updateProfile(credentials.user, { displayName: displayName.trim() })
        await completeProfile({
          displayName: displayName.trim(),
          username: normalizeUsername(username),
          photoURL: avatar,
        })
        setSuccess('Cuenta creada correctamente. Redirigiendo al dashboard...')
        navigate('/dashboard', { replace: true })
      } else {
        await signInWithEmailAndPassword(auth, normalizeEmail(email), password)
        setSuccess('Inicio de sesión exitoso. Cargando dashboard...')
        navigate('/dashboard', { replace: true })
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

      if (!isInstitutionalEmail(result.user.email || '')) {
        await signOut(auth)
        setError(`Usa tu correo institucional ${institutionalDomain} para continuar con Google.`)
        return
      }

      setSuccess('Autenticación con Google exitosa. Validando perfil...')

      // Verificar si el usuario ya tiene perfil en el backend
      try {
        await getMyProfile(result.user)
        navigate('/dashboard', { replace: true })
      } catch (profileErr) {
        if (profileErr.status === 404) {
          // Usuario nuevo con Google → necesita elegir username
          navigate('/complete-profile', { replace: true })
        }
        // Si hay otro error (backend caído) el AuthContext igual redirige
      }
    } catch (err) {
      if (err.code !== 'auth/popup-closed-by-user') {
        setError('Error al iniciar con Google. Intenta de nuevo.')
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


            <fieldset className="register-avatar-fieldset">
              <legend>Avatar</legend>
              <div className="register-avatar-options">
                {avatarOptions.map((option) => (
                  <label key={option.id} className={`register-avatar-option ${option.value}`}>
                    <input
                      type="radio"
                      name="register-avatar"
                      value={option.value}
                      checked={avatar === option.value}
                      onChange={(event) => setAvatar(event.target.value)}
                    />
                    <span aria-hidden="true">{(displayName || 'S').charAt(0).toUpperCase()}</span>
                    {option.label}
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
