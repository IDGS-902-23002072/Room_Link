
import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import { useAuth } from "../../../hooks/useAuth.js";

import CampoFormulario from "../components/CampoFormulario.jsx";
import BotonAnuncio from "../components/BotonAnuncio.jsx";

import {
  obtenerAnuncioPorId,
} from "../services/anunciosService.js";

import "../styles/anuncios.css";

// ======================================================
// CONFIGURACIÓN
// ======================================================

const LONGITUD_MINIMA_TITULO = 5;
const LONGITUD_MAXIMA_TITULO = 200;
const LONGITUD_MAXIMA_DESCRIPCION = 5000;

const CLAVE_EDICION = (listingId) =>
  `roomlink:edicion:${listingId}`;

// ======================================================
// FUNCIONES AUXILIARES
// ======================================================

function obtenerFechaActual() {
  const fecha = new Date();

  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getDate()).padStart(2, "0");

  return `${anio}-${mes}-${dia}`;
}

function obtenerUbicacionOriginal(anuncio) {
  const ubicacion =
    anuncio.location ??
    anuncio.ubicacion ??
    anuncio.geoLocation ??
    anuncio.geo_location ??
    null;

  if (typeof ubicacion === "string") {
    return {
      ubicacion,
      latitude: anuncio.latitude ?? null,
      longitude: anuncio.longitude ?? null,
    };
  }

  return {
    ubicacion:
      ubicacion?.address ??
      ubicacion?.direccion ??
      ubicacion?.name ??
      "",

    latitude:
      ubicacion?.latitude ??
      ubicacion?.lat ??
      anuncio.latitude ??
      null,

    longitude:
      ubicacion?.longitude ??
      ubicacion?.lng ??
      anuncio.longitude ??
      null,
  };
}

function normalizarAnuncio(resultado) {
  const anuncio =
    resultado?.anuncio ??
    resultado?.room ??
    resultado?.data?.anuncio ??
    resultado?.data?.room ??
    resultado?.data ??
    resultado;

  if (!anuncio) {
    throw new Error(
      "No se encontró la información del anuncio."
    );
  }

  return {
    id: anuncio.id,

    title:
      anuncio.title ??
      anuncio.titulo ??
      "",

    monthlyRent:
      anuncio.monthlyRent ??
      anuncio.monthly_rent ??
      anuncio.renta ??
      "",

    description:
      anuncio.description ??
      anuncio.descripcion ??
      "",

    availableFrom:
      anuncio.availableFrom ??
      anuncio.available_from ??
      "",

    maxRoommates:
      anuncio.maxRoommates ??
      anuncio.max_roommates ??
      "",

    status:
      anuncio.status ??
      anuncio.estado ??
      "draft",

    photos: anuncio.photos ?? [],

    ...obtenerUbicacionOriginal(anuncio),
  };
}

function leerDatosTemporales(listingId) {
  try {
    const guardado = sessionStorage.getItem(
      CLAVE_EDICION(listingId)
    );

    return guardado ? JSON.parse(guardado) : null;
  } catch (error) {
    console.error(
      "No se pudieron recuperar los datos temporales:",
      error
    );

    return null;
  }
}

function guardarDatosTemporales(listingId, datos) {
  try {
    sessionStorage.setItem(
      CLAVE_EDICION(listingId),
      JSON.stringify(datos)
    );
  } catch (error) {
    console.error(
      "No se pudieron guardar los datos temporales:",
      error
    );

    throw new Error(
      "No se pudieron conservar los cambios temporalmente."
    );
  }
}

// ======================================================
// VALIDACIONES
// ======================================================

