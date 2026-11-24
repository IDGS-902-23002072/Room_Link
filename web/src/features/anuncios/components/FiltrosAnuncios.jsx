
import React from 'react';

const FILTROS = [
  { id: 'todas', texto: 'Todas' },
  { id: 'published', texto: 'Activas' },
  { id: 'paused', texto: 'Pausadas' },
  { id: 'closed', texto: 'Cerradas' },
];

function FiltrosAnuncios({
  filtroActivo = 'todas',
  onCambiarFiltro,
  cantidades = {},
}) {
  return (
    <div className="filtros-anuncios">
      {FILTROS.map((filtro) => {
        const activo = filtroActivo === filtro.id;
        const cantidad = cantidades[filtro.id];

        return (
          <button
            key={filtro.id}
            type="button"
            className={`filtros-anuncios__boton ${
              activo ? 'filtros-anuncios__boton--activo' : ''
            }`}
            onClick={() => onCambiarFiltro?.(filtro.id)}
            aria-pressed={activo}
          >
            <span>{filtro.texto}</span>

            {cantidad !== undefined && (
              <span className="filtros-anuncios__cantidad">
                {cantidad}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default FiltrosAnuncios;
