import PropTypes from 'prop-types'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { useAuth } from './context/useAuth'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Profile from './pages/Profile'
import CompleteProfile from './pages/CompleteProfile'
import './App.css'

function LoadingScreen() {
  return (
    <main className="app-state" aria-live="polite">
      <div className="app-state__card">Cargando sesión...</div>
    </main>
  )
}

function RequireAuth({ children }) {
  const { user, loading } = useAuth()

  if (loading) return <LoadingScreen />
  if (!user) return <Navigate to="/" replace />

  return children
}

function RequireProfile({ children }) {
  const { user, profile, loading } = useAuth()

  if (loading) return <LoadingScreen />
  if (!user) return <Navigate to="/" replace />
  if (!profile) return <Navigate to="/complete-profile" replace />

  return children
}

RequireAuth.propTypes = {
  children: PropTypes.node.isRequired,
}

RequireProfile.propTypes = {
  children: PropTypes.node.isRequired,
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route
        path="/complete-profile"
        element={
          <RequireAuth>
            <CompleteProfile />
          </RequireAuth>
        }
      />
      <Route
        path="/dashboard"
        element={
          <RequireProfile>
            <Dashboard />
          </RequireProfile>
        }
      />
      <Route
        path="/perfil"
        element={
          <RequireProfile>
            <Profile />
          </RequireProfile>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
