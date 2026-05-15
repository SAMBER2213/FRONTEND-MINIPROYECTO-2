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
    <div className="login-card">
      <div className="logo-container">
        <div className="logo-circle">S</div>
        <h1>StudySync</h1>
        <p>Espacios virtuales de estudio en tiempo real</p>
      </div>

      <form className="login-form" onSubmit={handleSubmit}>
        <div className="input-group">
          <label>Correo electrónico</label>
          <input
            type="email"
            placeholder="ejemplo@correo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div className="input-group">
          <label>Contraseña</label>
          <div className="password-container">
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Ingresa tu contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button
              type="button"
              className="show-btn"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? 'Ocultar' : 'Mostrar'}
            </button>
          </div>
        </div>

        {error && <p className="error-msg">{error}</p>}

        <button className="login-btn" type="submit" disabled={loading}>
          {loading ? 'Cargando...' : isRegister ? 'Registrarse' : 'Iniciar sesión'}
        </button>

        <button className="google-btn" type="button" onClick={handleGoogle} disabled={loading}>
          Continuar con Google
        </button>
      </form>

      <div className="footer-text">
        {isRegister ? '¿Ya tienes cuenta?' : '¿No tienes cuenta?'}{' '}
        <span onClick={() => { setIsRegister(!isRegister); setError('') }}>
          {isRegister ? 'Inicia sesión' : 'Regístrate'}
        </span>
      </div>
    </div>
  )
}

export default LoginCard
