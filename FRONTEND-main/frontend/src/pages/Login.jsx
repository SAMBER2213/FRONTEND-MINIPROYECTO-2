import LoginCard from "../components/LoginCard";

function Login() {
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
  );
}

export default Login;