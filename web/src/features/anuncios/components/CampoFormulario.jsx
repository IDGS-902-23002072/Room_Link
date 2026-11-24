
import React from 'react';

function CampoFormulario({
  etiqueta,
  nombre,
  valor = '',
  onChange,
  tipo = 'text',
  placeholder = '',
  requerido = false,
  deshabilitado = false,
  error = '',
  ayuda = '',
  filas = 4,
  minimo,
  maximo,
  paso,
}) {
  const idCampo = `campo-anuncio-${nombre}`;

  const propiedades = {
    id: idCampo,
    name: nombre,
    value: valor,
    onChange: (event) => onChange?.(event.target.value),
    placeholder,
    required: requerido,
    disabled: deshabilitado,
    min: minimo,
    max: maximo,
    step: paso,
    'aria-invalid': Boolean(error),
    'aria-describedby': error
      ? `${idCampo}-error`
      : ayuda
        ? `${idCampo}-ayuda`
        : undefined,
  };

  return (
    <div className="campo-formulario">
      <label
        htmlFor={idCampo}
        className="campo-formulario__etiqueta"
      >
        {etiqueta}
        {requerido && (
          <span className="campo-formulario__requerido"> *</span>
        )}
      </label>

      {tipo === 'textarea' ? (
        <textarea
          {...propiedades}
          rows={filas}
          className={`campo-formulario__control campo-formulario__textarea ${
            error ? 'campo-formulario__control--error' : ''
          }`}
        />
      ) : (
        <input
          {...propiedades}
          type={tipo}
          className={`campo-formulario__control ${
            error ? 'campo-formulario__control--error' : ''
          }`}
        />
      )}

      {ayuda && !error && (
        <small
          id={`${idCampo}-ayuda`}
          className="campo-formulario__ayuda"
        >
          {ayuda}
        </small>
      )}

      {error && (
        <small
          id={`${idCampo}-error`}
          className="campo-formulario__error"
          role="alert"
        >
          {error}
        </small>
      )}
    </div>
  );
}

export default CampoFormulario;
