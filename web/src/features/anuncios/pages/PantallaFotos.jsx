
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

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
// PANTALLA DE FOTOGRAFÍAS
// ======================================================

export default function PantallaFotos() {
  const { listingId } = useParams();
  const navigate = useNavigate();

  const { session, loadingSession } = useAuth();

  const inputFotosRef = useRef(null);
  const urlsTemporalesRef = useRef(new Set());

  const [anuncio, setAnuncio] = useState(null);
  const [fotos, setFotos] = useState([]);

  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  // ====================================================
  // ESTADO DEL ANUNCIO
  // ====================================================

  const estadoAnuncio = String(
    anuncio?.status ?? anuncio?.estado ?? "",
  ).toLowerCase();

  const esBorrador = estadoAnuncio === "draft";
  const estaCerrado = estadoAnuncio === "closed";

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
  // CONSULTAR ANUNCIO Y FOTOGRAFÍAS EXISTENTES
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
          throw new Error("No se encontró el anuncio solicitado.");
        }

        setAnuncio(resultado);

        const fotosGuardadas = [...(resultado.photos ?? [])]
          .sort(
            (a, b) =>
              Number(a.position ?? 0) - Number(b.position ?? 0),
          )
          .map((foto) => ({
            id: String(foto.id),
            type: "existing",
            fileName: foto.fileName ?? foto.file_name ?? "Fotografía",
            mimeType: foto.mimeType ?? foto.mime_type ?? "",
            url: obtenerUrlFoto(listingId, foto.id),
          }));

        setFotos(fotosGuardadas);
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
  ]);

  // ====================================================
  // ABRIR SELECTOR DE ARCHIVOS
  // ====================================================

  function abrirSelectorFotos() {
    if (!puedeEditar || guardando) return;

    if (fotos.length >= MAX_FOTOS) {
      setError("Solo puedes agregar un máximo de 10 fotografías.");
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

    const archivos = Array.from(evento.target.files ?? []);

    setError("");
    setMensaje("");

    if (archivos.length === 0) return;

    const espacioDisponible = MAX_FOTOS - fotos.length;

    if (espacioDisponible <= 0) {
      setError("Ya alcanzaste el máximo de 10 fotografías.");
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
        errores.push(`${archivo.name}: formato no permitido.`);
        return;
      }

      if (archivo.size > MAX_TAMANO_FOTO) {
        errores.push(`${archivo.name}: supera el límite de 8 MB.`);
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
      titulo: anuncio.title ?? anuncio.titulo ?? "",
      renta:
        anuncio.monthlyRent ??
        anuncio.renta ??
        "",
      descripcion:
        anuncio.description ??
        anuncio.descripcion ??
        "",
      ubicacion:
        anuncio.location?.address ??
        anuncio.ubicacion ??
        "",
      latitude:
        anuncio.location?.latitude ??
        anuncio.latitude ??
        "",
      longitude:
        anuncio.location?.longitude ??
        anuncio.longitude ??
        "",
      availableFrom:
        anuncio.availableFrom ??
        anuncio.available_from ??
        "",
      maxRoommates:
        anuncio.maxRoommates ??
        anuncio.max_roommates ??
        "",

      // Se envía el orden completo de las fotografías.
      // Las existentes se conservan y las nuevas se agregan.
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
  // GUARDAR FOTOGRAFÍAS
  // ====================================================

  async function guardarFotografias(publicar = false) {
    if (guardando) return;

    try {
      setError("");
      setMensaje("");

      if (!anuncio) {
        throw new Error("No se encontró el anuncio.");
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

      // Solo los borradores pueden publicarse desde esta pantalla.
      if (publicar && !esBorrador) {
        throw new Error(
          "Solo puedes publicar un anuncio que se encuentre en borrador.",
        );
      }

      if (
        publicar &&
        fotos.length < MIN_FOTOS_PUBLICACION
      ) {
        throw new Error(
          "Necesitas al menos 3 fotografías para publicar tu habitación.",
        );
      }

      setGuardando(true);

      // Primero guardamos los cambios y el orden de las fotografías.
      await actualizarAnuncio(
        listingId,
        obtenerDatosActualizacion(),
        session.token,
        session.user.id,
      );

      // Después publicamos, únicamente si el usuario lo solicitó.
      if (publicar) {
        await publicarAnuncio(
          listingId,
          session.token,
          session.user.id,
        );
      }

      navigate("/anuncios", {
        state: {
          mensaje: publicar
            ? "¡Tu habitación se publicó correctamente!"
            : "Los cambios de tu publicación se guardaron correctamente.",
        },
      });
    } catch (err) {
      setError(
        err.message ||
          "No se pudieron guardar las fotografías.",
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
          onClick={() => navigate("/anuncios")}
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
                      src={foto.url}
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

          {/* ACCIONES */}

          <div className="fotos-acciones-finales">
            <BotonAnuncio
              tipo="secundario"
              onClick={() =>
                navigate(`/anuncios/${listingId}/ubicacion`)
              }
              disabled={guardando}
            >
              Volver
            </BotonAnuncio>

            <BotonAnuncio
              tipo="secundario"
              onClick={() => guardarFotografias(false)}
              disabled={guardando}
            >
              {guardando ? "Guardando..." : "Guardar cambios"}
            </BotonAnuncio>

            {esBorrador && (
              <BotonAnuncio
                tipo="principal"
                onClick={() => guardarFotografias(true)}
                disabled={
                  guardando || !puedePublicar
                }
              >
                {guardando
                  ? "Publicando..."
                  : "Publicar habitación"}
              </BotonAnuncio>
            )}
          </div>

          <p className="fotos-nota">
            La primera fotografía será la imagen principal.
            Para publicar tu habitación necesitas al menos
            3 fotografías.
          </p>
        </section>
      </section>
    </main>
  );
}
