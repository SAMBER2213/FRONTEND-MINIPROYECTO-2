import PropTypes from 'prop-types'
import { NavLink, useNavigate } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { auth } from '../config/firebase'
import { useAuth } from '../context/useAuth'
import '../styles/AppLayout.css'

function AppLayout({ children, title, subtitle }) {
  const { user, profile } = useAuth()
  const navigate = useNavigate()

  const initial = (profile?.displayName || user?.displayName || user?.email || 'S').charAt(0).toUpperCase()
  const avatar = profile?.photoURL || user?.photoURL || ''
  const hasRemoteAvatar = typeof avatar === 'string' && avatar.startsWith('http')
  const avatarClass = typeof avatar === 'string' && avatar.startsWith('avatar-') ? avatar : 'avatar-blue'

  const handleLogout = async () => {
    await signOut(auth)
    navigate('/', { replace: true })
  }

  return (
    <main className="app-shell">
      <aside className="app-sidebar" aria-label="Navegación principal">
        <div className="brand-block">
          <div className="brand-logo" aria-hidden="true">S</div>
          <span>StudySync</span>
        </div>

        <nav className="sidebar-nav">
          <NavLink to="/perfil" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
            <span aria-hidden="true">◉</span>
            Perfil
          </NavLink>
        </nav>

        <section className="sidebar-profile" aria-label="Perfil del usuario autenticado">
          <div className={`sidebar-avatar ${hasRemoteAvatar ? '' : avatarClass}`} aria-hidden="true">
            {hasRemoteAvatar ? <img src={avatar} alt="" /> : initial}
          </div>
          <div>
            <p className="sidebar-name">{profile?.displayName || user?.displayName || 'Usuario'}</p>
            <p className="sidebar-username">@{profile?.username || 'sin_username'}</p>
          </div>
        </section>
      </aside>

      <section className="app-content">
        <header className="app-header">
          <div>
            <h1>{title}</h1>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button className="logout-btn" type="button" onClick={handleLogout}>
            Cerrar sesión
          </button>
        </header>

        {children}
      </section>
    </main>
  )
}

AppLayout.propTypes = {
  children: PropTypes.node.isRequired,
  title: PropTypes.string.isRequired,
  subtitle: PropTypes.string,
}

AppLayout.defaultProps = {
  subtitle: '',
}

export default AppLayout
