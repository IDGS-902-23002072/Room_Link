
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../../../hooks/useAuth.js";
import { apiAssetUrl } from "../../../services/api.js";
import { useConexiones } from "../hooks/useConexiones.js";
import { abrirSalaChat } from "../services/conexionesApi.js";

import "../conexiones.css";


function obtenerNombre(perfil) {
  return perfil?.fullName || "Usuario de RoomLink";
}

function obtenerIniciales(nombre) {
  return nombre
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0].toUpperCase())
    .join("");
}

function formatearFecha(fecha) {
  if (!fecha) return "Fecha no disponible";

  const date = new Date(fecha);

  if (Number.isNaN(date.getTime())) {
    return "Fecha no disponible";
  }

  return date.toLocaleDateString("es-MX", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function obtenerUrlFoto(foto) {
  if (!foto?.url) return "";

  if (/^https?:\/\//i.test(foto.url)) {
    return foto.url;
  }

  try {
    return apiAssetUrl(foto.url);
  } catch {
    return "";
  }
}

export default function MisRoomiesPage() {
  const navigate = useNavigate();
  const { session } = useAuth();

  const {
    conexiones,
    cargando,
    error,
    cargarConexiones,
  } = useConexiones(session?.token, session?.user?.id);

  const [abriendoChat, setAbriendoChat] = useState(null);
  const [errorChat, setErrorChat] = useState("");

  // Solamente mostramos conexiones aceptadas.
  const roomies = useMemo(
    () =>
      conexiones.filter(
        (conexion) => conexion.status === "accepted"
      ),
    [conexiones]
  );

  async function manejarIrAlChat(connectionId) {
    try {
      setErrorChat("");
      setAbriendoChat(connectionId);

      const sala = await abrirSalaChat(
        session.token,
        connectionId
      );

      const roomId =
        sala?.id ||
        sala?.room?.id ||
        sala?.roomId;

      if (!roomId) {
        throw new Error(
          "No se pudo obtener la sala de chat."
        );
      }

      navigate(
        `/mensajes/${encodeURIComponent(roomId)}`
      );
    } catch (error) {
      setErrorChat(
        error.message || "No se pudo abrir el chat."
      );
    } finally {
      setAbriendoChat(null);
    }
  }

  return (
    <main className="mis-roomies-page">
      <header className="mis-roomies-header">
        <div>
          <span className="mis-roomies-eyebrow">
            ROOMLINK / CONEXIONES
          </span>

          <h1>Mis roomies</h1>

          <p>
            Aquí encontrarás a las personas con quienes
            ya conectaste. ¡Tu próxima historia puede comenzar aquí!
          </p>
        </div>

        <div className="mis-roomies-count">
          <strong>{roomies.length}</strong>
          <span>
            {roomies.length === 1
              ? "conexión"
              : "conexiones"}
          </span>
        </div>
      </header>

      {error && (
        <div className="mis-roomies-error" role="alert">
          <span>{error}</span>

          <button
            type="button"
            onClick={cargarConexiones}
          >
            Reintentar
          </button>
        </div>
      )}

      {errorChat && (
        <div className="mis-roomies-error" role="alert">
          {errorChat}
        </div>
      )}

      {cargando ? (
        <div
          className="mis-roomies-loading"
          role="status"
        >
          <div className="mis-roomies-spinner" />
          <p>Cargando tus roomies...</p>
        </div>
      ) : roomies.length === 0 ? (
        <section className="mis-roomies-empty">
          <div className="mis-roomies-empty-icon">
            ♡
          </div>

          <h2>Aún no tienes roomies</h2>

          <p>
            Cuando aceptes o alguien acepte una solicitud
            de conexión, aparecerá aquí.
          </p>

          <button
            type="button"
            onClick={() => navigate("/conexiones")}
          >
            Ver mis solicitudes
          </button>
        </section>
      ) : (
        <section className="mis-roomies-list">
          {roomies.map((conexion) => {
            const perfil = conexion.perfil || {};
            const nombre = obtenerNombre(perfil);
            const fotoUrl = obtenerUrlFoto(
              conexion.fotoPrincipal
            );

            return (
              <article
                className="roomie-card"
                key={conexion.id}
              >
                <div className="roomie-card-person">
                  <div className="roomie-avatar">
                    {fotoUrl ? (
                      <img
                        src={fotoUrl}
                        alt={`Foto de ${nombre}`}
                        onError={(event) => {
                          event.currentTarget.style.display =
                            "none";
                          event.currentTarget.parentElement.classList.add(
                            "roomie-avatar-fallback"
                          );
                        }}
                      />
                    ) : (
                      <span>
                        {obtenerIniciales(nombre) || "U"}
                      </span>
                    )}
                  </div>

                  <div className="roomie-info">
                    <div className="roomie-name-line">
                      <h2>{nombre}</h2>

                      {perfil.isVerified && (
                        <span
                          className="roomie-verified"
                          title="Perfil verificado"
                        >
                          ✓
                        </span>
                      )}
                    </div>

                    {perfil.occupation && (
                      <p className="roomie-occupation">
                        {perfil.occupation}
                      </p>
                    )}

                    {perfil.age && (
                      <span className="roomie-age">
                        {perfil.age} años
                      </span>
                    )}

                    {perfil.bio && (
                      <p className="roomie-bio">
                        {perfil.bio}
                      </p>
                    )}
                  </div>
                </div>

                <div className="roomie-card-footer">
                  <div className="roomie-connection-date">
                    <span>Conectaron el</span>
                    <strong>
                      {formatearFecha(
                        conexion.respondedAt
                      )}
                    </strong>
                  </div>

                  <button
                    type="button"
                    className="roomie-chat-button"
                    onClick={() =>
                      manejarIrAlChat(conexion.id)
                    }
                    disabled={
                      abriendoChat === conexion.id
                    }
                  >
                    {abriendoChat === conexion.id
                      ? "Abriendo chat..."
                      : "Ir al chat"}
                    <span aria-hidden="true">→</span>
                  </button>
                </div>
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
}
