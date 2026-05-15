import { useState } from 'react'
import '../styles/LoginCard.css'

function LoginCard() {
  const [showPassword, setShowPassword] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    console.log('Login attempt:', { email, password })
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

        <button className="login-btn" type="submit">
          Iniciar sesión
        </button>

        <button className="google-btn" type="button">
          Continuar con Google
        </button>
      </form>

      <div className="footer-text">
        ¿No tienes cuenta? <span>Regístrate</span>
      </div>
    </div>
  )
}

export default LoginCard
