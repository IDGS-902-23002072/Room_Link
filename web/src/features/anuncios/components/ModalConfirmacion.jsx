
import React from 'react';
import BotonAnuncio from './BotonAnuncio';

function ModalConfirmacion({
  abierto = false,
  titulo = '¿Estás seguro?',
  mensaje = 'Confirma si deseas continuar con esta acción.',
  textoConfirmar = 'Confirmar',
  textoCancelar = 'Cancelar',
  tipo = 'principal',
  cargando = false,
  onConfirmar,
  onCancelar,
}) {
  if (!abierto) return null;

  return (
    <div
      className="modal-anuncio__fondo"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !cargando) {
          onCancelar?.();
        }
      }}
    >
      <section
        className="modal-anuncio"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-anuncio-titulo"
      >
        <div className="modal-anuncio__icono">
          <span>!</span>
        </div>

        <h2
          id="modal-anuncio-titulo"
          className="modal-anuncio__titulo"
        >
          {titulo}
        </h2>

        <p className="modal-anuncio__mensaje">
          {mensaje}
        </p>

        <div className="modal-anuncio__acciones">
          <BotonAnuncio
            tipo="peligro"
            onClick={onCancelar}
            disabled={cargando}
          >
            {textoCancelar}
          </BotonAnuncio>

          <BotonAnuncio
            tipo={tipo}
            onClick={onConfirmar}
            disabled={cargando}
          >
            {cargando ? 'Procesando...' : textoConfirmar}
          </BotonAnuncio>
        </div>
      </section>
    </div>
  );
}

export default ModalConfirmacion;
