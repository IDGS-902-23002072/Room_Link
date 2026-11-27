
import React from 'react';

const PASOS = [
  { numero: 1, nombre: 'Información' },
  { numero: 2, nombre: 'Ubicación' },
  { numero: 3, nombre: 'Fotografías' },
];

export default function IndicadorPasos({ pasoActual = 1 }) {
  return (
    <div className="indicador-pasos">
      {PASOS.map((paso, indice) => {
        const completado = paso.numero < pasoActual;
        const activo = paso.numero === pasoActual;

        return (
          <React.Fragment key={paso.numero}>
            <div
              className={`indicador-pasos__paso ${
                activo ? 'activo' : ''
              } ${completado ? 'completado' : ''}`}
            >
              <span className="indicador-pasos__numero">
                {completado ? '✓' : paso.numero}
              </span>

              <span className="indicador-pasos__nombre">
                {paso.nombre}
              </span>
            </div>

            {indice < PASOS.length - 1 && (
              <div
                className={`indicador-pasos__linea ${
                  completado ? 'completada' : ''
                }`}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
