import { useState } from 'react'
import { signOut } from 'firebase/auth'
import { auth } from '../config/firebase'
import { useAuth } from '../context/useAuth'
import '../styles/Dashboard.css'

function Dashboard() {
  const { user, profile } = useAuth()
  const [error, setError] = useState('')

  const handleLogout = async () => {
    setError('')
    try {
      await signOut(auth)
    } catch {
      setError('No se pudo cerrar sesión. Intenta de nuevo.')
    }
  }

  return (
    <main className="dashboard-page">
      <header className="dashboard-header">
        <div className="dashboard-brand">
          <div className="dashboard-avatar" aria-hidden="true">
            {profile?.photoURL ? (
              <img src={profile.photoURL} alt="" />
            ) : (
              (profile?.displayName || user?.email || 'S').charAt(0).toUpperCase()
            )}
          </div>
          <div>
            <p className="dashboard-kicker">StudySync</p>
            <h1>Dashboard</h1>
          </div>
        </div>

        <button onClick={handleLogout} className="dashboard-logout" type="button">
          Cerrar sesión
        </button>
      </header>

      <section className="dashboard-empty" aria-labelledby="dashboard-title">
        <h2 id="dashboard-title">Bienvenido, {profile?.displayName || user?.email}</h2>
        <p>
          Esta pantalla queda preparada como dashboard protegido para continuar con las
          funcionalidades del Sprint 2: perfil, creación de salas y visualización de salas propias.
        </p>
        {profile?.username && <p className="dashboard-username">@{profile.username}</p>}
        {error && <p className="error-msg" role="alert">{error}</p>}
      </section>
    </main>
  )
}

export default Dashboard
