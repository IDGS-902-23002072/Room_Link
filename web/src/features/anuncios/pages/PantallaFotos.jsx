
import { useEffect, useRef, useState } from "react";
import {
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";

import { useAuth } from "../../../hooks/useAuth.js";

import {
  actualizarAnuncio,
  obtenerAnuncioPorId,
  obtenerUrlFoto,
  publicarAnuncio,
} from "../services/anunciosService.js";

import BotonAnuncio from "../components/BotonAnuncio.jsx";

import "../styles/anuncios.css";

// ======================================================
// CONFIGURACIÓN
// ======================================================

const MAX_FOTOS = 10;
const MIN_FOTOS_PUBLICACION = 3;
const MAX_TAMANO_FOTO = 8 * 1024 * 1024;

const TIPOS_PERMITIDOS = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

// ======================================================
// FUNCIONES AUXILIARES
// ======================================================

function obtenerEstadoAnuncio(anuncio) {
  return String(
    anuncio?.status ?? anuncio?.estado ?? "",
  ).toLowerCase();
}

function normalizarFotosExistentes(listingId, fotos = []) {
  return [...fotos]
    .sort(
      (a, b) =>
        Number(a.position ?? 0) - Number(b.position ?? 0),
    )
    .map((foto) => ({
      id: String(foto.id),
      type: "existing",
      fileName:
        foto.fileName ??
        foto.file_name ??
        "Fotografía",
      mimeType:
        foto.mimeType ??
        foto.mime_type ??
        "",
      url: obtenerUrlFoto(listingId, foto.id),
    }));
}

// Guarda únicamente información serializable.
// Los objetos File no se pueden conservar en sessionStorage.
function obtenerDatosSerializables(datos) {
  return {
    titulo: datos?.titulo ?? "",
    renta: datos?.renta ?? "",
    descripcion: datos?.descripcion ?? "",
    ubicacion: datos?.ubicacion ?? "",
    latitude: datos?.latitude ?? "",
    longitude: datos?.longitude ?? "",
    availableFrom: datos?.availableFrom ?? "",
    maxRoommates: datos?.maxRoommates ?? "",
  };
}

function obtenerFotosParaSesion(fotos = []) {
  return fotos
    .filter((foto) => foto.type === "existing")
    .map((foto) => ({
      type: "existing",
      id: String(foto.id),
    }));
}

// ======================================================
// PANTALLA DE FOTOGRAFÍAS
// ======================================================

export default function PantallaFotos() {
  const { listingId } = useParams();

  const navigate = useNavigate();
  const location = useLocation();

  const { session, loadingSession } = useAuth();

  const CLAVE_EDICION = `roomlink:edicion:${listingId}`;

  const inputFotosRef = useRef(null);
  const urlsTemporalesRef = useRef(new Set());

  const [anuncio, setAnuncio] = useState(null);
  const [datosEdicion, setDatosEdicion] = useState({});
  const [fotos, setFotos] = useState([]);

  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  // ====================================================
  // ESTADO DEL ANUNCIO
  // ====================================================

  const estadoAnuncio = obtenerEstadoAnuncio(anuncio);

  const esBorrador = estadoAnuncio === "draft";

  const estaCerrado = [
    "closed",
    "cerrado",
    "cerrada",
  ].includes(estadoAnuncio);

  const puedeEditar = Boolean(anuncio) && !estaCerrado;

  const puedePublicar =
    esBorrador &&
    fotos.length >= MIN_FOTOS_PUBLICACION &&
    fotos.length <= MAX_FOTOS;

  // ====================================================
  // LIBERAR VISTAS PREVIAS AL SALIR
  // ====================================================

  useEffect(() => {
    return () => {
      urlsTemporalesRef.current.forEach((url) => {
        URL.revokeObjectURL(url);
      });

      urlsTemporalesRef.current.clear();
    };
  }, []);

  // ====================================================
  // CONSULTAR ANUNCIO Y RECUPERAR EDICIÓN TEMPORAL
  // ====================================================

  useEffect(() => {
    if (loadingSession) return;

    let activo = true;

    async function cargarAnuncio() {
      try {
        setCargando(true);
        setError("");

        if (!session?.token || !session?.user?.id) {
          throw new Error(
            "Tu sesión no está disponible. Inicia sesión nuevamente.",
          );
        }

        if (!listingId) {
          throw new Error(
            "No se encontró el identificador del anuncio.",
          );
        }

        const resultado = await obtenerAnuncioPorId(
          listingId,
          session.token,
        );

        if (!activo) return;

        if (!resultado) {
          throw new Error(
            "No se encontró el anuncio solicitado.",
          );
        }

        setAnuncio(resultado);

        // Recuperar datos enviados desde la pantalla anterior.
        let datosTemporales = null;

        try {
          const almacenados = sessionStorage.getItem(
            CLAVE_EDICION,
          );

          datosTemporales = almacenados
            ? JSON.parse(almacenados)
            : null;
        } catch {
          datosTemporales = null;
        }

        // Prioridad:
        // 1. Datos recibidos por navegación.
        // 2. Datos temporales de sessionStorage.
        // 3. Datos originales del anuncio.
        const datosRecibidos =
          location.state?.datosEdicion ??
          datosTemporales ??
          {};

        setDatosEdicion(datosRecibidos);

        // Guardar temporalmente los datos de información y ubicación.
        const datosParaSesion =
          obtenerDatosSerializables(datosRecibidos);

        sessionStorage.setItem(
          CLAVE_EDICION,
          JSON.stringify(datosParaSesion),
        );

        // Recuperar fotografías originales del servidor.
        const fotosOriginales = normalizarFotosExistentes(
          listingId,
          resultado.photos ?? [],
        );

        // Recuperar el orden de fotografías enviado desde
        // Ubicación o desde la sesión temporal.
        const fotosRecibidas =
          location.state?.datosEdicion?.fotos ??
          datosTemporales?.fotos ??
          null;

        if (Array.isArray(fotosRecibidas)) {
          const fotosExistentesPorId = new Map(
            fotosOriginales.map((foto) => [
              String(foto.id),
              foto,
            ]),
          );

          const fotosRecuperadas = [];

          fotosRecibidas.forEach((foto) => {
            if (foto.type === "existing") {
              const existente = fotosExistentesPorId.get(
                String(foto.id),
              );

              if (existente) {
                fotosRecuperadas.push(existente);
                fotosExistentesPorId.delete(
                  String(foto.id),
                );
              }
            }

            if (foto.type === "new" && foto.file) {
              let preview = foto.preview;

              if (!preview) {
                preview = URL.createObjectURL(foto.file);
                urlsTemporalesRef.current.add(preview);
              }

              fotosRecuperadas.push({
                ...foto,
                preview,
                type: "new",
              });
            }
          });

          // Las fotografías existentes que no llegaron en el
          // orden temporal se agregan al final.
          fotosExistentesPorId.forEach((foto) => {
            fotosRecuperadas.push(foto);
          });

          setFotos(fotosRecuperadas);
        } else {
          setFotos(fotosOriginales);
        }
      } catch (err) {
        if (activo) {
          setError(
            err.message ||
              "No se pudo cargar la información del anuncio.",
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
    session?.token,
    session?.user?.id,
    loadingSession,
    location.state,
  ]);

  // ====================================================
  // CONSERVAR DATOS TEMPORALES
  // ====================================================

  useEffect(() => {
    if (cargando || !anuncio || estaCerrado) return;

    const datosParaSesion = {
      ...obtenerDatosSerializables(datosEdicion),
      fotos: obtenerFotosParaSesion(fotos),
    };

    try {
      sessionStorage.setItem(
        CLAVE_EDICION,
        JSON.stringify(datosParaSesion),
      );
    } catch {
      // El guardado definitivo seguirá disponible mientras
      // los datos permanezcan en el estado de React.
    }
  }, [
    cargando,
    anuncio,
    estaCerrado,
    datosEdicion,
    fotos,
    CLAVE_EDICION,
  ]);

  // ====================================================
  // ABRIR SELECTOR DE ARCHIVOS
  // ====================================================

  function abrirSelectorFotos() {
    if (!puedeEditar || guardando) return;

    if (fotos.length >= MAX_FOTOS) {
      setError(
        "Solo puedes agregar un máximo de 10 fotografías.",
      );
      return;
    }

    setError("");
    inputFotosRef.current?.click();
  }

  // ====================================================
  // AGREGAR FOTOGRAFÍAS
  // ====================================================

  function agregarFotos(evento) {
    if (!puedeEditar || guardando) {
      evento.target.value = "";
      return;
    }

    const archivos = Array.from(
      evento.target.files ?? [],
    );

    setError("");
    setMensaje("");

    if (archivos.length === 0) return;

    const espacioDisponible = MAX_FOTOS - fotos.length;

    if (espacioDisponible <= 0) {
      setError(
        "Ya alcanzaste el máximo de 10 fotografías.",
      );

      evento.target.value = "";
      return;
    }

    const archivosSeleccionados = archivos.slice(
      0,
      espacioDisponible,
    );

    const nuevasFotos = [];
    const errores = [];

    archivosSeleccionados.forEach((archivo, indice) => {
      if (!TIPOS_PERMITIDOS.includes(archivo.type)) {
        errores.push(
          `${archivo.name}: formato no permitido.`,
        );
        return;
      }

      if (archivo.size > MAX_TAMANO_FOTO) {
        errores.push(
          `${archivo.name}: supera el límite de 8 MB.`,
        );
        return;
      }

      const preview = URL.createObjectURL(archivo);

      urlsTemporalesRef.current.add(preview);

      nuevasFotos.push({
        id: `nueva-${Date.now()}-${indice}-${Math.random()}`,
        type: "new",
        file: archivo,
        fileName: archivo.name,
        mimeType: archivo.type,
        preview,
      });
    });

    if (archivos.length > espacioDisponible) {
      errores.push(
        `Solo se pueden agregar ${espacioDisponible} fotografías más porque alcanzaste el límite de 10.`,
      );
    }

    if (nuevasFotos.length > 0) {
      setFotos((actuales) => [
        ...actuales,
        ...nuevasFotos,
      ]);
    }

    if (errores.length > 0) {
      setError(errores.join(" "));
    }

    // Permite volver a seleccionar el mismo archivo.
    evento.target.value = "";
  }

  // ====================================================
  // ELIMINAR FOTOGRAFÍA
  // ====================================================

  function eliminarFoto(id) {
    if (!puedeEditar || guardando) return;

    setFotos((actuales) => {
      const fotoEliminada = actuales.find(
        (foto) => foto.id === id,
      );

      if (fotoEliminada?.preview) {
        URL.revokeObjectURL(fotoEliminada.preview);

        urlsTemporalesRef.current.delete(
          fotoEliminada.preview,
        );
      }

      return actuales.filter((foto) => foto.id !== id);
    });

    setError("");
    setMensaje("");
  }

  // ====================================================
  // CAMBIAR ORDEN DE FOTOGRAFÍAS
  // ====================================================

  function moverFoto(indice, direccion) {
    if (!puedeEditar || guardando) return;

    setFotos((actuales) => {
      const destino = indice + direccion;

      if (
        destino < 0 ||
        destino >= actuales.length
      ) {
        return actuales;
      }

      const copia = [...actuales];

      [copia[indice], copia[destino]] = [
        copia[destino],
        copia[indice],
      ];

      return copia;
    });

    setError("");
    setMensaje("");
  }

  // ====================================================
  // PREPARAR DATOS PARA EL SERVICIO
  // ====================================================

  function obtenerDatosActualizacion() {
    return {
      // Información del paso 1.
      titulo:
        datosEdicion.titulo ??
        anuncio.title ??
        anuncio.titulo ??
        "",

      renta:
        datosEdicion.renta ??
        anuncio.monthlyRent ??
        anuncio.renta ??
        "",

      descripcion:
        datosEdicion.descripcion ??
        anuncio.description ??
        anuncio.descripcion ??
        "",

      availableFrom:
        datosEdicion.availableFrom ??
        anuncio.availableFrom ??
        anuncio.available_from ??
        "",

      maxRoommates:
        datosEdicion.maxRoommates ??
        anuncio.maxRoommates ??
        anuncio.max_roommates ??
        "",

      // Información del paso 2.
      ubicacion:
        datosEdicion.ubicacion ??
        anuncio.location?.address ??
        anuncio.ubicacion ??
        "",

      latitude:
        datosEdicion.latitude ??
        anuncio.location?.latitude ??
        anuncio.latitude ??
        "",

      longitude:
        datosEdicion.longitude ??
        anuncio.location?.longitude ??
        anuncio.longitude ??
        "",

      // Orden final de las fotografías.
      fotos: fotos.map((foto) => {
        if (foto.type === "existing") {
          return {
            type: "existing",
            id: foto.id,
          };
        }

        return {
          type: "new",
          file: foto.file,
        };
      }),
    };
  }

  // ====================================================
  // CANCELAR EDICIÓN
  // ====================================================

  function cancelarEdicion() {
    if (guardando) return;

    sessionStorage.removeItem(CLAVE_EDICION);

    navigate("/anuncios", {
      replace: true,
    });
  }

  // ====================================================
  // GUARDAR TODA LA PUBLICACIÓN
  // ====================================================

  async function guardarFotografias() {
    if (guardando) return;

    try {
      setError("");
      setMensaje("");

      if (!anuncio) {
        throw new Error(
          "No se encontró el anuncio.",
        );
      }

      if (estaCerrado) {
        throw new Error(
          "Este anuncio está cerrado y ya no se puede modificar.",
        );
      }

      if (!session?.token || !session?.user?.id) {
        throw new Error(
          "Tu sesión expiró. Inicia sesión nuevamente.",
        );
      }

      if (fotos.length > MAX_FOTOS) {
        throw new Error(
          "No puedes agregar más de 10 fotografías.",
        );
      }

      // Los borradores necesitan al menos 3 fotografías
      // para poder publicarse.
      if (
        esBorrador &&
        fotos.length < MIN_FOTOS_PUBLICACION
      ) {
        throw new Error(
          "Necesitas al menos 3 fotografías para publicar tu habitación.",
        );
      }

      // Comprobar que las fotografías nuevas tengan archivo.
      const hayArchivosInvalidos = fotos.some(
        (foto) =>
          foto.type === "new" &&
          !(foto.file instanceof File),
      );

      if (hayArchivosInvalidos) {
        throw new Error(
          "Una o más fotografías nuevas ya no están disponibles. Agrégalas nuevamente.",
        );
      }

      setGuardando(true);

      // 1. Actualizar información, ubicación y fotografías.
      await actualizarAnuncio(
        listingId,
        obtenerDatosActualizacion(),
        session.token,
        session.user.id,
      );

      // 2. Publicar únicamente cuando el anuncio era borrador.
      if (esBorrador) {
        await publicarAnuncio(
          listingId,
          session.token,
          session.user.id,
        );
      }

      // 3. Eliminar los datos temporales después de completar
      // correctamente todas las operaciones.
      sessionStorage.removeItem(CLAVE_EDICION);

      // 4. Regresar a la lista de anuncios.
      navigate("/anuncios", {
        replace: true,
        state: {
          mensaje: esBorrador
            ? "¡Tu habitación se guardó y publicó correctamente!"
            : "Los cambios de tu publicación se guardaron correctamente.",
        },
      });
    } catch (err) {
      setError(
        err.message ||
          "No se pudieron guardar los cambios de la publicación.",
      );
    } finally {
      setGuardando(false);
    }
  }

  // ====================================================
  // ESTADOS DE CARGA
  // ====================================================

  if (loadingSession || cargando) {
    return (
      <main className="fotos-pantalla">
        <div className="fotos-cargando">
          Cargando fotografías del anuncio...
        </div>
      </main>
    );
  }

  // ====================================================
  // ERROR AL CARGAR
  // ====================================================

  if (error && !anuncio) {
    return (
      <main className="fotos-pantalla">
        <div className="fotos-mensaje-error">
          {error}
        </div>

        <BotonAnuncio
          tipo="secundario"
          onClick={cancelarEdicion}
        >
          Volver a mis anuncios
        </BotonAnuncio>
      </main>
    );
  }

  // ====================================================
  // ANUNCIO CERRADO
  // ====================================================

  if (estaCerrado) {
    return (
      <main className="fotos-pantalla">
        <section className="fotos-contenido">
          <header className="fotos-encabezado">
            <span className="fotos-etiqueta">
              ROOM_LINK
            </span>

            <h1>Publicación cerrada</h1>

            <p>
              Esta publicación está cerrada. Puedes consultar
              sus fotografías, pero ya no puedes modificarlas.
            </p>
          </header>

          <section className="fotos-tarjeta">
            <div className="fotos-galeria">
              {fotos.map((foto, indice) => (
                <article
                  className="fotos-elemento"
                  key={foto.id}
                >
                  <div className="fotos-imagen-contenedor">
                    <img
                      src={foto.preview ?? foto.url}
                      alt={`Fotografía ${indice + 1}`}
                      className="fotos-imagen"
                    />

                    {indice === 0 && (
                      <span className="fotos-etiqueta-principal">
                        Principal
                      </span>
                    )}
                  </div>
                </article>
              ))}
            </div>

            <BotonAnuncio
              tipo="secundario"
              onClick={() => navigate("/anuncios")}
            >
              Volver a mis anuncios
            </BotonAnuncio>
          </section>
        </section>
      </main>
    );
  }

  // ====================================================
  // INTERFAZ
  // ====================================================

  return (
    <main className="fotos-pantalla">
      <section className="fotos-contenido">
        <header className="fotos-encabezado">
          <span className="fotos-etiqueta">
            ROOM_LINK / 03
          </span>

          <h1>Fotos de tu habitación</h1>

          <p>
            Muestra cada rincón de tu espacio para que las
            personas interesadas puedan conocerlo.
          </p>
        </header>

        {/* INDICADOR DE PASOS */}

        <div className="fotos-progreso">
          <div className="fotos-paso completado">
            <span>1</span>
            <small>Información</small>
          </div>

          <div className="fotos-progreso-linea completada" />

          <div className="fotos-paso completado">
            <span>2</span>
            <small>Ubicación</small>
          </div>

          <div className="fotos-progreso-linea activa" />

          <div className="fotos-paso activo">
            <span>3</span>
            <small>Fotografías</small>
          </div>
        </div>

        <section className="fotos-tarjeta">
          {/* CONTADOR */}

          <div className="fotos-contador">
            <div>
              <h2>Fotografías agregadas</h2>

              <p>
                Agrega entre 3 y 10 fotografías para publicar.
              </p>
            </div>

            <span className="fotos-contador-numero">
              {fotos.length}/{MAX_FOTOS}
            </span>
          </div>

          {/* INPUT OCULTO */}

          <input
            ref={inputFotosRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            onChange={agregarFotos}
            className="fotos-input-oculto"
            disabled={guardando}
          />

          {/* LISTA DE FOTOGRAFÍAS */}

          {fotos.length > 0 && (
            <div className="fotos-galeria">
              {fotos.map((foto, indice) => (
                <article
                  className="fotos-elemento"
                  key={foto.id}
                >
                  <div className="fotos-imagen-contenedor">
                    <img
                      src={foto.preview ?? foto.url}
                      alt={`Fotografía ${indice + 1} de la habitación`}
                      className="fotos-imagen"
                    />

                    {indice === 0 && (
                      <span className="fotos-etiqueta-principal">
                        Principal
                      </span>
                    )}
                  </div>

                  <div className="fotos-informacion">
                    <div className="fotos-nombre">
                      <strong>
                        {indice === 0
                          ? "Fotografía principal"
                          : `Fotografía ${indice + 1}`}
                      </strong>

                      <span title={foto.fileName}>
                        {foto.fileName}
                      </span>
                    </div>

                    <div className="fotos-acciones">
                      <button
                        type="button"
                        onClick={() => moverFoto(indice, -1)}
                        disabled={
                          indice === 0 || guardando
                        }
                        aria-label="Mover fotografía hacia arriba"
                      >
                        ↑
                      </button>

                      <button
                        type="button"
                        onClick={() => moverFoto(indice, 1)}
                        disabled={
                          indice === fotos.length - 1 ||
                          guardando
                        }
                        aria-label="Mover fotografía hacia abajo"
                      >
                        ↓
                      </button>

                      <button
                        type="button"
                        className="fotos-eliminar"
                        onClick={() => eliminarFoto(foto.id)}
                        disabled={guardando}
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}

          {/* ESTADO VACÍO */}

          {fotos.length === 0 && (
            <div className="fotos-vacio">
              <span className="fotos-icono-vacio">
                +
              </span>

              <strong>
                Todavía no agregas fotografías
              </strong>

              <p>
                Selecciona imágenes de tu computadora para comenzar.
              </p>
            </div>
          )}

          {/* AGREGAR FOTOGRAFÍAS */}

          <button
            type="button"
            className="fotos-boton-agregar"
            onClick={abrirSelectorFotos}
            disabled={
              fotos.length >= MAX_FOTOS || guardando
            }
          >
            + Agregar fotografías
          </button>

          <p className="fotos-ayuda">
            Formatos permitidos: JPG, PNG y WEBP.
            Máximo 8 MB por fotografía.
          </p>

          {/* MENSAJES */}

          {error && (
            <div className="fotos-mensaje-error">
              {error}
            </div>
          )}

          {mensaje && (
            <div className="fotos-mensaje-exito">
              {mensaje}
            </div>
          )}

          {/* ACCIONES FINALES */}

          <div className="fotos-acciones-finales">
            <BotonAnuncio
              tipo="secundario"
              onClick={cancelarEdicion}
              disabled={guardando}
            >
              Cancelar
            </BotonAnuncio>

            <BotonAnuncio
              tipo="principal"
              onClick={guardarFotografias}
              disabled={
                guardando ||
                (esBorrador && !puedePublicar)
              }
            >
              {guardando ? "Guardando..." : "Guardar"}
            </BotonAnuncio>
          </div>

          <p className="fotos-nota">
            La primera fotografía será la imagen principal.

            {esBorrador
              ? " Necesitas al menos 3 fotografías para guardar y publicar tu habitación."
              : " Puedes conservar, eliminar, agregar o reordenar tus fotografías antes de guardar."}
          </p>
        </section>
      </section>
    </main>
  );
}
