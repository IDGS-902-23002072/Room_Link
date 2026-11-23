import { Navigate, Outlet, Route, Routes, useNavigate } from 'react-router-dom'
import Button from '../components/Button/Button.jsx'
import Notice from '../components/Notice/Notice.jsx'
import PageHeader from '../components/PageHeader/PageHeader.jsx'
import Shell from '../components/Shell/Shell.jsx'
import Questionnaire from '../features/compatibility/Questionnaire.jsx'
import Recommendations from '../features/compatibility/Recommendations.jsx'
import { useAuth } from '../hooks/useAuth.js'
import Dashboard from '../pages/Dashboard/Dashboard.jsx'
import Login from '../pages/Login/Login.jsx'
import { push } from './navigation.js'
import styles from './AppRoutes.module.css'

function ProtectedLayout() {
  const { session, loadingSession, sessionError } = useAuth()

  if (loadingSession) {
    return (
      <div className={styles.center} role="status">
        <span className={styles.spinner} aria-hidden="true" />
        Preparando tu espacio…
      </div>
    )
  }

  if (sessionError) {
    return (
      <div className={styles.center}>
        <Notice className={styles.centerNotice} tone="error">
          {sessionError}
        </Notice>
      </div>
    )
  }

  if (!session) return <Navigate replace to="/login" />

  return (
    <Shell>
      <Outlet />
    </Shell>
  )
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

  return (
    <Login
      onLogin={(user) => push(navigate, user.roles?.includes('admin') ? '/admin/dashboard' : '/explorar')}
    />
  )
}

function NotFound() {
  return (
    <main className={styles.notFound}>
      <div className={styles.notFoundCard}>
        <PageHeader
          eyebrow="ROOMLINK"
          title="No encontramos esta página"
          description="Es posible que el enlace haya cambiado. Vuelve a explorar los perfiles disponibles."
        />
        <Button href="/explorar">Ir a explorar</Button>
      </div>
    </main>
  )
}

export default function AppRoutes() {
  return (
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
          <Route element={<Navigate replace to="dashboard" />} index />
          <Route element={<Dashboard />} path="dashboard" />
        </Route>
      </Route>
      <Route element={<NotFound />} path="*" />
    </Routes>
  )
}