function validarFormulario(datos) {
  const errores = {};

  const titulo = datos.titulo.trim();
  const descripcion = datos.descripcion.trim();
  const renta = Number(datos.renta);

  if (!titulo) {
    errores.titulo = "El título es obligatorio.";
  } else if (titulo.length < LONGITUD_MINIMA_TITULO) {
    errores.titulo =
      `El título debe tener al menos ${LONGITUD_MINIMA_TITULO} caracteres.`;
  } else if (titulo.length > LONGITUD_MAXIMA_TITULO) {
    errores.titulo =
      `El título no puede superar ${LONGITUD_MAXIMA_TITULO} caracteres.`;
  }

  if (datos.renta === "") {
    errores.renta = "El precio de renta es obligatorio.";
  } else if (!Number.isFinite(renta) || renta <= 0) {
    errores.renta = "Ingresa una renta válida mayor a cero.";
  } else if (!/^\d+(\.\d{1,2})?$/.test(datos.renta)) {
    errores.renta = "La renta admite máximo dos decimales.";
  }

  if (descripcion.length > LONGITUD_MAXIMA_DESCRIPCION) {
    errores.descripcion =
      `La descripción no puede superar ${LONGITUD_MAXIMA_DESCRIPCION} caracteres.`;
  }

  if (datos.availableFrom) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(datos.availableFrom)) {
      errores.availableFrom =
        "La fecha no tiene un formato válido.";
    } else {
      const [anio, mes, dia] = datos.availableFrom
        .split("-")
        .map(Number);

      const fecha = new Date(
        Date.UTC(anio, mes - 1, dia)
      );

      if (
        fecha.getUTCFullYear() !== anio ||
        fecha.getUTCMonth() !== mes - 1 ||
        fecha.getUTCDate() !== dia
      ) {
        errores.availableFrom =
          "Ingresa una fecha válida.";
      }
    }
  }

  if (datos.maxRoommates !== "") {
    const cantidad = Number(datos.maxRoommates);

    if (
      !Number.isInteger(cantidad) ||
      cantidad < 1 ||
      cantidad > 100
    ) {
      errores.maxRoommates =
        "Ingresa un número entero entre 1 y 100.";
    }
  }

  return errores;
}

// ======================================================
// COMPONENTE
// ======================================================

