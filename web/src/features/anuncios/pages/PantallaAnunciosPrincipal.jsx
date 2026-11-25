
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../../../hooks/useAuth.js";

import {
  obtenerMisPublicaciones,
  obtenerAnuncioPorId,
  obtenerUrlPrimeraFoto,
  pausarAnuncio,
  reactivarAnuncio,
  cerrarAnuncio,
} from "../services/anunciosService.js";

import FiltrosAnuncios from "../components/FiltrosAnuncios.jsx";
import TarjetaAnuncio from "../components/TarjetaAnuncio.jsx";
import BotonAnuncio from "../components/BotonAnuncio.jsx";

import "../styles/anuncios.css";

// ======================================================
// OBTENER DIRECCIÓN DE UNA PUBLICACIÓN
// ======================================================

function obtenerDireccion(anuncio) {
  if (!anuncio || typeof anuncio !== "object") {
    return "";
  }

  const posiblesUbicaciones = [
    anuncio.location,
    anuncio.geoLocation,
    anuncio.geo_location,
    anuncio.ubicacion,
    anuncio.address,
    anuncio.direccion,
  ];

  for (const ubicacion of posiblesUbicaciones) {
    if (typeof ubicacion === "string" && ubicacion.trim()) {
      return ubicacion.trim();
    }

    if (ubicacion && typeof ubicacion === "object") {
      const direccion =
        ubicacion.address ??
        ubicacion.direccion ??
        ubicacion.formattedAddress ??
        ubicacion.formatted_address ??
        ubicacion.fullAddress ??
        ubicacion.full_address;

      if (typeof direccion === "string" && direccion.trim()) {
        return direccion.trim();
      }
    }
  }

  return "";
}

// ======================================================
// NORMALIZAR RESPUESTA DEL DETALLE
// ======================================================

function obtenerAnuncioDetalle(resultado) {
  return (
    resultado?.anuncio ??
    resultado?.room ??
    resultado?.data?.anuncio ??
    resultado?.data?.room ??
    resultado?.data ??
    resultado
  );
}

