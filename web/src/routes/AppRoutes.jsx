import { Fragment, useState } from "react";
import {
  Navigate,
  NavLink,
  Outlet,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import Dashboard from "../pages/Dashboard/Dashboard.jsx";
import Login from "../pages/Login/Login.jsx";
import { useAuth } from "../hooks/useAuth.js";
import { AppLink } from "../components/AppLink.jsx";
import { Brand, FeatureNotice } from "../features/cesar-ui.jsx";
import Notifications from "../features/Notifications.jsx";
import Messages from "../features/messaging/Messages.jsx";
import Moderation, {
  ModerationListing,
  ReportDirectory,
  ReportListing,
} from "../features/moderation/Moderation.jsx";
import Questionnaire from "../features/compatibility/Questionnaire.jsx";
import Recommendations from "../features/compatibility/Recommendations.jsx";
import { Workspace } from "../features/roomlink/Workspace.jsx";
import {
  AccountPage,
  PhotosPage,
  ProfilePage,
} from "../features/roomlink/Profile.jsx";
import { SearchPage } from "../features/roomlink/Search.jsx";
import { AgreementsPage } from "../features/roomlink/Agreements.jsx";
import PantallaAnunciosPrincipal from "../features/anuncios/pages/PantallaAnunciosPrincipal.jsx";
import PantallaDetallePublicacion from "../features/anuncios/pages/PantallaDetallePublicacion.jsx";
import PantallaPublicarHabitacion from "../features/anuncios/pages/PantallaPublicarHabitacion.jsx";
import PantallaUbicacion from "../features/anuncios/pages/PantallaUbicacion.jsx";
import PantallaFotos from "../features/anuncios/pages/PantallaFotos.jsx";
import PantallaEditarPublicacion from "../features/anuncios/pages/PantallaEditarPublicacion.jsx";


function Shell() {
  const { session, logout } = useAuth();
  const location = useLocation();
  const [signingOut, setSigningOut] = useState(false);
  const isAdmin = session?.user.roles?.includes("admin");
  const accountInitial = session?.user.email?.[0]?.toUpperCase() ?? "U";

  async function signOut() {
    setSigningOut(true);
    try {
      await logout();
    } catch {
      // The provider clears the local session even if the API is unavailable.
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#contenido">
        Saltar al contenido
      </a>
      <header className="topbar">
        <Brand />
        <nav aria-label="Navegación principal" className="main-nav">
          <NavLink to="/explorar">Explorar</NavLink>
          <NavLink to="/buscar">Buscar roomies</NavLink>
          <NavLink to="/cuestionario">Mi test</NavLink>
          <NavLink to="/mensajes">Mensajes</NavLink>
          <NavLink to="/notificaciones">Notificaciones</NavLink>
          <NavLink to="/acuerdos">Acuerdos</NavLink>
          <NavLink to="/anuncios">Mis anuncios</NavLink>

          <NavLink
            to="/perfil"
            end={location.pathname.startsWith("/perfil/candidato/")}
          >
            Mi perfil
          </NavLink>
          <NavLink
            to="/denunciar"
            className={({ isActive }) =>
              isActive || location.pathname.endsWith("/denunciar")
                ? "active"
                : undefined
            }
          >
            Denunciar anuncio
          </NavLink>
          {isAdmin && <NavLink to="/admin/moderacion">Moderación</NavLink>}
          {isAdmin && <NavLink to="/admin/dashboard">Dashboard</NavLink>}
        </nav>
        <div className="account-menu">
          <span aria-hidden="true" className="account-avatar">
            {accountInitial}
          </span>
          <span className="account-name">{session?.user.email}</span>
          <button
            className="button button-rose sign-out"
            disabled={signingOut}
            onClick={signOut}
            type="button"
          >
            {signingOut ? "Cerrando…" : "Cerrar sesión"}
          </button>
        </div>
      </header>
      <main id="contenido" className="page-container" tabIndex={-1}>
        <Outlet />
      </main>
    </div>
  );
}

function SessionLoading() {
  return (
    <div className="loading-screen" role="status">
      Preparando tu espacio…
    </div>
  );
}

function SessionError({ error, retry }) {
  return (
    <main className="session-error">
      <FeatureNotice error={error} retry={retry} />
    </main>
  );
}

function ProtectedLayout() {
  const { session, loadingSession, sessionError, retrySession } = useAuth();
  const location = useLocation();

  if (loadingSession) return <SessionLoading />;
  if (sessionError)
    return <SessionError error={sessionError} retry={retrySession} />;
  if (!session)
    return (
      <Navigate
        replace
        to="/login"
        state={{ from: location.pathname + location.search }}
      />
    );

  return <Shell />;
}

function AdminLayout() {
  const { session } = useAuth();
  if (!session?.user.roles?.includes("admin")) {
    return <Navigate replace to="/explorar" />;
  }
  return <Outlet />;
}

function AccessRoute({ mode }) {
  const { session, loadingSession, sessionError, retrySession } = useAuth();
  const { state } = useLocation();

  if (loadingSession) return <SessionLoading />;
  if (sessionError)
    return <SessionError error={sessionError} retry={retrySession} />;
  if (session && mode !== "reset") {
    const fallback = session.user.roles?.includes("admin")
      ? "/admin/dashboard"
      : "/explorar";
    const destination =
      typeof state?.from === "string" && /^\/(?![/\\])/.test(state.from)
        ? state.from
        : fallback;
    return <Navigate replace to={destination} />;
  }
  return <Login key={mode} mode={mode} />;
}

function NotFound() {
  return (
    <section className="page-heading">
      <p className="eyebrow">ROOMLINK</p>
      <h1>No encontramos esta página</h1>
      <p className="muted">Vuelve a explorar los perfiles disponibles.</p>
      <AppLink className="button button-primary" href="/explorar">
        Ir a explorar
      </AppLink>
    </section>
  );
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
          <Route element={<Recommendations />} path="/" />
          <Route element={<Recommendations />} path="/explorar" />
          <Route element={<Recommendations />} path="/recomendados" />
          <Route element={<PantallaAnunciosPrincipal />} path="/anuncios" />
          <Route
            element={<PantallaPublicarHabitacion />}
            path="/anuncios/publicar"
          />
          <Route
            path="/anuncios/:listingId"
            element={<PantallaDetallePublicacion />}
          />
          <Route
            path="/anuncios/:listingId/editar"
            element={<PantallaEditarPublicacion />}
          />
          <Route
            path="/anuncios/:listingId/ubicacion"
            element={<PantallaUbicacion />}
          />
          <Route
            path="/anuncios/:listingId/fotos"
            element={<PantallaFotos />}
          />
          <Route
            element={<Recommendations />}
            path="/perfil/candidato/:candidateId"
          />
          <Route element={<Questionnaire />} path="/cuestionario" />
          <Route element={<Questionnaire />} path="/resultados/test" />
          <Route element={<Workspace module="profile" />} path="/perfil">
            <Route element={<ProfilePage />} index />
            <Route element={<PhotosPage />} path="fotos" />
            <Route element={<AccountPage />} path="cuenta" />
          </Route>
          <Route element={<Workspace module="search" />} path="/buscar">
            <Route element={<SearchPage tab="filters" />} index />
            <Route element={<SearchPage tab="habits" />} path="habitos" />
            <Route element={<SearchPage tab="saved" />} path="guardadas" />
          </Route>
          <Route element={<Workspace module="agreements" />} path="/acuerdos">
            <Route element={<AgreementsPage tab="current" />} index />
            <Route element={<AgreementsPage tab="create" />} path="crear" />
            <Route
              element={<AgreementsPage tab="review" />}
              path="revisar/:agreementId?"
            />
          </Route>
          <Route element={<Messages />} path="/mensajes/:roomId?" />
          <Route element={<Notifications />} path="/notificaciones" />
          <Route element={<ReportDirectory />} path="/denunciar" />
          <Route
            element={<ReportListing />}
            path="/anuncios/:listingId/denunciar"
          />
          <Route element={<AdminLayout />} path="/admin">
            <Route element={<Dashboard />} path="dashboard" />
            <Route element={<Navigate replace to="cola" />} path="moderacion" />
            <Route
              element={<Moderation key="cola" tab="cola" />}
              path="moderacion/cola"
            />
            <Route
              element={<Moderation key="denuncias" tab="denuncias" />}
              path="moderacion/denuncias"
            />
            <Route
              element={<Moderation key="historial" tab="historial" />}
              path="moderacion/historial"
            />
            <Route
              element={<ModerationListing />}
              path="moderacion/anuncios/:listingId"
            />
          </Route>
        </Route>
        <Route element={<NotFound />} path="*" />
      </Routes>
    </Fragment>
  );
}
