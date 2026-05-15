import { useState } from 'react'
import { signInWithEmailAndPassword, signInWithPopup, createUserWithEmailAndPassword } from 'firebase/auth'
import { auth, googleProvider } from '../config/firebase'
import '../styles/LoginCard.css'

function LoginCard() {
  const [showPassword, setShowPassword] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isRegister, setIsRegister] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (isRegister) {
        await createUserWithEmailAndPassword(auth, email, password)
      } else {
        await signInWithEmailAndPassword(auth, email, password)
      }
    } catch (err) {
      const msgs = {
        'auth/user-not-found': 'Usuario no encontrado',
        'auth/wrong-password': 'Contraseña incorrecta',
        'auth/email-already-in-use': 'El correo ya está registrado',
        'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres',
        'auth/invalid-email': 'Correo electrónico inválido',
        'auth/invalid-credential': 'Correo o contraseña incorrectos',
      }
      setError(msgs[err.code] || 'Ocurrió un error. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogle = async () => {
    setError('')
    setLoading(true)
    try {
      await signInWithPopup(auth, googleProvider)
    } catch (err) {
      if (err.code !== 'auth/popup-closed-by-user') {
        setError('Error al iniciar con Google. Intenta de nuevo.')
      }
    } finally {
      setLoading(false)
    }
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
        <div className="input-group">
          <label htmlFor="email">Correo electrónico</label>
          <input
            id="email"
            type="email"
            placeholder="ejemplo@correo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
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
              onChange={(e) => setPassword(e.target.value)}
              required
              aria-required="true"
              aria-label="Contraseña"
              autoComplete={isRegister ? 'new-password' : 'current-password'}
            />
            <button
              type="button"
              className="show-btn"
              onClick={() => setShowPassword(!showPassword)}
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
            aria-live="polite"
          >
            {error}
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
          onClick={() => { setIsRegister(!isRegister); setError('') }}
          onKeyDown={(e) => { if (e.key === 'Enter') { setIsRegister(!isRegister); setError('') } }}
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
