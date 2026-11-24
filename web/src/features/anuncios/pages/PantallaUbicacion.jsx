
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import {
  MapContainer,
  TileLayer,
  Marker,
  useMap,
  useMapEvents,
} from "react-leaflet";

import L from "leaflet";

import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

import { useAuth } from "../../../hooks/useAuth.js";

import {
  actualizarAnuncio,
  obtenerAnuncioPorId,
} from "../services/anunciosService.js";

import BotonAnuncio from "../components/BotonAnuncio.jsx";

import "leaflet/dist/leaflet.css";
import "../styles/anuncios.css";

// ======================================================
// CONFIGURAR ICONO DEL MARCADOR PARA VITE
// ======================================================

delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

// ======================================================
// CONFIGURACIÓN DEL MAPA
// ======================================================

const CENTRO_INICIAL = [21.019, -101.2574];

const URL_MAPA =
  "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

const ATRIBUCION_MAPA =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors';

// ======================================================
// COMPONENTE: DETECTAR CLIC EN EL MAPA
// ======================================================

function SeleccionarPunto({ onSeleccionar }) {
  useMapEvents({
    click(evento) {
      onSeleccionar({
        lat: evento.latlng.lat,
        lng: evento.latlng.lng,
      });
    },
  });

  return null;
}

// ======================================================
// COMPONENTE: ACTUALIZAR CENTRO DEL MAPA
// ======================================================

function ActualizarCentro({ coordenadas }) {
  const mapa = useMap();

  useEffect(() => {
    if (!coordenadas) return;

    mapa.setView(
      [coordenadas.lat, coordenadas.lng],
      16,
      { animate: true },
    );
  }, [coordenadas, mapa]);

  return null;
}

// ======================================================
// COMPONENTE: MARCADOR ARRASTRABLE
// ======================================================

function MarcadorUbicacion({
  coordenadas,
  onSeleccionar,
}) {
  return (
    <Marker
      position={[coordenadas.lat, coordenadas.lng]}
      draggable
      eventHandlers={{
        dragend(evento) {
          const posicion = evento.target.getLatLng();

          onSeleccionar({
            lat: posicion.lat,
            lng: posicion.lng,
          });
        },
      }}
    />
  );
}

// ======================================================
// NORMALIZAR RESPUESTA DE UBICACIÓN
// ======================================================

function obtenerUbicacion(anuncio) {
  return anuncio?.location ?? anuncio?.ubicacion ?? null;
}

// ======================================================
// PANTALLA DE UBICACIÓN
// ======================================================

