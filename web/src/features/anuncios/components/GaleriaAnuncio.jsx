
import React, { useState } from 'react';

function GaleriaAnuncio({
  fotografias = [],
  titulo = 'Habitación',
}) {
  const [imagenActiva, setImagenActiva] = useState(0);

  const fotosValidas = fotografias.filter(
    (foto) => foto && foto.url
  );

  if (fotosValidas.length === 0) {
    return (
      <div className="galeria-anuncio__vacia">
        <span className="galeria-anuncio__icono">⌂</span>
        <p>No hay fotografías disponibles</p>
      </div>
    );
  }

  const seleccionarImagen = (indice) => {
    setImagenActiva(indice);
  };

  const imagenAnterior = () => {
    setImagenActiva((actual) =>
      actual === 0 ? fotosValidas.length - 1 : actual - 1
    );
  };

  const imagenSiguiente = () => {
    setImagenActiva((actual) =>
      actual === fotosValidas.length - 1 ? 0 : actual + 1
    );
  };

  return (
    <div className="galeria-anuncio">
      <div className="galeria-anuncio__principal">
        <img
          key={fotosValidas[imagenActiva].url}
          src={fotosValidas[imagenActiva].url}
          alt={`${titulo} - fotografía ${imagenActiva + 1}`}
          className="galeria-anuncio__imagen-principal"
        />

        {fotosValidas.length > 1 && (
          <>
            <button
              type="button"
              className="galeria-anuncio__navegacion galeria-anuncio__anterior"
              onClick={imagenAnterior}
              aria-label="Fotografía anterior"
            >
              ‹
            </button>

            <button
              type="button"
              className="galeria-anuncio__navegacion galeria-anuncio__siguiente"
              onClick={imagenSiguiente}
              aria-label="Fotografía siguiente"
            >
              ›
            </button>

            <span className="galeria-anuncio__contador">
              {imagenActiva + 1} / {fotosValidas.length}
            </span>
          </>
        )}
      </div>

      {fotosValidas.length > 1 && (
        <div className="galeria-anuncio__miniaturas">
          {fotosValidas.map((foto, indice) => (
            <button
              key={foto.id ?? foto.url ?? indice}
              type="button"
              className={`galeria-anuncio__miniatura ${
                imagenActiva === indice
                  ? 'galeria-anuncio__miniatura--activa'
                  : ''
              }`}
              onClick={() => seleccionarImagen(indice)}
              aria-label={`Ver fotografía ${indice + 1}`}
              aria-pressed={imagenActiva === indice}
            >
              <img
                src={foto.url}
                alt={`${titulo} - miniatura ${indice + 1}`}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default GaleriaAnuncio;
