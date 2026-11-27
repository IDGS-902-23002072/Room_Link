
import HostGate from "../../roomlink/HostGate.jsx";
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../../../hooks/useAuth.js";
import CampoFormulario from "../components/CampoFormulario.jsx";
import BotonAnuncio from "../components/BotonAnuncio.jsx";
import IndicadorPasos from "../components/IndicadorPasos.jsx";

import {
  crearAnuncio,
} from "../services/anunciosService.js";

import "../styles/anuncios.css";

// ======================================================
// FECHA ACTUAL DE MÉXICO
// ======================================================

function obtenerFechaMexico() {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const valores = Object.fromEntries(
    partes.map((parte) => [parte.type, parte.value])
  );

  return `${valores.year}-${valores.month}-${valores.day}`;
}

// ======================================================
// VALIDAR FECHA
// ======================================================

function validarFecha(fecha) {
  if (!fecha) return false;

  const coincidencia = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha);

  if (!coincidencia) return false;

  const anio = Number(coincidencia[1]);
  const mes = Number(coincidencia[2]);
  const dia = Number(coincidencia[3]);

  const fechaUTC = new Date(Date.UTC(anio, mes - 1, dia));

  return (
    fechaUTC.getUTCFullYear() === anio &&
    fechaUTC.getUTCMonth() === mes - 1 &&
    fechaUTC.getUTCDate() === dia
  );
}

// ======================================================
// VALIDAR FORMULARIO
// ======================================================

function validarDatos(datos, intencion) {
  const errores = {};

  const titulo = datos.titulo.trim();
  const renta = datos.renta.replace(/[$,\s]/g, "").trim();
  const numeroRenta = Number(renta);

  if (!titulo) {
    errores.titulo = "El título es obligatorio.";
  } else if (titulo.length < 5 || titulo.length > 200) {
    errores.titulo = "El título debe tener entre 5 y 200 caracteres.";
  }

  if (!renta) {
    errores.renta = "La renta mensual es obligatoria.";
  } else if (
    !/^\d+(\.\d{1,2})?$/.test(renta) ||
    !Number.isFinite(numeroRenta) ||
    numeroRenta <= 0 ||
    numeroRenta > 99999999.99
  ) {
    errores.renta = "Ingresa una renta válida con máximo dos decimales.";
  }

  if (datos.descripcion.trim().length > 5000) {
    errores.descripcion =
      "La descripción no puede superar los 5000 caracteres.";
  }

  // Para publicar se necesita una fecha válida.
  // Para guardar un borrador es opcional.
  if (intencion === "publicar") {
    if (!datos.availableFrom) {
      errores.availableFrom =
        "Selecciona cuándo estará disponible la habitación.";
    } else if (!validarFecha(datos.availableFrom)) {
      errores.availableFrom = "La fecha seleccionada no es válida.";
    } else if (datos.availableFrom < obtenerFechaMexico()) {
      errores.availableFrom = "La fecha debe ser hoy o posterior.";
    }
  }

  if (datos.availableFrom && !validarFecha(datos.availableFrom)) {
    errores.availableFrom = "La fecha seleccionada no es válida.";
  }

  if (datos.maxRoommates.trim()) {
    const cantidad = Number(datos.maxRoommates);

    if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > 100) {
      errores.maxRoommates =
        "Ingresa un número entero entre 1 y 100.";
    }
  }

  return errores;
}

// ======================================================
// PANTALLA PUBLICAR HABITACIÓN
// ======================================================

