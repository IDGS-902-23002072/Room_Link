
import React from 'react';

const ESTADOS = {
  draft: {
    texto: 'Borrador',
    clase: 'borrador',
    punto: '#A37AD9',
  },
  published: {
    texto: 'Activa',
    clase: 'activa',
    punto: '#2E7D5B',
  },
  paused: {
    texto: 'Pausada',
    clase: 'pausada',
    punto: '#D69A35',
  },
  closed: {
    texto: 'Cerrada',
    clase: 'cerrada',
    punto: '#77717D',
  },
};

function EstadoAnuncio({ estado }) {
  const configuracion = ESTADOS[estado] ?? {
    texto: 'Desconocido',
    clase: 'desconocido',
    punto: '#77717D',
  };

  return (
    <span className={`anuncio-estado anuncio-estado--${configuracion.clase}`}>
      <span
        className="anuncio-estado__punto"
        style={{ backgroundColor: configuracion.punto }}
      />
      {configuracion.texto}
    </span>
  );
}

export default EstadoAnuncio;
