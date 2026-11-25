
import { useEffect, useRef, useState } from "react";
import {
  useNavigate,
  useParams,
  useLocation,
} from "react-router-dom";

import L from "leaflet";

import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

import { useAuth } from "../../../hooks/useAuth.js";

import {
  obtenerAnuncioPorId,
} from "../services/anunciosService.js";

import BotonAnuncio from "../components/BotonAnuncio.jsx";

import "leaflet/dist/leaflet.css";
import "../styles/anuncios.css";

// ======================================================
// CONFIGURACIÓN DEL MARCADOR
// ======================================================

const iconoUbicacion = L.icon({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  shadowSize: [41, 41],
});

// ======================================================
// CONFIGURACIÓN DEL MAPA
// ======================================================

const CENTRO_INICIAL = [21.019, -101.2574];

// Carto sirve los datos de OSM desde un CDN apto para navegador sin API key;
// OpenStreetMap bloquea (403) el hotlinking directo de sus tiles.
const URL_MAPA =
  "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";

const ATRIBUCION_MAPA =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions" target="_blank" rel="noreferrer">CARTO</a>';

const CLAVE_EDICION = (listingId) =>
  `roomlink:edicion:${listingId}`;

// ======================================================
// FUNCIONES AUXILIARES
// ======================================================

function leerDatosTemporales(listingId) {
  try {
    const guardado = sessionStorage.getItem(
      CLAVE_EDICION(listingId)
    );

    return guardado ? JSON.parse(guardado) : null;
  } catch (error) {
    console.error(
      "No se pudieron recuperar los datos temporales:",
      error
    );

    return null;
  }
}

function guardarDatosTemporales(listingId, datos) {
  try {
    sessionStorage.setItem(
      CLAVE_EDICION(listingId),
      JSON.stringify(datos)
    );
  } catch (error) {
    console.error(
      "No se pudieron guardar los datos temporales:",
      error
    );

    throw new Error(
      "No se pudieron conservar los cambios temporalmente."
    );
  }
}

function obtenerAnuncio(resultado) {
  return (
    resultado?.room ??
    resultado?.data?.room ??
    resultado?.data ??
    resultado
  );
}

function obtenerUbicacion(anuncio) {
  return (
    anuncio?.location ??
    anuncio?.ubicacion ??
    anuncio?.geoLocation ??
    anuncio?.geo_location ??
    null
  );
}

function obtenerDatosUbicacionOriginal(anuncio) {
  const ubicacion = obtenerUbicacion(anuncio);

  if (typeof ubicacion === "string") {
    return {
      ubicacion,
      latitude: anuncio?.latitude ?? null,
      longitude: anuncio?.longitude ?? null,
    };
  }

  return {
    ubicacion:
      ubicacion?.address ??
      ubicacion?.direccion ??
      ubicacion?.name ??
      "",

    latitude:
      ubicacion?.latitude ??
      ubicacion?.lat ??
      anuncio?.latitude ??
      null,

    longitude:
      ubicacion?.longitude ??
      ubicacion?.lng ??
      anuncio?.longitude ??
      null,
  };
}

