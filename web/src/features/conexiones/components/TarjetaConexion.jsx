
import { apiAssetUrl } from "../../../services/api.js";

// ==========================================
// UTILIDADES
// ==========================================

// Resolver la dirección de la fotografía.
function resolverUrlFoto(url) {
  if (!url) return "";

  if (/^https?:\/\//i.test(url)) {
    return url;
  }

  try {
    return apiAssetUrl(url);
  } catch {
    return "";
  }
}

// Obtener iniciales cuando el usuario no tiene fotografía.
function iniciales(nombre = "") {
  return nombre
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase() ?? "")
    .join("");
}

// Mostrar fecha en formato legible.
function fechaLegible(fecha) {
  if (!fecha) return "";

  const fechaConvertida = new Date(fecha);

  if (Number.isNaN(fechaConvertida.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(fechaConvertida);
}

// ==========================================
// COMPONENTE TARJETA DE CONEXIÓN
// ==========================================

export default function TarjetaConexion({
  conexion,
  actualizando,
  onResponder,
  onCancelar,
}) {
  const perfil = conexion.perfil;
  const foto = conexion.fotoPrincipal;

  const nombre = perfil?.fullName || "Usuario de RoomLink";
  const edad = perfil?.age;
  const fotoUrl = resolverUrlFoto(foto?.url);

  const esPendiente = conexion.status === "pending";
  const esAceptada = conexion.status === "accepted";
  const esRecibida = conexion.direction === "incoming";

  // Determinar el texto del estado.
  const textoEstado = esAceptada
    ? "Conexión aceptada"
    : esPendiente
      ? esRecibida
        ? "Solicitud recibida"
        : "Solicitud enviada"
      : conexion.status === "rejected"
        ? "Solicitud rechazada"
        : "Solicitud cancelada";

  return (
    <article className="conexion-card">

      {/* Información principal del usuario */}
      <div className="conexion-card-header">
        <div className="conexion-avatar">
          {fotoUrl ? (
            <img
              src={fotoUrl}
              alt={`Fotografía de ${nombre}`}
              onError={(event) => {
                event.currentTarget.style.display = "none";
                event.currentTarget.parentElement
                  ?.classList.add("conexion-avatar-fallback");
              }}
            />
          ) : (
            <span>{iniciales(nombre) || "U"}</span>
          )}
        </div>

        <div className="conexion-user-info">
          <div className="conexion-name-row">
            <h3>{nombre}</h3>

            {perfil?.isVerified && (
              <span
                className="conexion-verified"
                title="Identidad verificada"
                aria-label="Identidad verificada"
              >
                ✓
              </span>
            )}
          </div>

          <p>
            {edad != null ? `${edad} años` : "Edad no disponible"}

            {perfil?.occupation
              ? ` · ${perfil.occupation}`
              : ""}
          </p>
        </div>
      </div>

      {/* Biografía del usuario */}
      {perfil?.bio && (
        <p className="conexion-bio">
          {perfil.bio}
        </p>
      )}

      {/* Estado y fecha de la conexión */}
      <div className="conexion-card-footer">
        <div className="conexion-status">
          <span
            className={`conexion-status-dot ${conexion.status}`}
          />

          <span>{textoEstado}</span>
        </div>

        <span className="conexion-date">
          {fechaLegible(conexion.createdAt)}
        </span>
      </div>

      {/* Acciones para solicitudes pendientes */}
      {esPendiente && (
        <div className="conexion-actions">

          {esRecibida ? (
            <>
              <button
                type="button"
                className="conexion-button conexion-button-primary"
                disabled={actualizando}
                onClick={() =>
                  onResponder(conexion.id, "accept")
                }
              >
                Aceptar
              </button>

              <button
                type="button"
                className="conexion-button conexion-button-outline"
                disabled={actualizando}
                onClick={() =>
                  onResponder(conexion.id, "reject")
                }
              >
                Rechazar
              </button>
            </>
          ) : (
            <button
              type="button"
              className="conexion-button conexion-button-outline"
              disabled={actualizando}
              onClick={() => onCancelar(conexion.id)}
            >
              Cancelar solicitud
            </button>
          )}

        </div>
      )}

      {/* Mensaje para conexiones aceptadas */}
      {esAceptada && (
        <div className="conexion-accepted-message">
          <span aria-hidden="true">♥</span>
          Ya pueden conectar en RoomLink
        </div>
      )}

    </article>
  );
}
