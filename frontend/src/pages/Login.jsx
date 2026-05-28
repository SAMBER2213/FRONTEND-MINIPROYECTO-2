import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import LoginCard from '../components/LoginCard'
import { useAuth } from '../context/useAuth'
import '../styles/Login.css'

function Login() {
  const { user, profile, loading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (loading) return
    if (user && profile) navigate('/dashboard', { replace: true })
  }, [user, profile, loading, navigate])

  return (
    <div className="login-page">
      <div className="overlay"></div>
      <div className="left-section">
        <h2>
          Aprende, colabora y estudia
          en tiempo real.
        </h2>
        <p>
          Crea salas privadas, comparte pantalla,
          realiza videollamadas y trabaja en equipo
          desde cualquier lugar.
        </p>
      </div>
      <div className="right-section">
        <LoginCard />
      </div>
    </div>
  )
}

export default Login