export default function PantallaPublicarHabitacion() {
  const navigate = useNavigate();
  const { session } = useAuth();

  const [datos, setDatos] = useState({
    titulo: "",
    renta: "",
    descripcion: "",
    availableFrom: "",
    maxRoommates: "",
  });

  const [errores, setErrores] = useState({});
  const [guardando, setGuardando] = useState(false);
  const [errorServidor, setErrorServidor] = useState("");

  // ====================================================
  // ACTUALIZAR CAMPOS
  // ====================================================

  function actualizarCampo(nombre, valor) {
    setDatos((anterior) => ({
      ...anterior,
      [nombre]: valor,
    }));

    setErrores((anteriores) => ({
      ...anteriores,
      [nombre]: "",
    }));

    setErrorServidor("");
  }

  // ====================================================
  // CREAR PUBLICACIÓN
  // ====================================================

  async function guardar(intencion) {
    const nuevosErrores = validarDatos(datos, intencion);

    setErrores(nuevosErrores);

    if (Object.keys(nuevosErrores).length > 0) {
      return;
    }

    if (!session?.token || !session?.user?.id) {
      setErrorServidor(
        "Tu sesión no está disponible. Inicia sesión nuevamente."
      );
      return;
    }

    setGuardando(true);
    setErrorServidor("");

    try {
      const datosAnuncio = {
        titulo: datos.titulo.trim(),
        renta: datos.renta.replace(/[$,\s]/g, ""),
        descripcion: datos.descripcion.trim(),
        availableFrom: datos.availableFrom || null,
        maxRoommates: datos.maxRoommates.trim()
          ? Number(datos.maxRoommates)
          : null,
        fotos: [],
      };

      // Crear una publicación nueva.
      // El servicio debe crearla inicialmente como draft.
      const resultado = await crearAnuncio(
        datosAnuncio,
        session.token,
        session.user.id
      );

      if (!resultado?.id) {
        throw new Error(
          "La publicación se creó, pero no se recibió su identificador."
        );
      }

      if (intencion === "borrador") {
        navigate("/anuncios", {
          state: {
            mensaje: "Tu borrador se guardó correctamente.",
          },
        });

        return;
      }

      // Continuar con la ubicación y las fotografías.
      // Todavía no se publica automáticamente.
      navigate(`/anuncios/${resultado.id}/ubicacion`, {
        state: {
          continuarPublicacion: true,
          nuevaPublicacion: true,
        },
      });
    } catch (error) {
      setErrorServidor(
        error.message || "No se pudo crear la publicación."
      );
    } finally {
      setGuardando(false);
    }
  }

  // ====================================================
  // INTERFAZ
  // ====================================================

  if (!session?.user?.roles?.includes("host")) return <HostGate />;

  return (
    <section className="publicar-habitacion">
      <div className="publicar-habitacion__encabezado">
        <button
          type="button"
          className="publicar-habitacion__volver"
          onClick={() => navigate("/anuncios")}
        >
          ← Volver a mis anuncios
        </button>

        <span className="publicar-habitacion__etiqueta">
          ROOMLINK · PUBLICACIONES
        </span>

        <h1>Publica tu habitación</h1>

        <p>
          Cuéntales a tus futuros roomies cómo es el espacio que estás
          ofreciendo.
        </p>
      </div>

      <div className="publicar-habitacion__contenido">
        <IndicadorPasos pasoActual={1} />

        <form
          className="publicar-habitacion__formulario"
          onSubmit={(event) => {
            event.preventDefault();
            guardar("publicar");
          }}
        >
          <div className="publicar-habitacion__titulo-seccion">
            <span>01</span>

            <div>
              <h2>Información de la habitación</h2>
              <p>Comencemos con los datos principales.</p>
            </div>
          </div>

          <CampoFormulario
            etiqueta="Título de tu publicación"
            nombre="titulo"
            valor={datos.titulo}
            onChange={(evento) => actualizarCampo("titulo", evento.target.value)}
            placeholder="Ej. Habitación amueblada cerca del centro"
            requerido
            maximo={200}
            error={errores.titulo}
            ayuda="Utiliza un título claro que describa tu habitación."
          />

          <div className="publicar-habitacion__dos-columnas">
            <CampoFormulario
              etiqueta="Renta mensual (MXN)"
              nombre="renta"
              valor={datos.renta}
              onChange={(evento) => actualizarCampo("renta", evento.target.value)}
              placeholder="Ej. 3500.00"
              requerido
              tipo="number"
              minimo="0.01"
              paso="0.01"
              error={errores.renta}
              ayuda="Indica el precio mensual de la habitación."
            />

            <CampoFormulario
              etiqueta="Máximo de compañeros"
              nombre="maxRoommates"
              valor={datos.maxRoommates}
              onChange={(evento) =>
                actualizarCampo("maxRoommates", evento.target.value)
              }
              placeholder="Ej. 2"
              tipo="number"
              minimo="1"
              maximo="100"
              paso="1"
              error={errores.maxRoommates}
              ayuda="Campo opcional."
            />
          </div>

          <CampoFormulario
            etiqueta="Descripción"
            nombre="descripcion"
            valor={datos.descripcion}
            onChange={(evento) =>
              actualizarCampo("descripcion", evento.target.value)
            }
            placeholder="Describe la habitación, sus características, servicios incluidos y cualquier detalle importante..."
            tipo="textarea"
            filas={5}
            error={errores.descripcion}
            ayuda={`${datos.descripcion.length}/5000 caracteres`}
          />

          <CampoFormulario
            etiqueta="¿A partir de cuándo estará disponible?"
            nombre="availableFrom"
            valor={datos.availableFrom}
            onChange={(evento) =>
              actualizarCampo("availableFrom", evento.target.value)
            }
            tipo="date"
            minimo={obtenerFechaMexico()}
            error={errores.availableFrom}
            ayuda="Selecciona hoy o una fecha futura."
          />

          {errorServidor && (
            <div
              className="publicar-habitacion__error-servidor"
              role="alert"
            >
              {errorServidor}
            </div>
          )}

          <div className="publicar-habitacion__nota">
            <span>✦</span>

            <p>
              Para publicar tu habitación también necesitarás completar
              su ubicación y agregar al menos 3 fotografías. Puedes
              guardar un borrador y terminarlo después.
            </p>
          </div>

          <div className="publicar-habitacion__acciones">
            <BotonAnuncio
              tipo="secundario"
              type="button"
              disabled={guardando}
              onClick={() => guardar("borrador")}
            >
              {guardando ? "Guardando..." : "Guardar borrador"}
            </BotonAnuncio>

            <BotonAnuncio
              tipo="principal"
              type="submit"
              disabled={guardando}
            >
              {guardando ? "Guardando..." : "Publicar →"}
            </BotonAnuncio>
          </div>
        </form>
      </div>
    </section>
  );
}