export default function PantallaUbicacion() {
  const { listingId } = useParams();
  const navigate = useNavigate();

  const { session, loadingSession } = useAuth();

  const token = session?.token;
  const userId = session?.user?.id;

  // ====================================================
  // DATOS DEL ANUNCIO
  // ====================================================

  const [anuncio, setAnuncio] = useState(null);

  const [direccion, setDireccion] = useState("");
  const [coordenadas, setCoordenadas] = useState(null);

  // ====================================================
  // ESTADOS DE CARGA
  // ====================================================

  const [cargando, setCargando] = useState(true);
  const [cargandoMapa, setCargandoMapa] = useState(true);

  const [buscando, setBuscando] = useState(false);
  const [buscandoDireccionMapa, setBuscandoDireccionMapa] =
    useState(false);

  const [guardando, setGuardando] = useState(false);

  // ====================================================
  // MENSAJES
  // ====================================================

  const [error, setError] = useState("");
  const [errorMapa, setErrorMapa] = useState("");

  // ====================================================
  // REFERENCIAS
  // ====================================================

  const solicitudDireccionRef = useRef(0);
  const controladorBusquedaRef = useRef(null);

  // ====================================================
  // ESTADO DE LA PUBLICACIÓN
  // ====================================================

  const estadoAnuncio = String(
    anuncio?.status ?? anuncio?.estado ?? "",
  ).toLowerCase();

  const estaCerrado = estadoAnuncio === "closed";

  // ====================================================
  // CONSULTAR INFORMACIÓN DEL ANUNCIO
  // ====================================================

  useEffect(() => {
    if (loadingSession) return;

    let activo = true;

    async function cargarAnuncio() {
      try {
        setCargando(true);
        setError("");

        if (!token || !userId) {
          throw new Error(
            "Tu sesión no está disponible. Inicia sesión nuevamente.",
          );
        }

        if (!listingId) {
          throw new Error(
            "No se encontró el identificador del anuncio.",
          );
        }

        const resultado = await obtenerAnuncioPorId(
          listingId,
          token,
        );

        if (!activo) return;

        if (!resultado) {
          throw new Error("No se encontró el anuncio.");
        }

        setAnuncio(resultado);

        const ubicacion = obtenerUbicacion(resultado);

        if (ubicacion) {
          const direccionGuardada =
            ubicacion.address ??
            ubicacion.direccion ??
            "";

          setDireccion(direccionGuardada);

          const lat = Number(
            ubicacion.latitude ?? ubicacion.lat,
          );

          const lng = Number(
            ubicacion.longitude ?? ubicacion.lng,
          );

          if (
            Number.isFinite(lat) &&
            Number.isFinite(lng) &&
            lat >= -90 &&
            lat <= 90 &&
            lng >= -180 &&
            lng <= 180
          ) {
            setCoordenadas({ lat, lng });
          }
        }
      } catch (err) {
        if (activo) {
          setError(
            err.message || "No se pudo cargar el anuncio.",
          );
        }
      } finally {
        if (activo) {
          setCargando(false);
        }
      }
    }

    cargarAnuncio();

    return () => {
      activo = false;

      solicitudDireccionRef.current++;

      controladorBusquedaRef.current?.abort();
    };
  }, [listingId, token, userId, loadingSession]);

  // ====================================================
  // OBTENER DIRECCIÓN A PARTIR DE COORDENADAS
  // REVERSE GEOCODING
  // ====================================================

  async function obtenerDireccionPorCoordenadas(lat, lng) {
    const solicitudActual =
      ++solicitudDireccionRef.current;

    controladorBusquedaRef.current?.abort();

    const controlador = new AbortController();

    controladorBusquedaRef.current = controlador;

    try {
      setBuscandoDireccionMapa(true);
      setErrorMapa("");

      const parametros = new URLSearchParams({
        format: "jsonv2",
        lat: String(lat),
        lon: String(lng),
        zoom: "18",
        addressdetails: "1",
        "accept-language": "es",
      });

      const respuesta = await fetch(
        `https://nominatim.openstreetmap.org/reverse?${parametros.toString()}`,
        {
          headers: {
            Accept: "application/json",
          },
          signal: controlador.signal,
        },
      );

      if (!respuesta.ok) {
        throw new Error(
          "No se pudo consultar la dirección de este punto.",
        );
      }

      const resultado = await respuesta.json();

      if (
        solicitudActual !== solicitudDireccionRef.current
      ) {
        return;
      }

      if (resultado.display_name) {
        setDireccion(resultado.display_name);
        setErrorMapa("");
      } else {
        setDireccion("");

        setErrorMapa(
          "No encontramos una dirección para este punto. Busca la dirección en el mapa o escríbela manualmente. También puedes revisar que el punto seleccionado sea correcto.",
        );
      }
    } catch (err) {
      if (err.name === "AbortError") return;

      if (
        solicitudActual === solicitudDireccionRef.current
      ) {
        setErrorMapa(
          "No pudimos identificar la dirección de este punto. Puedes buscarla en el mapa o escribirla manualmente.",
        );
      }
    } finally {
      if (
        solicitudActual === solicitudDireccionRef.current
      ) {
        setBuscandoDireccionMapa(false);
      }
    }
  }

  // ====================================================
  // SELECCIONAR COORDENADAS EN EL MAPA
  // ====================================================

  function seleccionarCoordenadas(nuevasCoordenadas) {
    if (estaCerrado || guardando) return;

    const lat = Number(nuevasCoordenadas.lat);
    const lng = Number(nuevasCoordenadas.lng);

    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180
    ) {
      setErrorMapa("Las coordenadas seleccionadas no son válidas.");
      return;
    }

    setCoordenadas({ lat, lng });

    setError("");
    setErrorMapa("");
    setDireccion("");

    obtenerDireccionPorCoordenadas(lat, lng);
  }

  // ====================================================
  // BUSCAR DIRECCIÓN ESCRITA POR EL USUARIO
  // SEARCH
  // ====================================================

  async function buscarDireccion(evento) {
    evento.preventDefault();

    const textoBusqueda = direccion.trim();

    if (!textoBusqueda) {
      setError(
        "Escribe una dirección para buscarla en el mapa.",
      );
      return;
    }

    const solicitudActual =
      ++solicitudDireccionRef.current;

    controladorBusquedaRef.current?.abort();

    const controlador = new AbortController();

    controladorBusquedaRef.current = controlador;

    try {
      setBuscando(true);
      setError("");
      setErrorMapa("");

      const parametros = new URLSearchParams({
        format: "jsonv2",
        q: textoBusqueda,
        limit: "1",
        countrycodes: "mx",
        "accept-language": "es",
      });

      const respuesta = await fetch(
        `https://nominatim.openstreetmap.org/search?${parametros.toString()}`,
        {
          headers: {
            Accept: "application/json",
          },
          signal: controlador.signal,
        },
      );

      if (!respuesta.ok) {
        throw new Error(
          "No se pudo consultar el servicio de búsqueda de direcciones. Inténtalo nuevamente.",
        );
      }

      const resultados = await respuesta.json();

      if (
        solicitudActual !== solicitudDireccionRef.current
      ) {
        return;
      }

      if (
        !Array.isArray(resultados) ||
        resultados.length === 0
      ) {
        setError(
          "No encontramos esa dirección. Revisa que esté escrita correctamente o selecciona directamente el punto donde se encuentra tu habitación en el mapa.",
        );

        return;
      }

      const lugar = resultados[0];

      const nuevaCoordenada = {
        lat: Number(lugar.lat),
        lng: Number(lugar.lon),
      };

      if (
        !Number.isFinite(nuevaCoordenada.lat) ||
        !Number.isFinite(nuevaCoordenada.lng)
      ) {
        throw new Error(
          "El servicio devolvió coordenadas no válidas.",
        );
      }

      setCoordenadas(nuevaCoordenada);
      setDireccion(lugar.display_name);

      setError("");
      setErrorMapa("");
    } catch (err) {
      if (err.name === "AbortError") return;

      if (
        solicitudActual === solicitudDireccionRef.current
      ) {
        setError(
          err.message || "No se pudo buscar la dirección.",
        );
      }
    } finally {
      if (
        solicitudActual === solicitudDireccionRef.current
      ) {
        setBuscando(false);
      }
    }
  }

  // ====================================================
  // EDITAR DIRECCIÓN MANUALMENTE
  // ====================================================

  function cambiarDireccion(evento) {
    solicitudDireccionRef.current++;

    controladorBusquedaRef.current?.abort();

    setDireccion(evento.target.value);

    setError("");
    setErrorMapa("");

    setBuscando(false);
    setBuscandoDireccionMapa(false);
  }

  // ====================================================
  // PREPARAR DATOS PARA ACTUALIZAR
  // ====================================================

  function obtenerDatosActualizacion() {
    const ubicacionActual = obtenerUbicacion(anuncio);

    return {
      titulo:
        anuncio.title ??
        anuncio.titulo ??
        "",

      renta:
        anuncio.monthlyRent ??
        anuncio.renta ??
        "",

      descripcion:
        anuncio.description ??
        anuncio.descripcion ??
        "",

      ubicacion: direccion.trim(),

      latitude: coordenadas.lat,
      longitude: coordenadas.lng,

      availableFrom:
        anuncio.availableFrom ??
        anuncio.available_from ??
        "",

      maxRoommates:
        anuncio.maxRoommates ??
        anuncio.max_roommates ??
        "",

      // Conservamos las fotografías que ya tiene el anuncio.
      fotos: (anuncio.photos ?? []).map((foto) => ({
        type: "existing",
        id: foto.id,
      })),
    };
  }

  // ====================================================
  // GUARDAR UBICACIÓN
  // ====================================================

  async function guardarUbicacion() {
    if (guardando) return;

    try {
      setError("");

      if (!anuncio) {
        throw new Error(
          "No se encontró la información del anuncio.",
        );
      }

      if (estaCerrado) {
        throw new Error(
          "Este anuncio está cerrado y ya no se puede modificar.",
        );
      }

      if (!token || !userId) {
        throw new Error(
          "Tu sesión expiró. Inicia sesión nuevamente.",
        );
      }

      if (!direccion.trim()) {
        throw new Error(
          "Escribe la dirección de la habitación.",
        );
      }

      if (!coordenadas) {
        throw new Error(
          "Selecciona una ubicación en el mapa.",
        );
      }

      if (buscando || buscandoDireccionMapa) {
        throw new Error(
          "Espera a que termine la búsqueda de la dirección antes de guardar.",
        );
      }

      setGuardando(true);

      await actualizarAnuncio(
        listingId,
        obtenerDatosActualizacion(),
        token,
        userId,
      );

      navigate(`/anuncios/${listingId}/fotos`, {
        state: {
          modoEdicion: true,
        },
      });
    } catch (err) {
      setError(
        err.message || "No se pudo guardar la ubicación.",
      );
    } finally {
      setGuardando(false);
    }
  }

  // ====================================================
  // ESTADOS DE CARGA
  // ====================================================

  if (loadingSession || cargando) {
    return (
      <main className="ubicacion-pantalla">
        <div className="ubicacion-cargando">
          Cargando información del anuncio...
        </div>
      </main>
    );
  }

  if (error && !anuncio) {
    return (
      <main className="ubicacion-pantalla">
        <div className="ubicacion-mensaje-error">
          {error}
        </div>

        <BotonAnuncio
          tipo="secundario"
          onClick={() => navigate("/anuncios")}
        >
          Volver a mis anuncios
        </BotonAnuncio>
      </main>
    );
  }

  // ====================================================
  // ANUNCIO CERRADO
  // ====================================================

  if (estaCerrado) {
    return (
      <main className="ubicacion-pantalla">
        <section className="ubicacion-contenido">
          <header className="ubicacion-encabezado">
            <span className="ubicacion-etiqueta">
              ROOM_LINK
            </span>

            <h1>Publicación cerrada</h1>

            <p>
              Esta publicación está cerrada. Ya no puedes
              modificar su ubicación.
            </p>
          </header>

          <BotonAnuncio
            tipo="secundario"
            onClick={() => navigate("/anuncios")}
          >
            Volver a mis anuncios
          </BotonAnuncio>
        </section>
      </main>
    );
  }

  // ====================================================
  // CONFIGURACIÓN DEL CENTRO DEL MAPA
  // ====================================================

  const centroMapa = coordenadas
    ? [coordenadas.lat, coordenadas.lng]
    : CENTRO_INICIAL;

  // ====================================================
  // INTERFAZ
  // ====================================================

  return (
    <main className="ubicacion-pantalla">
      <section className="ubicacion-contenido">

        {/* ENCABEZADO */}

        <header className="ubicacion-encabezado">
          <span className="ubicacion-etiqueta">
            ROOM_LINK / PASO 2 DE 3
          </span>

          <h1>¿Dónde se encuentra tu habitación?</h1>

          <p>
            Indica la dirección de tu habitación y selecciona
            su ubicación exacta en el mapa.
          </p>
        </header>

        {/* INDICADOR DE PROGRESO */}

        <div className="ubicacion-progreso">
          <div className="ubicacion-progreso-paso completado">
            <span>1</span>
            <small>Información</small>
          </div>

          <div className="ubicacion-progreso-linea activa" />

          <div className="ubicacion-progreso-paso activo">
            <span>2</span>
            <small>Ubicación</small>
          </div>

          <div className="ubicacion-progreso-linea" />

          <div className="ubicacion-progreso-paso">
            <span>3</span>
            <small>Fotografías</small>
          </div>
        </div>

        {/* TARJETA PRINCIPAL */}

        <section className="ubicacion-tarjeta">

          {/* BUSCADOR DE DIRECCIÓN */}

          <form onSubmit={buscarDireccion}>
            <label htmlFor="direccion-habitacion">
              Dirección de la habitación
            </label>

            <div className="ubicacion-buscador">
              <input
                id="direccion-habitacion"
                type="text"
                value={direccion}
                onChange={cambiarDireccion}
                placeholder="Ej. Calle, número, colonia, ciudad..."
                autoComplete="street-address"
                disabled={guardando}
              />

              <button
                type="submit"
                disabled={
                  buscando ||
                  buscandoDireccionMapa ||
                  guardando
                }
              >
                {buscando ? "Buscando..." : "Buscar"}
              </button>
            </div>
          </form>

          {/* INSTRUCCIONES */}

          <div className="ubicacion-instruccion">
            <strong>
              ¿Cómo seleccionar la ubicación?
            </strong>

            <p>
              Puedes escribir una dirección y presionar Buscar,
              o seleccionar directamente un punto en el mapa.
            </p>

            <p>
              También puedes arrastrar el marcador para ajustar
              la ubicación.
            </p>

            <p>
              La dirección se completará automáticamente.
              Después podrás editarla para corregir el número
              de casa, calle, colonia o cualquier otro dato.
            </p>
          </div>

          {/* CARGA DEL MAPA */}

          {cargandoMapa && (
            <div className="ubicacion-mapa-cargando">
              Preparando el mapa...
            </div>
          )}

          {/* MAPA */}

          <div className="ubicacion-mapa">
            <MapContainer
              center={centroMapa}
              zoom={coordenadas ? 16 : 13}
              scrollWheelZoom
              className="ubicacion-mapa-leaflet"
              whenReady={() => setCargandoMapa(false)}
            >
              <TileLayer
                attribution={ATRIBUCION_MAPA}
                url={URL_MAPA}
              />

              <SeleccionarPunto
                onSeleccionar={seleccionarCoordenadas}
              />

              {coordenadas && (
                <>
                  <MarcadorUbicacion
                    coordenadas={coordenadas}
                    onSeleccionar={seleccionarCoordenadas}
                  />

                  <ActualizarCentro
                    coordenadas={coordenadas}
                  />
                </>
              )}
            </MapContainer>
          </div>

          {/* IDENTIFICACIÓN DE DIRECCIÓN */}

          {buscandoDireccionMapa && (
            <div className="ubicacion-mensaje-cargando">
              Identificando la dirección del punto seleccionado...
            </div>
          )}

          {/* ERROR DE MAPA */}

          {errorMapa && (
            <div className="ubicacion-error">
              {errorMapa}
            </div>
          )}

          {/* COORDENADAS */}

          {coordenadas && (
            <div className="ubicacion-coordenadas">
              <div>
                <span>Latitud</span>

                <strong>
                  {coordenadas.lat.toFixed(6)}
                </strong>
              </div>

              <div>
                <span>Longitud</span>

                <strong>
                  {coordenadas.lng.toFixed(6)}
                </strong>
              </div>
            </div>
          )}

          {/* DIRECCIÓN QUE SE GUARDARÁ */}

          {direccion && (
            <div className="ubicacion-seleccionada">
              <span>Dirección que se guardará</span>

              <strong>{direccion}</strong>
            </div>
          )}

          {/* ERRORES GENERALES */}

          {error && (
            <div className="ubicacion-mensaje-error">
              {error}
            </div>
          )}

          {/* BOTONES */}

          <div className="ubicacion-acciones">
            <BotonAnuncio
              tipo="secundario"
              onClick={() => navigate("/anuncios")}
              disabled={guardando}
            >
              Cancelar
            </BotonAnuncio>

            <BotonAnuncio
              tipo="principal"
              onClick={guardarUbicacion}
              disabled={
                guardando ||
                cargandoMapa ||
                buscando ||
                buscandoDireccionMapa ||
                !coordenadas ||
                !direccion.trim()
              }
            >
              {guardando
                ? "Guardando..."
                : "Guardar y continuar"}
            </BotonAnuncio>
          </div>

        </section>
      </section>
    </main>
  );
}
