import { signOut } from 'firebase/auth'
import { auth } from '../config/firebase'
import { useAuth } from '../context/AuthContext'

function Dashboard() {
  const { user } = useAuth()

  const handleLogout = async () => {
    await signOut(auth)
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'white',
      fontFamily: 'system-ui, sans-serif'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '12px',
        padding: '40px',
        textAlign: 'center',
        color: '#333',
        maxWidth: '400px',
        width: '90%'
      }}>
        <div style={{
          width: '60px', height: '60px',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '28px', fontWeight: 'bold', color: 'white',
          margin: '0 auto 16px'
        }}>S</div>
        <h1 style={{ fontSize: '24px', marginBottom: '8px' }}>¡Bienvenido a StudySync!</h1>
        <p style={{ color: '#666', marginBottom: '24px' }}>
          {user?.displayName || user?.email}
        </p>
        <p style={{ color: '#999', fontSize: '14px', marginBottom: '24px' }}>
          Dashboard en construcción — Sprint 1 🚧
        </p>
        <button
          onClick={handleLogout}
          style={{
            padding: '10px 24px',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white', border: 'none', borderRadius: '8px',
            fontSize: '14px', fontWeight: '600', cursor: 'pointer'
          }}
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  )
}

export default Dashboard
