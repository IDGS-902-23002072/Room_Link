import { Fragment } from 'react'
import { Navigate, Outlet, Route, Routes, useLocation, useParams } from 'react-router-dom'
import ActivityLog from '../pages/ActivityLog/ActivityLog.jsx'
import Dashboard from '../pages/Dashboard/Dashboard.jsx'
import Login from '../pages/Login/Login.jsx'
import { useAuth } from '../hooks/useAuth.js'
import Shell from '../components/Navigation/AppShell.jsx'
import LoadingState from '../components/LoadingState/LoadingState.jsx'
import { AppLink } from '../components/AppLink.jsx'
import { FeatureNotice } from '../features/cesar-ui.jsx'
import Notifications from '../features/Notifications.jsx'
import Messages from '../features/messaging/Messages.jsx'
import Moderation, { ModerationListing, ReportDirectory, ReportListing } from '../features/moderation/Moderation.jsx'
import Questionnaire from '../features/compatibility/Questionnaire.jsx'
import Recommendations from '../features/compatibility/Recommendations.jsx'
import RoomDetail from '../features/rooms/RoomDetail.jsx'
import RoomFeed from '../features/rooms/RoomFeed.jsx'
import { Workspace } from '../features/roomlink/Workspace.jsx'
import { AccountPage, HostEnrollmentPage, IdentityReviewsPage, PhotosPage, ProfilePage } from '../features/roomlink/Profile.jsx'
import { SearchPage } from '../features/roomlink/Search.jsx'
import { AgreementsPage } from '../features/roomlink/Agreements.jsx'
import { ListingDetail, ListingDirectory } from '../features/listings/ListingDirectory.jsx'
import { HostApplications, MyApplications } from '../features/listings/Applications.jsx'
import { HostListings, ManageListingPage, NewListing } from '../features/listings/HostListings.jsx'
import PantallaAnunciosPrincipal from '../features/anuncios/pages/PantallaAnunciosPrincipal.jsx'
import PantallaDetallePublicacion from '../features/anuncios/pages/PantallaDetallePublicacion.jsx'
import PantallaPublicarHabitacion from '../features/anuncios/pages/PantallaPublicarHabitacion.jsx'
import PantallaUbicacion from '../features/anuncios/pages/PantallaUbicacion.jsx'
import PantallaFotos from '../features/anuncios/pages/PantallaFotos.jsx'
import PantallaEditarPublicacion from '../features/anuncios/pages/PantallaEditarPublicacion.jsx'
import ConexionesPage from '../features/conexiones/pages/ConexionesPage.jsx'
import MisRoomiesPage from '../features/conexiones/pages/MisRoomiesPage.jsx'
import '../features/listings/listings.css'

function SessionLoading() {
  return <LoadingState label="Preparando tu espacio en RoomLink…" fullscreen />
}

function SessionError({ error, retry }) {
  return <main className="session-error"><FeatureNotice error={error} retry={retry} /></main>
}

function ProtectedLayout() {
  const { session, loadingSession, sessionError, retrySession } = useAuth()
  const location = useLocation()

  if (loadingSession) return <SessionLoading />
  if (sessionError) return <SessionError error={sessionError} retry={retrySession} />
  if (!session) return <Navigate replace to="/login" state={{ from: location.pathname + location.search }} />

  return <Shell />
}

function AdminLayout() {
  const { session } = useAuth()
  if (!session?.user.roles?.includes('admin')) {
    return <Navigate replace to="/explorar" />
  }
  return <Outlet />
}

function AccessRoute({ mode }) {
  const { session, loadingSession, sessionError, retrySession } = useAuth()
  const { state } = useLocation()

  if (loadingSession) return <SessionLoading />
  if (sessionError) return <SessionError error={sessionError} retry={retrySession} />
  if (session && mode !== 'reset') {
    const fallback = session.user.roles?.includes('admin') ? '/admin/dashboard' : '/explorar'
    const destination = typeof state?.from === 'string' && /^\/(?![/\\])/.test(state.from) ? state.from : fallback
    return <Navigate replace to={destination} />
  }
  return <Login key={mode} mode={mode} />
}

function RoomDetailRoute() {
  const { roomId } = useParams()
  return <RoomDetail roomId={roomId} />
}

