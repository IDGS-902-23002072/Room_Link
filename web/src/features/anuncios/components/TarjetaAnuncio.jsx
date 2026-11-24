
import React from 'react';

import EstadoAnuncio from './EstadoAnuncio';
import BotonAnuncio from './BotonAnuncio';

function obtenerDireccion(anuncio) {
  const posiblesUbicaciones = [
    anuncio.ubicacion,
    anuncio.location,
    anuncio.geoLocation,
    anuncio.geo_location,
    anuncio.address,
    anuncio.direccion,
  ];

  for (const ubicacion of posiblesUbicaciones) {
    if (typeof ubicacion === 'string' && ubicacion.trim()) {
      return ubicacion.trim();
    }

    if (ubicacion && typeof ubicacion === 'object') {
      const direccion =
        ubicacion.address ??
        ubicacion.direccion ??
        ubicacion.formattedAddress ??
        ubicacion.formatted_address ??
        ubicacion.fullAddress ??
        ubicacion.full_address;

      if (typeof direccion === 'string' && direccion.trim()) {
        return direccion.trim();
      }
    }
  }

  return '';
}

function TarjetaAnuncio({
  anuncio,
  onVer,
  onEditar,
  onPausar,
  onActivar,
  onCerrar,
}) {
  const {
    id,
    titulo,
    renta,
    estado,
    foto,
  } = anuncio;

  const direccion = obtenerDireccion(anuncio);

  const imagen =
    foto ||
    anuncio.photo ||
    anuncio.firstPhoto ||
    null;

  const formatoRenta = new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    maximumFractionDigits: 2,
  }).format(Number(renta ?? anuncio.monthlyRent) || 0);

  const estadoActual = String(
    estado ?? anuncio.status ?? 'draft'
  ).toLowerCase();

  const estaBorrador = estadoActual === 'draft';
  const estaPublicada = estadoActual === 'published';
  const estaPausada = estadoActual === 'paused';
  const estaCerrada = estadoActual === 'closed';

  return (
    <article className="tarjeta-anuncio">

      <div className="tarjeta-anuncio__imagen-contenedor">
        {imagen ? (
          <img
            src={imagen}
            alt={`Fotografía de ${titulo || 'la habitación'}`}
            className="tarjeta-anuncio__imagen"
          />
        ) : (
          <div className="tarjeta-anuncio__sin-imagen">
            <span>Sin fotografía</span>
          </div>
        )}

        <div className="tarjeta-anuncio__estado">
          <EstadoAnuncio estado={estadoActual} />
        </div>
      </div>

      <div className="tarjeta-anuncio__contenido">

        <div className="tarjeta-anuncio__informacion">

          <h3 className="tarjeta-anuncio__titulo">
            {titulo || anuncio.title || 'Habitación sin título'}
          </h3>

          <p className="tarjeta-anuncio__ubicacion">
            <span>⌖</span>
            {direccion ||
              (estaBorrador
                ? 'Publicación en borrador'
                : 'Ubicación no disponible')}
          </p>

          <p className="tarjeta-anuncio__renta">
            {formatoRenta}
            <span> / mes</span>
          </p>

        </div>

        <div className="tarjeta-anuncio__acciones">

          <BotonAnuncio
            tipo="secundario"
            onClick={() => onVer?.(id)}
          >
            Ver
          </BotonAnuncio>

          {!estaCerrada && (
            <BotonAnuncio
              tipo="principal"
              onClick={() => onEditar?.(id)}
            >
              Editar
            </BotonAnuncio>
          )}

          {estaPublicada && (
            <>
              <BotonAnuncio
                tipo="texto"
                onClick={() => onPausar?.(id)}
              >
                Pausar
              </BotonAnuncio>

              <BotonAnuncio
                tipo="texto"
                onClick={() => onCerrar?.(id)}
              >
                Cerrar
              </BotonAnuncio>
            </>
          )}

          {estaPausada && (
            <>
              <BotonAnuncio
                tipo="principal"
                onClick={() => onActivar?.(id)}
              >
                Activar
              </BotonAnuncio>

              <BotonAnuncio
                tipo="texto"
                onClick={() => onCerrar?.(id)}
              >
                Cerrar
              </BotonAnuncio>
            </>
          )}

        </div>
      </div>
    </article>
  );
}

export default TarjetaAnuncio;
