
import React from 'react';

const FILTROS = [
  { id: 'todas', texto: 'Todas' },
  { id: 'draft', texto: 'Borradores' },
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
    <div
      className="filtros-anuncios"
      role="group"
      aria-label="Filtrar publicaciones por estado"
    >
      {FILTROS.map((filtro) => {
        const activo = filtroActivo === filtro.id;
        const cantidad = cantidades[filtro.id] ?? 0;

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

            <span className="filtros-anuncios__cantidad">
              {cantidad}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export default FiltrosAnuncios;
