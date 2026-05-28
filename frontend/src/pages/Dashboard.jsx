import { useState } from 'react'
import AppLayout from '../layouts/AppLayout'
import '../styles/Dashboard.css'

function Dashboard() {
  const [message, setMessage] = useState('')

  return (
    <AppLayout
      title="Dashboard"
      subtitle="Panel principal del usuario autenticado."
    >
      <section className="dashboard-panel" aria-labelledby="dashboard-title">
        <h2 id="dashboard-title">Bienvenido a StudySync</h2>
        <p>
          Esta es una vista temporal del dashboard mientras se construyen las funciones de salas.
          Desde el menú lateral puedes entrar a tu perfil y editar tus datos.
        </p>

        {message && <p className="success-msg" role="status">{message}</p>}

        <button
          onClick={() => setMessage('Sesión activa y dashboard protegido funcionando correctamente.')}
          className="secondary-btn"
          type="button"
        >
          Probar mensaje de éxito
        </button>
      </section>
    </AppLayout>
  )
}

export default Dashboard
