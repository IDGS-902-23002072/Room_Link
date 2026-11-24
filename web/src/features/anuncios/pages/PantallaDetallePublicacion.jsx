
import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { useAuth } from '../../../hooks/useAuth.js';

import {
  obtenerAnuncioPorId,
  obtenerUrlFoto,
} from '../services/anunciosService.js';

import GaleriaAnuncio from '../components/GaleriaAnuncio.jsx';
import EstadoAnuncio from '../components/EstadoAnuncio.jsx';
import BotonAnuncio from '../components/BotonAnuncio.jsx';

import '../styles/anuncios.css';

function formatearRenta(valor) {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    maximumFractionDigits: 2,
  }).format(Number(valor) || 0);
}

function formatearFecha(fecha) {
  if (!fecha) return 'No especificada';

  const fechaLocal = new Date(`${fecha}T00:00:00`);

  if (Number.isNaN(fechaLocal.getTime())) {
    return fecha;
  }

  return new Intl.DateTimeFormat('es-MX', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(fechaLocal);
}

function PantallaDetallePublicacion() {
  const { listingId } = useParams();
  const navigate = useNavigate();
  const { session } = useAuth();

  const [anuncio, setAnuncio] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const cargarDetalle = useCallback(async () => {
    if (!listingId || !session?.token) {
      setError('No se pudo identificar la publicación o la sesión.');
      setCargando(false);
      return;
    }

    try {
      setCargando(true);
      setError('');

      const resultado = await obtenerAnuncioPorId(
        listingId,
        session.token
      );

      setAnuncio(resultado);
    } catch (err) {
      setError(
        err.message || 'No se pudo cargar el detalle de la publicación.'
      );
    } finally {
      setCargando(false);
    }
  }, [listingId, session?.token]);

  useEffect(() => {
    cargarDetalle();
  }, [cargarDetalle]);

  if (cargando) {
    return (
      <main className="anuncios-contenedor detalle-anuncio">
        <div className="detalle-anuncio__mensaje">
          <div className="detalle-anuncio__spinner" />
          <p>Cargando información de la publicación...</p>
        </div>
      </main>
    );
  }

  if (error || !anuncio) {
    return (
      <main className="anuncios-contenedor detalle-anuncio">
        <BotonAnuncio
          tipo="secundario"
          onClick={() => navigate('/anuncios')}
        >
          ← Volver a mis anuncios
        </BotonAnuncio>

        <div className="detalle-anuncio__mensaje detalle-anuncio__mensaje--error">
          <h2>No se pudo mostrar la publicación</h2>
          <p>{error || 'La publicación no está disponible.'}</p>

          <BotonAnuncio tipo="principal" onClick={cargarDetalle}>
            Intentar nuevamente
          </BotonAnuncio>
        </div>
      </main>
    );
  }

  const fotografias = (anuncio.photos || [])
    .filter((foto) => foto?.id)
    .sort((a, b) => a.position - b.position)
    .map((foto) => ({
      id: foto.id,
      url: obtenerUrlFoto(listingId, foto.id),
    }));

  const ubicacion = anuncio.location?.address || '';
  const descripcion = anuncio.description?.trim();
  const cantidadCompaneros = anuncio.maxRoommates;

  return (
    <main className="anuncios-contenedor detalle-anuncio">
      <div className="detalle-anuncio__encabezado">
        <BotonAnuncio
          tipo="secundario"
          onClick={() => navigate('/anuncios')}
        >
          ← Volver a mis anuncios
        </BotonAnuncio>

        <div className="detalle-anuncio__estado">
          <EstadoAnuncio estado={anuncio.status} />
        </div>
      </div>

      <section className="detalle-anuncio__contenido">
        <div className="detalle-anuncio__galeria">
          <GaleriaAnuncio
            fotografias={fotografias}
            titulo={anuncio.title}
          />
        </div>

        <div className="detalle-anuncio__informacion">
          <div className="detalle-anuncio__titulo-contenedor">
            <div>
              <p className="detalle-anuncio__etiqueta">
                DETALLE DE PUBLICACIÓN
              </p>

              <h1>{anuncio.title}</h1>
            </div>

            <p className="detalle-anuncio__renta">
              {formatearRenta(anuncio.monthlyRent)}
              <span> / mes</span>
            </p>
          </div>

          <section className="detalle-anuncio__seccion">
            <h2>Descripción</h2>
            <p>
              {descripcion || 'Esta publicación no tiene descripción.'}
            </p>
          </section>

          <section className="detalle-anuncio__seccion">
            <h2>Ubicación</h2>

            <p>
              {ubicacion || 'No se ha registrado una dirección.'}
            </p>
          </section>

          <section className="detalle-anuncio__seccion">
            <h2>Características</h2>

            <div className="detalle-anuncio__caracteristicas">
              <div className="detalle-anuncio__caracteristica">
                <span>Disponible desde</span>
                <strong>
                  {formatearFecha(anuncio.availableFrom)}
                </strong>
              </div>

              <div className="detalle-anuncio__caracteristica">
                <span>Máximo de compañeros</span>
                <strong>
                  {cantidadCompaneros ?? 'No especificado'}
                </strong>
              </div>

              <div className="detalle-anuncio__caracteristica">
                <span>Fotografías</span>
                <strong>{fotografias.length}</strong>
              </div>
            </div>
          </section>


        </div>
      </section>
    </main>
  );
}

export default PantallaDetallePublicacion;
