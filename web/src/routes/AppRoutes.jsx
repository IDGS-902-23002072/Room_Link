import { useEffect, useState } from 'react'
import Dashboard from '../pages/Dashboard/Dashboard.jsx'
import Login from '../pages/Login/Login.jsx'
import { useAuth } from '../hooks/useAuth.js'
import { AppLink } from '../components/AppLink.jsx'
import { navigate } from './navigation.js'

function Shell({ children }) {
  const { session, logout } = useAuth()
  const isAdmin = session?.user.roles?.includes('admin')

  return (
    <div className="app-shell">
      <header className="topbar">
        <AppLink className="brand" href="/explorar">
          <span className="brand-mark">R</span>
          <span>roomlink</span>
        </AppLink>
        <nav aria-label="Navegación principal" className="main-nav">
          <AppLink href="/explorar">Explorar</AppLink>
          <AppLink href="/cuestionario">Mi test</AppLink>
          {isAdmin && <AppLink href="/admin/dashboard">Administración</AppLink>}
        </nav>
        <div className="account-menu">
          <span className="account-name">{session?.user.email}</span>
          <button
            className="button button-quiet"
            onClick={() => {
              logout()
              navigate('/login')
            }}
            type="button"
          >
            Cerrar sesión
          </button>
        </div>
      </header>
      <main className="page-container">{children}</main>
      <footer className="site-footer">
        <span>ROOMLINK</span>
        <span>Encuentra un espacio que se sienta como hogar.</span>
      </footer>
    </div>
  )
}

function AppRoutes() {
  const { session, loadingSession, sessionError } = useAuth()
  const [pathname, setPathname] = useState(window.location.pathname)

  useEffect(() => {
    const updatePath = () => setPathname(window.location.pathname)
    window.addEventListener('popstate', updatePath)
    return () => window.removeEventListener('popstate', updatePath)
  }, [])

  useEffect(() => {
    if (loadingSession) return
    if (!session && pathname !== '/login') navigate('/login')
    if (session && pathname === '/login') {
      navigate(session.user.roles?.includes('admin') ? '/admin/dashboard' : '/explorar')
    }
  }, [loadingSession, pathname, session])

  if (loadingSession) {
    return <div className="loading-screen">Preparando tu espacio…</div>
  }
  if (sessionError) {
    return <div className="notice notice-error" role="alert">{sessionError}</div>
  }
  if (!session || pathname === '/login') return <Login />

  const page = pathname.startsWith('/admin/')
    ? session.user.roles?.includes('admin')
      ? <Dashboard />
      : <section className="notice notice-error">Esta sección es solo para administradores.</section>
    : <section className="page-heading"><p className="eyebrow">ROOMLINK</p><h1>Tu próximo hogar empieza aquí</h1><p className="muted">Estamos preparando esta sección.</p></section>

  return <Shell>{page}</Shell>
}

export default AppRoutes
