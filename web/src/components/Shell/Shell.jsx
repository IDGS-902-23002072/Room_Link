import PropTypes from 'prop-types'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth.js'
import { AppLink } from '../AppLink.jsx'
import Avatar from '../Avatar/Avatar.jsx'
import BrandMark from '../BrandMark/BrandMark.jsx'
import Button from '../Button/Button.jsx'
import styles from './Shell.module.css'

export default function Shell({ children }) {
  const { session, logout } = useAuth()
  const navigate = useNavigate()
  const isAdmin = session?.user.roles?.includes('admin')
  const email = session?.user.email ?? ''

  function signOut() {
    logout()
    navigate('/login', { replace: true })
  }

  const navClass = ({ isActive }) =>
    [styles.navLink, isActive ? styles.navLinkActive : ''].filter(Boolean).join(' ')

  return (
    <div className={styles.shell}>
      <a className={styles.skipLink} href="#main-content">
        Saltar al contenido principal
      </a>
      <header className={styles.topbar}>
        <AppLink className={styles.brand} href="/explorar">
          <BrandMark />
        </AppLink>

        <nav aria-label="Navegación principal" className={styles.nav}>
          <NavLink className={navClass} to="/explorar">
            Habitaciones
          </NavLink>
          <NavLink className={navClass} to="/recomendados">
            Roomies
          </NavLink>
          <span aria-disabled="true" className={styles.navDisabled} title="Disponible próximamente">
            Mensajes
          </span>
          <span aria-disabled="true" className={styles.navDisabled} title="Disponible próximamente">
            Solicitudes
          </span>
          <NavLink className={navClass} to="/cuestionario">
            Mi test
          </NavLink>
          {isAdmin ? (
            <NavLink className={navClass} to="/admin/dashboard">
              Dashboard
            </NavLink>
          ) : null}
        </nav>

        <div className={styles.account}>
          <Avatar className={styles.accountAvatar} name={email} size="sm" />
          <span className={styles.accountName} title={email}>
            {email}
          </span>
          <Button aria-label="Cerrar sesión" onClick={signOut} size="sm" variant="quiet">
            Cerrar sesión
          </Button>
        </div>
      </header>
      <main className={styles.main} id="main-content" tabIndex={-1}>
        {children}
      </main>
    </div>
  )
}

Shell.propTypes = {
  children: PropTypes.node.isRequired,
}