function validarCoordenadas(lat, lng) {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

// ======================================================
// COMPONENTE: DETECTAR CLIC EN EL MAPA
// ======================================================

function MapaUbicacion({ coordenadas, onSeleccionar, onListo }) {
  const contenedor = useRef(null);
  const mapa = useRef(null);
  const marcador = useRef(null);

  useEffect(() => {
    const instancia = L.map(contenedor.current).setView(CENTRO_INICIAL, 13);
    L.tileLayer(URL_MAPA, { attribution: ATRIBUCION_MAPA }).addTo(instancia);
    mapa.current = instancia;
    onListo(false);

    return () => {
      instancia.remove();
      mapa.current = null;
      marcador.current = null;
    };
  }, [onListo]);

  const lat = coordenadas?.lat;
  const lng = coordenadas?.lng;

  useEffect(() => {
    const instancia = mapa.current;
    if (lat === undefined || lng === undefined) {
      marcador.current?.remove();
      marcador.current = null;
      return;
    }

    const punto = [lat, lng];
    if (marcador.current) {
      marcador.current.setLatLng(punto);
    } else {
      marcador.current = L.marker(punto, {
        draggable: true,
        icon: iconoUbicacion,
      }).addTo(instancia);
    }
    instancia.setView(punto, 16, { animate: true });
  }, [lat, lng]);

  useEffect(() => {
    const instancia = mapa.current;
    const pin = marcador.current;
    const seleccionarPunto = ({ latlng }) => onSeleccionar({
      lat: latlng.lat,
      lng: L.Util.wrapNum(latlng.lng, [-180, 180], true),
    });
    const seleccionarPin = () => seleccionarPunto({ latlng: pin.getLatLng() });

    instancia.on("click", seleccionarPunto);
    pin?.on("dragend", seleccionarPin);

    return () => {
      instancia.off("click", seleccionarPunto);
      pin?.off("dragend", seleccionarPin);
    };
  }, [lat, lng, onSeleccionar]);

  return (
    <div
      aria-label="Mapa para elegir la ubicación"
      className="ubicacion-mapa-leaflet"
      ref={contenedor}
      role="region"
    />
  );
}

export default function PantallaUbicacion() {
  const { listingId } = useParams();

  const navigate = useNavigate();
  const location = useLocation();

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

  const [
    buscandoDireccionMapa,
    setBuscandoDireccionMapa,
  ] = useState(false);

  const [avanzando, setAvanzando] = useState(false);

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
    anuncio?.status ??
    anuncio?.estado ??
    ""
  ).toLowerCase();

  const estaCerrado = [
    "closed",
    "cerrada",
    "cerrado",
  ].includes(estadoAnuncio);

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
            "Tu sesión no está disponible. Inicia sesión nuevamente."
          );
        }

        if (!listingId) {
          throw new Error(
            "No se encontró el identificador del anuncio."
          );
        }

        const resultado = await obtenerAnuncioPorId(
          listingId,
          token
        );

        if (!activo) return;

        if (!resultado) {
          throw new Error(
            "No se encontró el anuncio."
          );
        }

        const publicacion = obtenerAnuncio(resultado);

        if (!publicacion?.id) {
          throw new Error(
            "No se pudo identificar la publicación."
          );
        }

        setAnuncio(publicacion);

        // Recuperar los datos del paso anterior.
        // Prioridad:
        // 1. Datos recibidos por navegación.
        // 2. Datos guardados en sessionStorage.
        // 3. Datos originales del servidor.

        const datosDeNavegacion =
          location.state?.datosEdicion ?? null;

        const datosGuardados =
          leerDatosTemporales(listingId);

        const datosTemporales =
          datosDeNavegacion ??
          datosGuardados ??
          {};

        const ubicacionOriginal =
          obtenerDatosUbicacionOriginal(publicacion);

        const datosCompletos = {
          ...datosTemporales,

          // Si el primer paso ya modificó estos campos,
          // no debemos reemplazarlos por los originales.
          titulo:
            datosTemporales.titulo ??
            publicacion.title ??
            publicacion.titulo ??
            "",

          renta:
            datosTemporales.renta ??
            publicacion.monthlyRent ??
            publicacion.monthly_rent ??
            publicacion.renta ??
            "",

          descripcion:
            datosTemporales.descripcion ??
            publicacion.description ??
            publicacion.descripcion ??
            "",

          availableFrom:
            datosTemporales.availableFrom ??
            publicacion.availableFrom ??
            publicacion.available_from ??
            "",

          maxRoommates:
            datosTemporales.maxRoommates ??
            publicacion.maxRoommates ??
            publicacion.max_roommates ??
            "",

          // Ubicación temporal u original.
          ubicacion:
            datosTemporales.ubicacion ??
            ubicacionOriginal.ubicacion,

          latitude:
            datosTemporales.latitude ??
            ubicacionOriginal.latitude,

          longitude:
            datosTemporales.longitude ??
            ubicacionOriginal.longitude,

          // Conservar estado y fotografías originales.
          status:
            datosTemporales.status ??
            publicacion.status ??
            publicacion.estado ??
            "draft",

          fotos:
            datosTemporales.fotos ??
            (publicacion.photos ?? []).map((foto) => ({
              type: "existing",
              id: foto.id,
            })),
        };

        // Recuperar dirección.
        setDireccion(
          String(datosCompletos.ubicacion ?? "")
        );

        // Recuperar coordenadas.
        const lat = Number(datosCompletos.latitude);
        const lng = Number(datosCompletos.longitude);

        if (
          datosCompletos.latitude != null &&
          datosCompletos.longitude != null &&
          validarCoordenadas(lat, lng)
        ) {
          setCoordenadas({ lat, lng });
        } else {
          setCoordenadas(null);
        }

        // Conservar el conjunto completo de datos.
        guardarDatosTemporales(
          listingId,
          datosCompletos
        );

      } catch (err) {
        if (activo) {
          setError(
            err.message ||
            "No se pudo cargar el anuncio."
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
  }, [
    listingId,
    token,
    userId,
    loadingSession,
    location.state,
  ]);

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
        }
      );

      if (!respuesta.ok) {
        throw new Error(
          "No se pudo consultar la dirección de este punto."
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
          "No encontramos una dirección para este punto. Puedes escribirla manualmente."
        );
      }

    } catch (err) {
      if (err.name === "AbortError") return;

      if (
        solicitudActual === solicitudDireccionRef.current
      ) {
        setErrorMapa(
          "No pudimos identificar la dirección de este punto. Puedes escribirla manualmente."
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
    if (estaCerrado || avanzando) return;

    const lat = Number(nuevasCoordenadas.lat);
    const lng = Number(nuevasCoordenadas.lng);

    if (!validarCoordenadas(lat, lng)) {
      setErrorMapa(
        "Las coordenadas seleccionadas no son válidas."
      );
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
  // ====================================================

  async function buscarDireccion(evento) {
    evento.preventDefault();

    const textoBusqueda = direccion.trim();

    if (!textoBusqueda) {
      setError(
        "Escribe una dirección para buscarla en el mapa."
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
        }
      );

      if (!respuesta.ok) {
        throw new Error(
          "No se pudo consultar el servicio de búsqueda de direcciones. Inténtalo nuevamente."
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
          "No encontramos esa dirección. Revisa que esté escrita correctamente o selecciona directamente el punto en el mapa."
        );
        return;
      }

      const lugar = resultados[0];

      const nuevaCoordenada = {
        lat: Number(lugar.lat),
        lng: Number(lugar.lon),
      };

      if (
        !validarCoordenadas(
          nuevaCoordenada.lat,
          nuevaCoordenada.lng
        )
      ) {
        throw new Error(
          "El servicio devolvió coordenadas no válidas."
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
          err.message || "No se pudo buscar la dirección."
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
  // PREPARAR DATOS TEMPORALES
  // ====================================================

  function obtenerDatosEdicion() {
    const datosAnteriores =
      leerDatosTemporales(listingId) ?? {};

    return {
      ...datosAnteriores,

      // Conservar los campos del paso 1.
      titulo: datosAnteriores.titulo ?? "",
      renta: datosAnteriores.renta ?? "",
      descripcion: datosAnteriores.descripcion ?? "",
      availableFrom: datosAnteriores.availableFrom ?? "",
      maxRoommates: datosAnteriores.maxRoommates ?? "",

      // Actualizar únicamente la ubicación.
      ubicacion: direccion.trim(),
      latitude: coordenadas.lat,
      longitude: coordenadas.lng,

      // Conservar las fotografías y el estado.
      fotos: datosAnteriores.fotos ?? [],
      status:
        datosAnteriores.status ??
        anuncio?.status ??
        anuncio?.estado ??
        "draft",
    };
  }

  // ====================================================
  // CANCELAR EDICIÓN
  // ====================================================

  function cancelarEdicion() {
    solicitudDireccionRef.current++;

    controladorBusquedaRef.current?.abort();

    try {
      sessionStorage.removeItem(
        CLAVE_EDICION(listingId)
      );
    } catch (err) {
      console.error(
        "No se pudo limpiar la edición temporal:",
        err
      );
    }

    navigate("/anuncios", {
      replace: true,
    });
  }

  // ====================================================
  // CONTINUAR A FOTOGRAFÍAS
  // ====================================================

  function continuarAFotografias() {
    if (avanzando) return;

    try {
      setError("");

      if (!anuncio) {
        throw new Error(
          "No se encontró la información del anuncio."
        );
      }

      if (estaCerrado) {
        throw new Error(
          "Este anuncio está cerrado y ya no se puede modificar."
        );
      }

      if (!token || !userId) {
        throw new Error(
          "Tu sesión expiró. Inicia sesión nuevamente."
        );
      }

      if (!direccion.trim()) {
        throw new Error(
          "Escribe la dirección de la habitación."
        );
      }

      if (!coordenadas) {
        throw new Error(
          "Selecciona una ubicación en el mapa."
        );
      }

      if (
        !validarCoordenadas(
          coordenadas.lat,
          coordenadas.lng
        )
      ) {
        throw new Error(
          "Las coordenadas seleccionadas no son válidas."
        );
      }

      if (buscando || buscandoDireccionMapa) {
        throw new Error(
          "Espera a que termine la búsqueda de la dirección antes de continuar."
        );
      }

      setAvanzando(true);

      // Preparar todos los datos de los dos primeros pasos.
      const datosEdicion = obtenerDatosEdicion();

      // Guardar temporalmente.
      // NO se ejecuta actualizarAnuncio().
      guardarDatosTemporales(
        listingId,
        datosEdicion
      );

      navigate(`/anuncios/${listingId}/fotos`, {
        state: {
          modoEdicion: true,
          datosEdicion,
        },
      });

    } catch (err) {
      setError(
        err.message || "No se pudo continuar."
      );

      setAvanzando(false);
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
  // CENTRO DEL MAPA
  // ====================================================



  // ====================================================
  // INTERFAZ
  // ====================================================

  return (
    <main className="ubicacion-pantalla">
      <section className="ubicacion-contenido">

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

        <section className="ubicacion-tarjeta">

          {/* BUSCADOR */}

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
                disabled={avanzando}
              />

              <button
                type="submit"
                disabled={
                  buscando ||
                  buscandoDireccionMapa ||
                  avanzando
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
            <MapaUbicacion
              coordenadas={coordenadas}
              onSeleccionar={seleccionarCoordenadas}
              onListo={setCargandoMapa}
            />
          </div>

          {/* IDENTIFICACIÓN DE DIRECCIÓN */}

          {buscandoDireccionMapa && (
            <div className="ubicacion-mensaje-cargando">
              Identificando la dirección del punto seleccionado...
            </div>
          )}

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

          {/* DIRECCIÓN */}

          {direccion && (
            <div className="ubicacion-seleccionada">
              <span>Dirección que se guardará</span>

              <strong>{direccion}</strong>
            </div>
          )}

          {/* ERROR GENERAL */}

          {error && (
            <div
              className="ubicacion-mensaje-error"
              role="alert"
            >
              {error}
            </div>
          )}

          {/* NOTA */}

          <div className="fotos-nota">
            La ubicación todavía no se ha guardado en tu
            publicación. Podrás revisar todos los cambios
            antes de pulsar Guardar en el último paso.
          </div>

          {/* ACCIONES */}

          <div className="ubicacion-acciones">
            <BotonAnuncio
              tipo="secundario"
              onClick={cancelarEdicion}
              disabled={avanzando}
            >
              Cancelar
            </BotonAnuncio>

            <BotonAnuncio
              tipo="principal"
              onClick={continuarAFotografias}
              disabled={
                avanzando ||
                cargandoMapa ||
                buscando ||
                buscandoDireccionMapa ||
                !coordenadas ||
                !direccion.trim()
              }
            >
              {avanzando
                ? "Continuando..."
                : "Siguiente"}
            </BotonAnuncio>
          </div>

        </section>
      </section>
    </main>
  );
}