export default function PantallaEditarPublicacion() {
  const { listingId } = useParams();

  const navigate = useNavigate();
  const location = useLocation();

  const { session, loadingSession } = useAuth();

  const token = session?.token;
  const userId = session?.user?.id;

  // ====================================================
  // ESTADOS
  // ====================================================

  const [anuncio, setAnuncio] = useState(null);

  const [datos, setDatos] = useState({
    titulo: "",
    renta: "",
    descripcion: "",
    availableFrom: "",
    maxRoommates: "",
  });

  const [errores, setErrores] = useState({});
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  // ====================================================
  // ESTADO DE LA PUBLICACIÓN
  // ====================================================

  const estadoAnuncio = String(
    anuncio?.status ?? ""
  ).toLowerCase();

  const estaCerrado = [
    "closed",
    "cerrada",
    "cerrado",
  ].includes(estadoAnuncio);

  // ====================================================
  // CARGAR PUBLICACIÓN
  // ====================================================

  useEffect(() => {
    if (loadingSession) return;

    let activo = true;

    async function cargarAnuncio() {
      try {
        setCargando(true);
        setError("");

        if (!token || !userId) {
          throw new Error(
            "Tu sesión no está disponible. Inicia sesión nuevamente."
          );
        }

        if (!listingId) {
          throw new Error(
            "No se encontró el identificador de la publicación."
          );
        }

        const resultado = await obtenerAnuncioPorId(
          listingId,
          token
        );

        if (!activo) return;

        const publicacion = normalizarAnuncio(resultado);

        if (!publicacion.id) {
          throw new Error(
            "No se pudo identificar la publicación."
          );
        }

        setAnuncio(publicacion);

        // Prioridad:
        // 1. Datos recibidos al regresar de otra pantalla.
        // 2. Datos guardados en sessionStorage.
        // 3. Datos originales del servidor.

        const datosDeNavegacion =
          location.state?.datosEdicion ?? null;

        const datosGuardados =
          leerDatosTemporales(listingId);

        const datosTemporales =
          datosDeNavegacion ?? datosGuardados ?? {};

        const datosCompletos = {
          titulo:
            datosTemporales.titulo ??
            publicacion.title,

          renta:
            datosTemporales.renta != null
              ? String(datosTemporales.renta)
              : String(publicacion.monthlyRent ?? ""),

          descripcion:
            datosTemporales.descripcion ??
            publicacion.description,

          availableFrom:
            datosTemporales.availableFrom ??
            (
              publicacion.availableFrom
                ? String(publicacion.availableFrom).slice(0, 10)
                : ""
            ),

          maxRoommates:
            datosTemporales.maxRoommates != null
              ? String(datosTemporales.maxRoommates)
              : String(publicacion.maxRoommates ?? ""),

          // Conservar ubicación original o temporal.
          ubicacion:
            datosTemporales.ubicacion ??
            publicacion.ubicacion,

          latitude:
            datosTemporales.latitude ??
            publicacion.latitude,

          longitude:
            datosTemporales.longitude ??
            publicacion.longitude,

          status: publicacion.status,
        };

        setDatos({
          titulo: datosCompletos.titulo,
          renta: datosCompletos.renta,
          descripcion: datosCompletos.descripcion,
          availableFrom: datosCompletos.availableFrom,
          maxRoommates: datosCompletos.maxRoommates,
        });

        // Guardar la versión completa para los siguientes pasos.
        guardarDatosTemporales(
          listingId,
          datosCompletos
        );

      } catch (err) {
        if (activo) {
          setError(
            err.message ||
            "No se pudo cargar la publicación."
          );
        }
      } finally {
        if (activo) {
          setCargando(false);
        }
      }
    }

    cargarAnuncio();

    return () => {
      activo = false;
    };
  }, [
    listingId,
    token,
    userId,
    loadingSession,
    location.state,
  ]);

  // ====================================================
  // CAMBIAR CAMPOS
  // ====================================================

  function cambiarCampo(evento) {
    const { name, value } = evento.target;

    setDatos((actuales) => ({
      ...actuales,
      [name]: value,
    }));

    setErrores((actuales) => ({
      ...actuales,
      [name]: "",
    }));

    setError("");
  }

  // ====================================================
  // VALIDAR
  // ====================================================

  function validar() {
    const nuevosErrores = validarFormulario(datos);

    setErrores(nuevosErrores);

    return Object.keys(nuevosErrores).length === 0;
  }

  // ====================================================
  // PREPARAR DATOS TEMPORALES
  // ====================================================

  function obtenerDatosEdicion() {
    const datosAnteriores =
      leerDatosTemporales(listingId) ?? {};

    return {
      ...datosAnteriores,

      titulo: datos.titulo.trim(),
      renta: Number(datos.renta),
      descripcion: datos.descripcion.trim(),

      availableFrom: datos.availableFrom || "",

      maxRoommates:
        datos.maxRoommates === ""
          ? ""
          : Number(datos.maxRoommates),

      // No perder ubicación ni estado al avanzar.
      ubicacion:
        datosAnteriores.ubicacion ??
        anuncio.ubicacion,

      latitude:
        datosAnteriores.latitude ??
        anuncio.latitude,

      longitude:
        datosAnteriores.longitude ??
        anuncio.longitude,

      status: anuncio.status,
    };
  }

  // ====================================================
  // CANCELAR EDICIÓN
  // ====================================================

  function cancelarEdicion() {
    try {
      sessionStorage.removeItem(
        CLAVE_EDICION(listingId)
      );
    } catch (error) {
      console.error(
        "No se pudo limpiar la edición temporal:",
        error
      );
    }

    navigate("/anuncios", {
      replace: true,
    });
  }

  // ====================================================
  // CONTINUAR A UBICACIÓN
  // ====================================================

  function irAUbicacion() {
    try {
      setError("");

      if (!anuncio) {
        throw new Error(
          "No se encontró la publicación."
        );
      }

      if (estaCerrado) {
        throw new Error(
          "Esta publicación está cerrada y no se puede editar."
        );
      }

      if (!token || !userId) {
        throw new Error(
          "Tu sesión expiró. Inicia sesión nuevamente."
        );
      }

      if (!validar()) {
        throw new Error(
          "Revisa los campos marcados antes de continuar."
        );
      }

      const datosEdicion = obtenerDatosEdicion();

      // Guardar antes de navegar.
      guardarDatosTemporales(
        listingId,
        datosEdicion
      );

      navigate(`/anuncios/${listingId}/ubicacion`, {
        state: {
          modoEdicion: true,
          datosEdicion,
        },
      });

    } catch (err) {
      setError(
        err.message ||
        "No se pudo continuar."
      );
    }
  }

  // ====================================================
  // CARGANDO
  // ====================================================

  if (loadingSession || cargando) {
    return (
      <main className="anuncios-pantalla">
        <div className="anuncios-cargando">
          Cargando información de la publicación...
        </div>
      </main>
    );
  }

  // ====================================================
  // ERROR AL CARGAR
  // ====================================================

  if (error && !anuncio) {
    return (
      <main className="anuncios-pantalla">
        <div className="anuncios-mensaje-error">
          {error}
        </div>

        <BotonAnuncio
          tipo="secundario"
          onClick={() => navigate("/anuncios")}
        >
          Volver a mis anuncios
        </BotonAnuncio>
      </main>
    );
  }

  // ====================================================
  // PUBLICACIÓN CERRADA
  // ====================================================

  if (estaCerrado) {
    return (
      <main className="anuncios-pantalla">
        <section className="anuncios-contenido">
          <header className="anuncios-encabezado">
            <span className="anuncios-etiqueta">
              ROOM_LINK
            </span>

            <h1>Publicación cerrada</h1>

            <p>
              Esta habitación ya está cerrada. Puedes
              consultar su información, pero no modificarla.
            </p>
          </header>

          <BotonAnuncio
            tipo="secundario"
            onClick={() => navigate(`/anuncios/${listingId}`)}
          >
            Ver publicación
          </BotonAnuncio>

          <BotonAnuncio
            tipo="secundario"
            onClick={() => navigate("/anuncios")}
          >
            Volver a mis anuncios
          </BotonAnuncio>
        </section>
      </main>
    );
  }

  // ====================================================
  // INTERFAZ
  // ====================================================

  return (
    <main className="anuncios-pantalla">
      <section className="anuncios-contenido">

        <header className="anuncios-encabezado">
          <span className="anuncios-etiqueta">
            ROOM_LINK / EDITAR PUBLICACIÓN
          </span>

          <h1>Editar habitación</h1>

          <p>
            Actualiza la información de tu habitación.
            Tus cambios se guardarán cuando termines los
            tres pasos y pulses Guardar.
          </p>
        </header>

        {/* INDICADOR DE PASOS */}

        <div className="fotos-progreso">
          <div className="fotos-paso activo">
            <span>1</span>
            <small>Información</small>
          </div>

          <div className="fotos-progreso-linea" />

          <div className="fotos-paso">
            <span>2</span>
            <small>Ubicación</small>
          </div>

          <div className="fotos-progreso-linea" />

          <div className="fotos-paso">
            <span>3</span>
            <small>Fotografías</small>
          </div>
        </div>

        <section className="anuncios-tarjeta">
          <div className="anuncios-formulario">

            <CampoFormulario
              etiqueta="Título de la publicación"
              nombre="titulo"
              valor={datos.titulo}
              onChange={cambiarCampo}
              placeholder="Ej. Habitación amueblada cerca del centro"
              requerido
              error={errores.titulo}
              maximo={LONGITUD_MAXIMA_TITULO}
            />

            <CampoFormulario
              etiqueta="Renta mensual (MXN)"
              nombre="renta"
              valor={datos.renta}
              onChange={cambiarCampo}
              tipo="number"
              placeholder="Ej. 3500"
              requerido
              error={errores.renta}
              minimo="0.01"
              paso="0.01"
            />

            <CampoFormulario
              etiqueta="Descripción"
              nombre="descripcion"
              valor={datos.descripcion}
              onChange={cambiarCampo}
              tipo="textarea"
              filas={5}
              placeholder="Describe tu habitación, sus características y los servicios incluidos..."
              error={errores.descripcion}
              maximo={LONGITUD_MAXIMA_DESCRIPCION}
              ayuda="Describe las características principales de la habitación."
            />

            <CampoFormulario
              etiqueta="Fecha de disponibilidad"
              nombre="availableFrom"
              valor={datos.availableFrom}
              onChange={cambiarCampo}
              tipo="date"
              error={errores.availableFrom}
              minimo={obtenerFechaActual()}
              ayuda="Puedes dejar este campo vacío si todavía no tienes una fecha definida."
            />

            <CampoFormulario
              etiqueta="Número máximo de compañeros"
              nombre="maxRoommates"
              valor={datos.maxRoommates}
              onChange={cambiarCampo}
              tipo="number"
              placeholder="Ej. 2"
              minimo="1"
              maximo="100"
              paso="1"
              error={errores.maxRoommates}
              ayuda="Este campo es opcional."
            />

          </div>

          {error && (
            <div
              className="anuncios-mensaje-error"
              role="alert"
            >
              {error}
            </div>
          )}

          <div className="fotos-nota">
            Tus cambios todavía no se han guardado.
            Podrás revisar y modificar la ubicación y las
            fotografías antes de guardar toda la publicación.
          </div>

          {/* ACCIONES */}

          <div className="fotos-acciones-finales">

            <BotonAnuncio
              tipo="peligro"
              onClick={cancelarEdicion}
            >
              Cancelar
            </BotonAnuncio>

            <BotonAnuncio
              tipo="principal"
              onClick={irAUbicacion}
            >
              Siguiente
            </BotonAnuncio>

          </div>
        </section>
      </section>
    </main>
  );
}
