
import { useMemo, useState } from "react";
import { useAuth } from "../../../hooks/useAuth.js";
import { useConexiones } from "../hooks/useConexiones.js";
import TarjetaConexion from "../components/TarjetaConexion.jsx";
import EstadoVacio from "../components/EstadoVacio.jsx";
import "../conexiones.css";

const filtros = [
  { id: "all", label: "Todas" },
  { id: "incoming", label: "Recibidas" },
  { id: "outgoing", label: "Enviadas" },
  { id: "accepted", label: "Aceptadas" },
];

export default function ConexionesPage() {
  const { session } = useAuth();
  const [filtro, setFiltro] = useState("all");

  const {
    conexiones,
    cargando,
    error,
    actualizando,
    cargarConexiones,
    responder,
    cancelar,
  } = useConexiones(session?.token, session?.user?.id);

  // Filtra las conexiones según la pestaña seleccionada.
  const conexionesFiltradas = useMemo(() => {
    if (filtro === "accepted") {
      return conexiones.filter(
        (conexion) => conexion.status === "accepted"
      );
    }

    if (filtro === "incoming") {
      return conexiones.filter(
        (conexion) =>
          conexion.direction === "incoming" &&
          conexion.status === "pending"
      );
    }

    if (filtro === "outgoing") {
      return conexiones.filter(
        (conexion) =>
          conexion.direction === "outgoing" &&
          conexion.status === "pending"
      );
    }

    return conexiones.filter(
      (conexion) =>
        conexion.status === "pending" ||
        conexion.status === "accepted"
    );
  }, [conexiones, filtro]);

  // Calcula cuántas conexiones hay en cada categoría.
  const cantidades = useMemo(
    () => ({
      all: conexiones.filter(
        (conexion) =>
          conexion.status === "pending" ||
          conexion.status === "accepted"
      ).length,

      incoming: conexiones.filter(
        (conexion) =>
          conexion.direction === "incoming" &&
          conexion.status === "pending"
      ).length,

      outgoing: conexiones.filter(
        (conexion) =>
          conexion.direction === "outgoing" &&
          conexion.status === "pending"
      ).length,

      accepted: conexiones.filter(
        (conexion) => conexion.status === "accepted"
      ).length,
    }),
    [conexiones]
  );

  // Aceptar o rechazar una solicitud.
  async function manejarRespuesta(connectionId, decision) {
    await responder(connectionId, decision);
  }

  // Cancelar una solicitud enviada.
  async function manejarCancelacion(connectionId) {
    const confirmar = window.confirm(
      "¿Estás segura de que deseas cancelar esta solicitud?"
    );

    if (!confirmar) return;

    await cancelar(connectionId);
  }

  return (
    <section className="conexiones-page">
      <header className="conexiones-heading">
        <div>
          <span className="conexiones-eyebrow">ROOMLINK</span>

          <h1>Mis conexiones</h1>

          <p>
            Administra tus solicitudes y conecta con personas
            que pueden convertirse en tus próximos roomies.
          </p>
        </div>

        <button
          type="button"
          className="conexion-refresh-button"
          onClick={cargarConexiones}
          disabled={cargando || actualizando}
        >
          ↻ Actualizar
        </button>
      </header>

      <nav
        className="conexiones-filters"
        aria-label="Filtrar conexiones"
      >
        {filtros.map((item) => (
          <button
            key={item.id}
            type="button"
            className={
              filtro === item.id
                ? "conexiones-filter active"
                : "conexiones-filter"
            }
            onClick={() => setFiltro(item.id)}
            aria-pressed={filtro === item.id}
          >
            {item.label}
            <span>{cantidades[item.id]}</span>
          </button>
        ))}
      </nav>

      {error && (
        <div className="conexiones-error" role="alert">
          <p>{error}</p>

          <button
            type="button"
            onClick={cargarConexiones}
          >
            Intentar nuevamente
          </button>
        </div>
      )}

      {cargando ? (
        <div className="conexiones-loading" role="status">
          <div className="conexiones-spinner" />
          <p>Cargando tus conexiones...</p>
        </div>
      ) : conexionesFiltradas.length === 0 ? (
        <EstadoVacio tipo={filtro} />
      ) : (
        <div className="conexiones-grid">
          {conexionesFiltradas.map((conexion) => (
            <TarjetaConexion
              key={conexion.id}
              conexion={conexion}
              actualizando={actualizando}
              onResponder={manejarRespuesta}
              onCancelar={manejarCancelacion}
            />
          ))}
        </div>
      )}
    </section>
  );
}