function NotFound() {
  return (
    <section className="page-heading">
      <p className="eyebrow">ROOMLINK</p>
      <h1>No encontramos esta página</h1>
      <p className="muted">Vuelve a explorar las habitaciones disponibles.</p>
      <AppLink className="button button-primary" href="/explorar">Ir a explorar</AppLink>
    </section>
  )
}

export default function AppRoutes() {
  return (
    <Fragment>
      <Routes>
        <Route element={<AccessRoute mode="login" />} path="/login" />
        <Route element={<AccessRoute mode="register" />} path="/registro" />
        <Route element={<AccessRoute mode="forgot" />} path="/recuperar" />
        <Route element={<AccessRoute mode="reset" />} path="/restablecer" />
        <Route element={<ProtectedLayout />}>
          <Route element={<RoomFeed />} path="/" />
          <Route element={<RoomFeed />} path="/explorar" />
          <Route element={<RoomDetailRoute />} path="/habitacion/:roomId" />
          <Route element={<Recommendations />} path="/recomendados" />
          <Route element={<Recommendations />} path="/perfil/candidato/:candidateId" />
          <Route element={<ListingDirectory />} path="/habitaciones" />
          <Route element={<ListingDetail />} path="/habitaciones/:listingId" />
          <Route element={<MyApplications />} path="/mis-postulaciones" />
          <Route element={<HostListings />} path="/anfitrion" />
          <Route element={<NewListing />} path="/anfitrion/habitaciones/nueva" />
          <Route element={<ManageListingPage />} path="/anfitrion/habitaciones/:listingId" />
          <Route element={<HostApplications />} path="/anfitrion/habitaciones/:listingId/postulaciones" />
          <Route element={<PantallaAnunciosPrincipal />} path="/anuncios" />
          <Route element={<PantallaPublicarHabitacion />} path="/anuncios/publicar" />
          <Route element={<PantallaDetallePublicacion />} path="/anuncios/:listingId" />
          <Route element={<PantallaEditarPublicacion />} path="/anuncios/:listingId/editar" />
          <Route element={<PantallaUbicacion />} path="/anuncios/:listingId/ubicacion" />
          <Route element={<PantallaFotos />} path="/anuncios/:listingId/fotos" />
          <Route element={<ConexionesPage />} path="/conexiones" />
          <Route element={<MisRoomiesPage />} path="/mis-roomies" />
          <Route element={<Questionnaire />} path="/cuestionario" />
          <Route element={<Questionnaire />} path="/resultados/test" />
          <Route element={<Workspace module="profile" />} path="/perfil">
            <Route element={<ProfilePage />} index />
            <Route element={<PhotosPage />} path="fotos" />
            <Route element={<AccountPage />} path="cuenta" />
            <Route element={<HostEnrollmentPage />} path="arrendador" />
          </Route>
          <Route element={<Workspace module="search" />} path="/buscar">
            <Route element={<SearchPage tab="filters" />} index />
            <Route element={<SearchPage tab="habits" />} path="habitos" />
            <Route element={<SearchPage tab="saved" />} path="guardadas" />
          </Route>
          <Route element={<Workspace module="agreements" />} path="/acuerdos">
            <Route element={<AgreementsPage tab="current" />} index />
            <Route element={<AgreementsPage tab="create" />} path="crear" />
            <Route element={<AgreementsPage tab="review" />} path="revisar/:agreementId?" />
          </Route>
          <Route element={<Messages />} path="/mensajes/:roomId?" />
          <Route element={<Notifications />} path="/notificaciones" />
          <Route element={<ReportDirectory />} path="/denunciar" />
          <Route element={<ReportListing />} path="/anuncios/:listingId/denunciar" />
          <Route element={<AdminLayout />} path="/admin">
            <Route element={<Dashboard />} path="dashboard" />
            <Route element={<IdentityReviewsPage />} path="identidad" />
            <Route element={<ActivityLog />} path="bitacora" />
            <Route element={<Navigate replace to="cola" />} path="moderacion" />
            <Route element={<Moderation key="cola" tab="cola" />} path="moderacion/cola" />
            <Route element={<Moderation key="denuncias" tab="denuncias" />} path="moderacion/denuncias" />
            <Route element={<Moderation key="historial" tab="historial" />} path="moderacion/historial" />
            <Route element={<ModerationListing />} path="moderacion/anuncios/:listingId" />
          </Route>
        </Route>
        <Route element={<NotFound />} path="*" />
      </Routes>
    </Fragment>
  )
}
