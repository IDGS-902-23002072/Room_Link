
import React from 'react';
import EstadoAnuncio from './EstadoAnuncio';
import BotonAnuncio from './BotonAnuncio';

function TarjetaAnuncio({
  anuncio,
  onVer,
  onEditar,
  onAdministrar,
}) {
  const {
    id,
    titulo,
    ubicacion,
    renta,
    estado,
    foto,
  } = anuncio;

  const imagen = foto || null;

  const formatoRenta = new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    maximumFractionDigits: 2,
  }).format(Number(renta) || 0);

  return (
    <article className="tarjeta-anuncio">
      <div className="tarjeta-anuncio__imagen-contenedor">
        {imagen ? (
          <img
            src={imagen}
            alt={`Fotografía de ${titulo}`}
            className="tarjeta-anuncio__imagen"
          />
        ) : (
          <div className="tarjeta-anuncio__sin-imagen">
            <span>Sin fotografía</span>
          </div>
        )}

        <div className="tarjeta-anuncio__estado">
          <EstadoAnuncio estado={estado} />
        </div>
      </div>

      <div className="tarjeta-anuncio__contenido">
        <div className="tarjeta-anuncio__informacion">
          <h3 className="tarjeta-anuncio__titulo">
            {titulo || 'Habitación sin título'}
          </h3>

          <p className="tarjeta-anuncio__ubicacion">
            <span>⌖</span>
            {ubicacion || 'Ubicación no disponible'}
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

          <BotonAnuncio
            tipo="principal"
            onClick={() => onEditar?.(id)}
          >
            Editar
          </BotonAnuncio>

          <BotonAnuncio
            tipo="texto"
            onClick={() => onAdministrar?.(id)}
          >
            Administrar
          </BotonAnuncio>
        </div>
      </div>
    </article>
  );
}

export default TarjetaAnuncio;
