import { Fragment } from 'react'
import { Navigate, NavLink, Outlet, Route, Routes, useNavigate } from 'react-router-dom'
import Dashboard from '../pages/Dashboard/Dashboard.jsx'
import Login from '../pages/Login/Login.jsx'
import { useAuth } from '../hooks/useAuth.js'
import { AppLink } from '../components/AppLink.jsx'
import { push } from './navigation.js'
import Questionnaire from '../features/compatibility/Questionnaire.jsx'
import Recommendations from '../features/compatibility/Recommendations.jsx'

function Shell() {
  const { session, logout } = useAuth()
  const navigate = useNavigate()
  const isAdmin = session?.user.roles?.includes('admin')
  const accountInitial = session?.user.email?.[0]?.toUpperCase() ?? 'U'

  function signOut() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <AppLink className="brand" href="/explorar">
          <span>RoomLink</span>
        </AppLink>
        <nav aria-label="Navegación principal" className="main-nav">
          <NavLink to="/explorar">Explorar</NavLink>
          <span aria-disabled="true">Mensajes</span>
          <span aria-disabled="true">Solicitudes</span>
          <NavLink to="/cuestionario">Mi test</NavLink>
          {isAdmin && <NavLink to="/admin/dashboard">Dashboard</NavLink>}
        </nav>
        <div className="account-menu">
          <span aria-hidden="true" className="account-avatar">{accountInitial}</span>
          <span className="account-name">{session?.user.email}</span>
          <button className="button button-quiet" onClick={signOut} type="button">
            Cerrar sesión
          </button>
        </div>
      </header>
      <main className="page-container">
        <Outlet />
      </main>
    </div>
  )
}

function ProtectedLayout() {
  const { session, loadingSession, sessionError } = useAuth()

  if (loadingSession) {
    return <div className="loading-screen">Preparando tu espacio…</div>
  }
  if (sessionError) {
    return <div className="notice notice-error" role="alert">{sessionError}</div>
  }
  if (!session) return <Navigate replace to="/login" />

  return <Shell />
}

function AdminLayout() {
  const { session } = useAuth()
  if (!session?.user.roles?.includes('admin')) {
    return <Navigate replace to="/explorar" />
  }
  return <Outlet />
}

function LoginRoute() {
  const { session } = useAuth()
  const navigate = useNavigate()

  if (session) {
    return (
      <Navigate
        replace
        to={session.user.roles?.includes('admin') ? '/admin/dashboard' : '/explorar'}
      />
    )
  }
  return <Login onLogin={(user) => push(navigate, user.roles?.includes('admin') ? '/admin/dashboard' : '/explorar')} />
}

function NotFound() {
  return (
    <section className="page-heading">
      <p className="eyebrow">ROOMLINK</p>
      <h1>No encontramos esta página</h1>
      <p className="muted">Vuelve a explorar los perfiles disponibles.</p>
      <AppLink className="button button-primary" href="/explorar">Ir a explorar</AppLink>
    </section>
  )
}

export default function AppRoutes() {
  return (
    <Fragment>
      <Routes>
        <Route element={<LoginRoute />} path="/login" />
        <Route element={<ProtectedLayout />}>
          <Route element={<Recommendations />} path="/" />
          <Route element={<Recommendations />} path="/explorar" />
          <Route element={<Recommendations />} path="/recomendados" />
          <Route element={<Recommendations />} path="/perfil/candidato/:candidateId" />
          <Route element={<Questionnaire />} path="/cuestionario" />
          <Route element={<Questionnaire />} path="/resultados/test" />
          <Route element={<AdminLayout />} path="/admin">
            <Route element={<Dashboard />} path="dashboard" />
          </Route>
        </Route>
        <Route element={<NotFound />} path="*" />
      </Routes>
    </Fragment>
  )
}