function PantallaAnunciosPrincipal() {
  const { session } = useAuth();
  const navigate = useNavigate();

  const [anuncios, setAnuncios] = useState([]);
  const [filtroActivo, setFiltroActivo] = useState("todas");
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [cambiandoEstadoId, setCambiandoEstadoId] = useState(null);

  // ======================================================
  // CARGAR PUBLICACIONES Y SUS DIRECCIONES
  // ======================================================

  const cargarAnuncios = useCallback(async () => {
    if (!session?.token || !session?.user?.id) {
      setAnuncios([]);
      setError("No se encontró una sesión válida. Inicia sesión nuevamente.");
      setCargando(false);
      return;
    }

    setCargando(true);
    setError("");

    try {
      // Primera consulta: obtener todas las publicaciones.
      const resultado = await obtenerMisPublicaciones(
        session.token,
        session.user.id
      );

      const lista = Array.isArray(resultado) ? resultado : [];

      // Segunda consulta: obtener el detalle de cada publicación.
      const anunciosCompletos = await Promise.all(
        lista.map(async (anuncio) => {
          let detalle = null;
          let ubicacion = "";

          try {
            const respuestaDetalle = await obtenerAnuncioPorId(
              anuncio.id,
              session.token
            );

            detalle = obtenerAnuncioDetalle(respuestaDetalle);
            ubicacion = obtenerDireccion(detalle);

            console.log("DETALLE DE PUBLICACIÓN:", anuncio.id, detalle);
            console.log("DIRECCIÓN OBTENIDA:", anuncio.id, ubicacion);
          } catch (err) {
            console.error(
              `No se pudo obtener la ubicación del anuncio ${anuncio.id}:`,
              err
            );
          }

          return {
            id: anuncio.id,
            titulo: anuncio.title || anuncio.titulo || "",
            renta: anuncio.monthlyRent ?? anuncio.renta ?? 0,
            estado: anuncio.status ?? anuncio.estado,

            location: detalle?.location ?? null,
            geoLocation:
              detalle?.geoLocation ??
              detalle?.geo_location ??
              null,

            ubicacion,

            foto:
              Number(
                anuncio.photosCount ??
                detalle?.photosCount ??
                detalle?.photos?.length ??
                0
              ) > 0
                ? obtenerUrlPrimeraFoto(anuncio.id)
                : null,
          };
        })
      );

      setAnuncios(anunciosCompletos);
    } catch (err) {
      console.error("Error al cargar publicaciones:", err);
      setError(err.message || "No fue posible cargar tus publicaciones.");
    } finally {
      setCargando(false);
    }
  }, [session?.token, session?.user?.id]);

  useEffect(() => {
    cargarAnuncios();
  }, [cargarAnuncios]);

  // ======================================================
  // FILTRAR PUBLICACIONES
  // ======================================================

  const anunciosFiltrados = useMemo(() => {
    if (filtroActivo === "todas") {
      return anuncios;
    }

    return anuncios.filter(
      (anuncio) => anuncio.estado === filtroActivo
    );
  }, [anuncios, filtroActivo]);

  // ======================================================
  // CONTADORES
  // ======================================================

  const cantidades = useMemo(
    () => ({
      todas: anuncios.length,
      draft: anuncios.filter((anuncio) => anuncio.estado === "draft").length,
      published: anuncios.filter((anuncio) => anuncio.estado === "published").length,
      paused: anuncios.filter((anuncio) => anuncio.estado === "paused").length,
      closed: anuncios.filter((anuncio) => anuncio.estado === "closed").length,
    }),
    [anuncios]
  );

  // ======================================================
  // NAVEGACIÓN
  // ======================================================

  function verAnuncio(id) {
    navigate(`/anuncios/${id}`);
  }

  function editarAnuncio(id) {
    navigate(`/anuncios/${id}/editar`);
  }

  // ======================================================
  // CAMBIAR ESTADO DE UNA PUBLICACIÓN
  // ======================================================

  async function cambiarEstadoAnuncio(id, accion) {
    if (cambiandoEstadoId !== null) {
      return;
    }

    const anuncio = anuncios.find(
      (elemento) => String(elemento.id) === String(id)
    );

    if (!anuncio) {
      window.alert("No se encontró la publicación seleccionada.");
      return;
    }

    if (accion === "pausar" && anuncio.estado !== "published") {
      window.alert("Solamente puedes pausar una publicación que esté activa.");
      return;
    }

    if (accion === "activar" && anuncio.estado !== "paused") {
      window.alert("Solamente puedes activar una publicación que esté pausada.");
      return;
    }

    if (
      accion === "cerrar" &&
      !["published", "paused"].includes(anuncio.estado)
    ) {
      window.alert("Solamente puedes cerrar publicaciones activas o pausadas.");
      return;
    }

    const mensajes = {
      pausar: {
        confirmacion:
          "¿Deseas pausar esta publicación? Dejará de mostrarse como activa.",
        resultado: "La publicación se pausó correctamente.",
      },
      activar: {
        confirmacion: "¿Deseas volver a activar esta publicación?",
        resultado: "La publicación se activó correctamente.",
      },
      cerrar: {
        confirmacion:
          "¿Estás segura de que deseas cerrar esta publicación? Esta acción no se podrá deshacer desde la aplicación.",
        resultado: "La publicación se cerró correctamente.",
      },
    };

    const mensaje = mensajes[accion];

    if (!mensaje) {
      return;
    }

    const confirmado = window.confirm(mensaje.confirmacion);

    if (!confirmado) {
      return;
    }

    setCambiandoEstadoId(id);
    setError("");

    try {
      if (accion === "pausar") {
        await pausarAnuncio(id, session.token, session.user.id);
      }

      if (accion === "activar") {
        await reactivarAnuncio(id, session.token, session.user.id);
      }

      if (accion === "cerrar") {
        await cerrarAnuncio(id, session.token, session.user.id);
      }

      window.alert(mensaje.resultado);

      await cargarAnuncios();
    } catch (err) {
      console.error("Error al cambiar el estado:", err);
      window.alert(err.message || "No se pudo actualizar la publicación.");
    } finally {
      setCambiandoEstadoId(null);
    }
  }

  function pausar(id) {
    return cambiarEstadoAnuncio(id, "pausar");
  }

  function activar(id) {
    return cambiarEstadoAnuncio(id, "activar");
  }

  function cerrar(id) {
    return cambiarEstadoAnuncio(id, "cerrar");
  }

  // ======================================================
  // RENDERIZADO
  // ======================================================

  return (
    <main className="anuncios-contenedor">
      <header className="anuncios-encabezado">
        <div>
          <h1 className="anuncios-titulo">Mis anuncios</h1>

          <p className="anuncios-subtitulo">
            Administra las habitaciones que has publicado en RoomLink.
          </p>
        </div>

        <BotonAnuncio
          tipo="principal"
          onClick={() => navigate("/anuncios/publicar")}
        >
          + Publicar habitación
        </BotonAnuncio>
      </header>

      <section className="anuncios-resumen">
        <div>
          <span className="anuncios-resumen__numero">
            {cantidades.todas}
          </span>

          <span className="anuncios-resumen__texto">
            Publicaciones registradas
          </span>
        </div>
      </section>

      <section className="anuncios-listado">
        <div className="anuncios-listado__encabezado">
          <div>
            <h2>Tu inventario de habitaciones</h2>
            <p>Consulta y administra el estado de cada publicación.</p>
          </div>

          <BotonAnuncio
            tipo="secundario"
            onClick={cargarAnuncios}
            disabled={cargando || cambiandoEstadoId !== null}
          >
            Actualizar
          </BotonAnuncio>
        </div>

        <FiltrosAnuncios
          filtroActivo={filtroActivo}
          onCambiarFiltro={setFiltroActivo}
          cantidades={cantidades}
        />

        {cargando && (
          <div className="anuncios-mensaje">
            <span className="anuncios-cargando__indicador" />
            <p>Cargando tus publicaciones...</p>
          </div>
        )}

        {!cargando && error && (
          <div className="anuncios-mensaje anuncios-mensaje--error">
            <h3>No pudimos cargar tus anuncios</h3>
            <p>{error}</p>

            <BotonAnuncio tipo="secundario" onClick={cargarAnuncios}>
              Intentar nuevamente
            </BotonAnuncio>
          </div>
        )}

        {!cargando && !error && anuncios.length === 0 && (
          <div className="anuncios-vacio">
            <div className="anuncios-vacio__icono">⌂</div>

            <h3>Aún no tienes habitaciones registradas</h3>

            <p>
              Cuando registres una habitación, aparecerá aquí para que puedas
              administrarla. También podrás guardar borradores y completarlos
              después.
            </p>

            <BotonAnuncio
              tipo="principal"
              onClick={() => navigate("/anuncios/publicar")}
            >
              Publicar mi primera habitación
            </BotonAnuncio>
          </div>
        )}

        {!cargando &&
          !error &&
          anuncios.length > 0 &&
          anunciosFiltrados.length === 0 && (
            <div className="anuncios-vacio">
              <h3>No hay publicaciones en esta categoría</h3>
              <p>Prueba seleccionando otro filtro.</p>
            </div>
          )}

        {!cargando && !error && anunciosFiltrados.length > 0 && (
          <div className="anuncios-lista">
            {anunciosFiltrados.map((anuncio) => (
              <TarjetaAnuncio
                key={anuncio.id}
                anuncio={anuncio}
                onVer={verAnuncio}
                onEditar={editarAnuncio}
                onPausar={pausar}
                onActivar={activar}
                onCerrar={cerrar}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

export default PantallaAnunciosPrincipal;
