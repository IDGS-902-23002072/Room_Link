
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { useAuth } from '../../../hooks/useAuth.js';

import {
  actualizarAnuncio,
  obtenerAnuncioPorId,
} from '../services/anunciosService.js';

import BotonAnuncio from '../components/BotonAnuncio.jsx';

import '../styles/anuncios.css';
import './PantallaUbicacion.css';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

let googleMapsPromise = null;

// ======================================================
// CARGAR GOOGLE MAPS
// ======================================================

function cargarGoogleMaps() {
  if (window.google?.maps) {
    return Promise.resolve(window.google.maps);
  }

  if (!GOOGLE_MAPS_API_KEY) {
    return Promise.reject(
      new Error('No se configuró la API Key de Google Maps.')
    );
  }

  if (googleMapsPromise) {
    return googleMapsPromise;
  }

  googleMapsPromise = new Promise((resolve, reject) => {
    const scriptExistente = document.getElementById('google-maps-script');

    if (scriptExistente) {
      scriptExistente.addEventListener('load', () => {
        resolve(window.google.maps);
      });

      scriptExistente.addEventListener('error', () => {
        googleMapsPromise = null;
        reject(new Error('No se pudo cargar Google Maps.'));
      });

      return;
    }

    const script = document.createElement('script');

    script.id = 'google-maps-script';
    script.src =
      `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(GOOGLE_MAPS_API_KEY)}&v=weekly`;

    script.async = true;
    script.defer = true;

    script.onload = () => {
      resolve(window.google.maps);
    };

    script.onerror = () => {
      googleMapsPromise = null;
      reject(new Error('No se pudo cargar Google Maps. Revisa tu API Key.'));
    };

    document.head.appendChild(script);
  });

  return googleMapsPromise;
}

// ======================================================
// PANTALLA DE UBICACIÓN
// ======================================================

