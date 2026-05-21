import { useState } from 'react'
import { signOut } from 'firebase/auth'
import { auth } from '../config/firebase'
import { useAuth } from '../context/useAuth'
import '../styles/Dashboard.css'

function Dashboard() {
  const { user, profile } = useAuth()
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const handleLogout = async () => {
    setError('')
    setMessage('')
    try {
      await signOut(auth)
    } catch {
      setError('No se pudo cerrar sesión. Intenta de nuevo.')
    }
  }

  return (
    <main className="dashboard-page">
      <section className="dashboard-card" aria-labelledby="dashboard-title">
        <div className="dashboard-avatar" aria-hidden="true">
          {(profile?.displayName || user?.email || 'S').charAt(0).toUpperCase()}
        </div>
        <h1 id="dashboard-title">¡Bienvenido a StudySync!</h1>
        <p className="dashboard-user">{profile?.displayName}</p>
        <p className="dashboard-username">@{profile?.username}</p>
        <p className="dashboard-email">{user?.email}</p>

        <div className="dashboard-status" role="status">
          Dashboard protegido: solo visible para usuarios autenticados con perfil completo.
        </div>

        {message && <p className="success-msg" role="status">{message}</p>}
        {error && <p className="error-msg" role="alert">{error}</p>}

        <button
          onClick={() => setMessage('Estado guardado: autenticación y perfil cargados correctamente.')}
          className="secondary-btn"
          type="button"
        >
          Probar mensaje de éxito
        </button>
        <button onClick={handleLogout} className="dashboard-logout" type="button">
          Cerrar sesión
        </button>
      </section>
    </main>
  )
}

export default Dashboard
