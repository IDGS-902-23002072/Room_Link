import './profile-ux.css'
import { Link } from 'react-router-dom'
import Icon from '../../components/Icon.jsx'

export default function HostGate() {
  return <section className="host-gate">
    <span className="host-gate-icon"><Icon name="home" size={30} /></span>
    <p className="eyebrow">COMPARTE TU ESPACIO</p>
    <h1>Tu primera habitación empieza aquí</h1>
    <p>Activa tu cuenta de arrendador para crear anuncios y recibir postulaciones.</p>
    <ol><li>Completa tu perfil</li><li>Solicita la verificación de identidad</li><li>Acepta los términos de arrendador</li></ol>
    <Link className="button button-mint" to="/perfil/arrendador">Empezar como arrendador <Icon name="arrow" size={18} /></Link>
    <Link className="host-gate-back" to="/explorar">Seguir explorando habitaciones</Link>
  </section>
}