export default function PantallaUbicacion() {
  const { listingId } = useParams();
  const navigate = useNavigate();

  const { session, loadingSession } = useAuth();

  const mapaContenedorRef = useRef(null);
  const mapaRef = useRef(null);
  const marcadorRef = useRef(null);
  const geocoderRef = useRef(null);

  const [anuncio, setAnuncio] = useState(null);

  const [direccion, setDireccion] = useState('');
  const [busqueda, setBusqueda] = useState('');

  const [coordenadas, setCoordenadas] = useState(null);

  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [cargandoMapa, setCargandoMapa] = useState(true);

  const [error, setError] = useState('');
  const [errorMapa, setErrorMapa] = useState('');

  // ====================================================
  // CONSULTAR BORRADOR
  // ====================================================

  useEffect(() => {
    if (loadingSession) return;

    let activo = true;

    async function cargarAnuncio() {
      try {
        setCargando(true);
        setError('');

        if (!session?.token || !session?.user?.id) {
          throw new Error('Tu sesión no está disponible. Inicia sesión nuevamente.');
        }

        if (!listingId) {
          throw new Error('No se encontró el identificador del anuncio.');
        }

        const resultado = await obtenerAnuncioPorId(
          listingId,
          session.token
        );

        if (!activo) return;

        setAnuncio(resultado);

        const ubicacion = resultado.location;

        if (ubicacion) {
          setDireccion(ubicacion.address ?? '');
          setBusqueda(ubicacion.address ?? '');

          if (
            Number.isFinite(Number(ubicacion.latitude)) &&
            Number.isFinite(Number(ubicacion.longitude))
          ) {
            setCoordenadas({
              lat: Number(ubicacion.latitude),
              lng: Number(ubicacion.longitude),
            });
          }
        }
      } catch (err) {
        if (activo) {
          setError(err.message || 'No se pudo cargar el anuncio.');
        }
      } finally {
        if (activo) setCargando(false);
      }
    }

    cargarAnuncio();

    return () => {
      activo = false;
    };
  }, [listingId, session, loadingSession]);

  // ====================================================
  // INICIALIZAR GOOGLE MAPS
  // ====================================================

  useEffect(() => {
    let activo = true;

    async function inicializarMapa() {
      try {
        setCargandoMapa(true);
        setErrorMapa('');

        const googleMaps = await cargarGoogleMaps();

        if (!activo || !mapaContenedorRef.current) return;

        const mapa = new googleMaps.Map(mapaContenedorRef.current, {
          center: {
            lat: 23.6345,
            lng: -102.5528,
          },
          zoom: 5,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
          zoomControl: true,
        });

        mapaRef.current = mapa;
        geocoderRef.current = new googleMaps.Geocoder();

        mapa.addListener('click', async (evento) => {
          if (!evento.latLng) return;

          const lat = evento.latLng.lat();
          const lng = evento.latLng.lng();

          setCoordenadas({ lat, lng });

          try {
            const resultado = await geocoderRef.current.geocode({
              location: { lat, lng },
            });

            if (resultado.results.length > 0) {
              const direccionEncontrada =
                resultado.results[0].formatted_address;

              setDireccion(direccionEncontrada);
              setBusqueda(direccionEncontrada);
            }
          } catch {
            setErrorMapa(
              'Se seleccionó el punto, pero no se pudo obtener su dirección.'
            );
          }
        });

        setCargandoMapa(false);
      } catch (err) {
        if (activo) {
          setErrorMapa(err.message || 'No se pudo inicializar el mapa.');
          setCargandoMapa(false);
        }
      }
    }

    inicializarMapa();

    return () => {
      activo = false;
    };
  }, []);

  // ====================================================
  // ACTUALIZAR MARCADOR
  // ====================================================

  useEffect(() => {
    if (!mapaRef.current || !coordenadas || !window.google?.maps) {
      return;
    }

    const posicion = {
      lat: coordenadas.lat,
      lng: coordenadas.lng,
    };

    if (!marcadorRef.current) {
      marcadorRef.current = new window.google.maps.Marker({
        position: posicion,
        map: mapaRef.current,
        draggable: true,
        title: 'Ubicación de la habitación',
      });

      marcadorRef.current.addListener('dragend', async (evento) => {
        if (!evento.latLng) return;

        const lat = evento.latLng.lat();
        const lng = evento.latLng.lng();

        setCoordenadas({ lat, lng });

        try {
          const resultado = await geocoderRef.current.geocode({
            location: { lat, lng },
          });

          if (resultado.results.length > 0) {
            const direccionEncontrada =
              resultado.results[0].formatted_address;

            setDireccion(direccionEncontrada);
            setBusqueda(direccionEncontrada);
          }
        } catch {
          setErrorMapa('No se pudo actualizar la dirección del marcador.');
        }
      });
    } else {
      marcadorRef.current.setPosition(posicion);
    }

    mapaRef.current.setCenter(posicion);
    mapaRef.current.setZoom(16);
  }, [coordenadas, cargandoMapa]);

  // ====================================================
  // BUSCAR DIRECCIÓN
  // ====================================================

  async function buscarDireccion(evento) {
    evento.preventDefault();

    if (!busqueda.trim()) {
      setError('Escribe una dirección para buscar.');
      return;
    }

    try {
      setError('');
      setErrorMapa('');

      if (!geocoderRef.current) {
        throw new Error('El mapa todavía no está disponible.');
      }

      const resultado = await geocoderRef.current.geocode({
        address: busqueda.trim(),
      });

      if (!resultado.results.length) {
        throw new Error('No se encontró esa dirección.');
      }

      const lugar = resultado.results[0];
      const posicion = lugar.geometry.location;

      const nuevaCoordenada = {
        lat: posicion.lat(),
        lng: posicion.lng(),
      };

      setDireccion(lugar.formatted_address);
      setBusqueda(lugar.formatted_address);
      setCoordenadas(nuevaCoordenada);
      setError('');
    } catch (err) {
      setError(err.message || 'No se pudo buscar la dirección.');
    }
  }

  // ====================================================
  // GUARDAR UBICACIÓN
  // ====================================================

  async function guardarUbicacion() {
    try {
      setError('');

      if (!direccion.trim()) {
        throw new Error('Selecciona o escribe la dirección de la habitación.');
      }

      if (!coordenadas) {
        throw new Error('Selecciona una ubicación en el mapa.');
      }

      if (!anuncio) {
        throw new Error('No se encontró la información del anuncio.');
      }

      if (!session?.token || !session?.user?.id) {
        throw new Error('Tu sesión expiró. Inicia sesión nuevamente.');
      }

      setGuardando(true);

      // Conservamos los datos del borrador.
      // Así solo modificamos su ubicación y no perdemos
      // el título, renta, descripción ni fotografías existentes.

      const fotosExistentes = (anuncio.photos ?? []).map((foto) => ({
        type: 'existing',
        id: foto.id,
      }));

      await actualizarAnuncio(
        listingId,
        {
          titulo: anuncio.title,
          renta: anuncio.monthlyRent,
          descripcion: anuncio.description ?? '',
          ubicacion: direccion.trim(),
          latitude: coordenadas.lat,
          longitude: coordenadas.lng,
          availableFrom: anuncio.availableFrom ?? '',
          maxRoommates: anuncio.maxRoommates ?? '',
          fotos: fotosExistentes,
        },
        session.token,
        session.user.id
      );

      navigate(`/anuncios/${listingId}/fotos`);
    } catch (err) {
      setError(err.message || 'No se pudo guardar la ubicación.');
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
        <div className="ubicacion-mensaje-error">{error}</div>

        <BotonAnuncio
          tipo="secundario"
          onClick={() => navigate('/anuncios')}
        >
          Volver a mis anuncios
        </BotonAnuncio>
      </main>
    );
  }

  // ====================================================
  // INTERFAZ
  // ====================================================

  return (
    <main className="ubicacion-pantalla">
      <section className="ubicacion-contenido">

        <header className="ubicacion-encabezado">
          <span className="ubicacion-etiqueta">
            PASO 2 DE 3
          </span>

          <h1>¿Dónde se encuentra tu habitación?</h1>

          <p>
            Indica la dirección de tu habitación y selecciona
            su ubicación exacta en el mapa.
          </p>
        </header>

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

          <form onSubmit={buscarDireccion}>
            <label htmlFor="direccion-habitacion">
              Dirección de la habitación
            </label>

            <div className="ubicacion-buscador">
              <input
                id="direccion-habitacion"
                type="text"
                value={busqueda}
                onChange={(evento) => setBusqueda(evento.target.value)}
                placeholder="Ej. Calle, número, colonia, ciudad..."
                autoComplete="street-address"
              />

              <button type="submit" disabled={cargandoMapa}>
                Buscar
              </button>
            </div>
          </form>

          <div className="ubicacion-instruccion">
            <span> <strong>Consejo:</strong> </span>
            Busca tu dirección o haz clic directamente en el mapa.
            Puedes arrastrar el marcador para ajustar la ubicación.
          </div>

          {cargandoMapa && (
            <div className="ubicacion-mapa-cargando">
              Cargando Google Maps...
            </div>
          )}

          <div
            ref={mapaContenedorRef}
            className="ubicacion-mapa"
            aria-label="Mapa para seleccionar la ubicación de la habitación"
          />

          {errorMapa && (
            <p className="ubicacion-error">{errorMapa}</p>
          )}

          {coordenadas && (
            <div className="ubicacion-coordenadas">
              <div>
                <span>Latitud</span>
                <strong>{coordenadas.lat.toFixed(6)}</strong>
              </div>

              <div>
                <span>Longitud</span>
                <strong>{coordenadas.lng.toFixed(6)}</strong>
              </div>
            </div>
          )}

          {direccion && (
            <div className="ubicacion-seleccionada">
              <span>Ubicación seleccionada</span>
              <strong>{direccion}</strong>
            </div>
          )}

          {error && (
            <div className="ubicacion-mensaje-error">
              {error}
            </div>
          )}

          <div className="ubicacion-acciones">
            <BotonAnuncio
              tipo="secundario"
              onClick={() => navigate('/anuncios')}
              disabled={guardando}
            >
              Cancelar
            </BotonAnuncio>

            <BotonAnuncio
              tipo="principal"
              onClick={guardarUbicacion}
              disabled={guardando || cargandoMapa || !coordenadas}
            >
              {guardando ? 'Guardando...' : 'Guardar y continuar'}
            </BotonAnuncio>
          </div>

        </section>
      </section>
    </main>
  );
}
