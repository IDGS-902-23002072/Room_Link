
import React from 'react';

function BotonAnuncio({
  children,
  tipo = 'principal',
  onClick,
  disabled = false,
  type = 'button',
  className = '',
}) {
  const clases = {
    principal: 'anuncios-boton-principal',
    secundario: 'anuncios-boton-secundario',
    peligro: 'anuncios-boton-peligro',
    texto: 'anuncios-boton-texto',
  };

  return (
    <button
      type={type}
      className={`boton-anuncio ${clases[tipo] || clases.principal} ${className}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

export default BotonAnuncio;
