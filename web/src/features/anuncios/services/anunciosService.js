
import { apiRequest, apiAssetUrl } from '../../../services/api.js';

// ======================================================
// CONFIGURACIÓN
// ======================================================

const RUTA_ROOMS = '/api/v1/rooms';

const ACCIONES_ESTADO = [
  'publish',
  'pause',
  'reactivate',
  'close',
];

const TIPOS_FOTO_PERMITIDOS = [
  'image/jpeg',
  'image/png',
  'image/webp',
];

const MAX_FOTOS = 10;
const MAX_PESO_FOTO = 8 * 1024 * 1024;

// ======================================================
// VALIDACIONES
// ======================================================

function validarSesion(token, userId) {
  if (typeof token !== 'string' || !token.trim()) {
    throw new Error(
      'No hay una sesión autenticada. Inicia sesión nuevamente.'
    );
  }

  if (
    userId === null ||
    userId === undefined ||
    !String(userId).trim()
  ) {
    throw new Error(
      'No se encontró el usuario de la sesión.'
    );
  }
}

function validarIdAnuncio(listingId) {
  if (
    listingId === null ||
    listingId === undefined ||
    !String(listingId).trim()
  ) {
    throw new Error(
      'El ID de la publicación es obligatorio.'
    );
  }

  return String(listingId).trim();
}

function validarFecha(valor) {
  if (valor == null || valor === '') {
    return null;
  }

  const fecha = String(valor).trim();

  const coincidencia = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha);

  if (!coincidencia) {
    throw new Error(
      'La fecha debe tener formato AAAA-MM-DD.'
    );
  }

  const anio = Number(coincidencia[1]);
  const mes = Number(coincidencia[2]);
  const dia = Number(coincidencia[3]);

  const fechaUTC = new Date(
    Date.UTC(anio, mes - 1, dia)
  );

  if (
    fechaUTC.getUTCFullYear() !== anio ||
    fechaUTC.getUTCMonth() !== mes - 1 ||
    fechaUTC.getUTCDate() !== dia
  ) {
    throw new Error(
      'La fecha seleccionada no es válida.'
    );
  }

  return fecha;
}

// ======================================================
// ESTADOS DE PUBLICACIÓN
// ======================================================

export const ESTADOS_ANUNCIO = {
  BORRADOR: 'draft',
  PUBLICADO: 'published',
  PAUSADO: 'paused',
  CERRADO: 'closed',
};

// ======================================================
// FUNCIONES AUXILIARES
// ======================================================

function normalizarRenta(renta) {
  const valor = String(renta ?? '')
    .replace(/[$,\s]/g, '')
    .trim();

  if (!/^\d+(\.\d{1,2})?$/.test(valor)) {
    throw new Error(
      'La renta debe tener un formato válido y máximo dos decimales.'
    );
  }

  const numero = Number(valor);

  if (
    !Number.isFinite(numero) ||
    numero <= 0 ||
    numero > 99999999.99
  ) {
    throw new Error(
      'La renta debe ser mayor a cero y no superar 99,999,999.99.'
    );
  }

  return String(numero);
}

function tienePropiedad(objeto, propiedad) {
  return Object.prototype.hasOwnProperty.call(
    objeto,
    propiedad
  );
}

// ======================================================
// AGREGAR DATOS DEL FORMULARIO
// ======================================================

function agregarDatosFormulario(formData, datos, opciones = {}) {
  if (!datos || typeof datos !== 'object') {
    throw new Error(
      'No se proporcionaron los datos de la publicación.'
    );
  }

  if (
    typeof datos.titulo !== 'string' ||
    !datos.titulo.trim()
  ) {
    throw new Error(
      'El título de la publicación es obligatorio.'
    );
  }

  formData.append('titulo', datos.titulo.trim());

  formData.append(
    'descripcion',
    String(datos.descripcion ?? '').trim()
  );

  formData.append(
    'renta',
    normalizarRenta(datos.renta)
  );

  // Ubicación:
  // En creación siempre se envía.
  // En actualización se envía cuando viene incluida
  // en los datos del formulario.

  const tieneDatosUbicacion =
    tienePropiedad(datos, 'ubicacion') ||
    tienePropiedad(datos, 'latitude') ||
    tienePropiedad(datos, 'longitude');

  if (!opciones.esActualizacion || tieneDatosUbicacion) {
    formData.append(
      'ubicacion',
      String(datos.ubicacion ?? '').trim()
    );

    formData.append(
      'latitude',
      datos.latitude != null
        ? String(datos.latitude)
        : ''
    );

    formData.append(
      'longitude',
      datos.longitude != null
        ? String(datos.longitude)
        : ''
    );
  }

  // Fecha disponible.
  // Si viene vacía, se envía vacía para permitir limpiarla.

  if (tienePropiedad(datos, 'availableFrom')) {
    const fecha = validarFecha(datos.availableFrom);

    formData.append(
      'availableFrom',
      fecha ?? ''
    );
  }

  // Número máximo de compañeros.

  if (tienePropiedad(datos, 'maxRoommates')) {
    formData.append(
      'maxRoommates',
      datos.maxRoommates != null
        ? String(datos.maxRoommates)
        : ''
    );
  }
}

// ======================================================
// VALIDAR Y AGREGAR ARCHIVOS
// ======================================================

function validarArchivo(foto) {
  if (
    typeof File === 'undefined' ||
    !(foto instanceof File)
  ) {
    throw new Error(
      'Una de las fotografías no es un archivo válido.'
    );
  }

  if (!TIPOS_FOTO_PERMITIDOS.includes(foto.type)) {
    throw new Error(
      'Las fotografías deben ser JPG, PNG o WEBP.'
    );
  }

  if (foto.size > MAX_PESO_FOTO) {
    throw new Error(
      'Cada fotografía debe pesar máximo 8 MB.'
    );
  }
}

function agregarArchivo(formData, foto) {
  validarArchivo(foto);

  formData.append(
    'photos',
    foto,
    foto.name
  );
}

// ======================================================
// OBTENER ID DE RESPUESTA
// ======================================================

function obtenerIdRespuesta(resultado) {
  const id =
    resultado?.room?.id ??
    resultado?.id ??
    resultado?.data?.room?.id ??
    resultado?.data?.id;

  if (
    id === null ||
    id === undefined ||
    !String(id).trim()
  ) {
    throw new Error(
      'El servidor no devolvió el ID de la habitación.'
    );
  }

  return String(id).trim();
}

// ======================================================
// CONSULTAR PUBLICACIONES DEL ANFITRIÓN
// GET /rooms/host/:hostId
// ======================================================

export async function obtenerMisPublicaciones(token, userId) {
  validarSesion(token, userId);

  const resultado = await apiRequest(
    `${RUTA_ROOMS}/host/${encodeURIComponent(String(userId))}`,
    { token }
  );

  if (!Array.isArray(resultado)) {
    throw new Error(
      'El servidor devolvió una respuesta inesperada al consultar tus publicaciones.'
    );
  }

  return resultado;
}

// ======================================================
// OBTENER URL DE FOTOGRAFÍAS
// ======================================================

export function obtenerUrlPrimeraFoto(listingId) {
  const id = validarIdAnuncio(listingId);

  return apiAssetUrl(
    `${RUTA_ROOMS}/${encodeURIComponent(id)}/photos/first`
  );
}

export function obtenerUrlFoto(listingId, photoId) {
  const id = validarIdAnuncio(listingId);

  if (
    photoId === null ||
    photoId === undefined ||
    !String(photoId).trim()
  ) {
    throw new Error(
      'El ID de la fotografía es obligatorio.'
    );
  }

  return apiAssetUrl(
    `${RUTA_ROOMS}/${encodeURIComponent(id)}/photos/${encodeURIComponent(String(photoId))}`
  );
}

// ======================================================
// CONSULTAR DETALLE
// GET /rooms/:id
// ======================================================

export async function obtenerAnuncioPorId(listingId, token) {
  const id = validarIdAnuncio(listingId);

  if (!token) {
    throw new Error(
      'No hay una sesión autenticada.'
    );
  }

  const resultado = await apiRequest(
    `${RUTA_ROOMS}/${encodeURIComponent(id)}`,
    { token }
  );

  const habitacion =
    resultado?.room ??
    resultado?.data?.room ??
    resultado?.data ??
    resultado;

  if (!habitacion?.id) {
    throw new Error(
      'El servidor no devolvió la información de la publicación.'
    );
  }

  return habitacion;
}

// ======================================================
// CREAR BORRADOR
// POST /rooms
// ======================================================

export async function crearAnuncio(datos, token, userId) {
  validarSesion(token, userId);

  const formData = new FormData();

  agregarDatosFormulario(formData, datos);

  const fotos = datos.fotos ?? [];

  if (!Array.isArray(fotos)) {
    throw new Error(
      'El formato de las fotografías no es válido.'
    );
  }

  if (fotos.length > MAX_FOTOS) {
    throw new Error(
      'Una publicación puede tener máximo 10 fotografías.'
    );
  }

  for (const foto of fotos) {
    agregarArchivo(
      formData,
      foto.file ?? foto
    );
  }

  const resultado = await apiRequest(
    RUTA_ROOMS,
    {
      method: 'POST',
      token,
      body: formData,
    }
  );

  return {
    id: obtenerIdRespuesta(resultado),
  };
}

// ======================================================
// CONSTRUIR ORDEN DE FOTOGRAFÍAS
// ======================================================

function agregarFotografiasActualizacion(formData, fotos) {
  if (!Array.isArray(fotos)) {
    throw new Error(
      'El formato de las fotografías no es válido.'
    );
  }

  if (fotos.length > MAX_FOTOS) {
    throw new Error(
      'Una publicación puede tener máximo 10 fotografías.'
    );
  }

  const photosOrder = [];
  const idsExistentes = new Set();

  let fileIndex = 0;

  for (const foto of fotos) {
    if (foto.type === 'existing') {
      if (
        foto.id === null ||
        foto.id === undefined ||
        !String(foto.id).trim()
      ) {
        throw new Error(
          'Una fotografía existente no tiene un ID válido.'
        );
      }

      const id = String(foto.id);

      if (idsExistentes.has(id)) {
        throw new Error(
          'No se puede agregar dos veces la misma fotografía existente.'
        );
      }

      idsExistentes.add(id);

      photosOrder.push({
        type: 'existing',
        id: foto.id,
      });

      continue;
    }

    if (foto.type === 'new') {
      validarArchivo(foto.file);

      agregarArchivo(
        formData,
        foto.file
      );

      photosOrder.push({
        type: 'new',
        fileIndex,
      });

      fileIndex++;

      continue;
    }

    throw new Error(
      'Se encontró una fotografía con un formato desconocido.'
    );
  }

  formData.append(
    'photosOrder',
    JSON.stringify(photosOrder)
  );
}

// ======================================================
// ACTUALIZAR PUBLICACIÓN
// PATCH /rooms/:id
// ======================================================

export async function actualizarAnuncio(
  listingId,
  datos,
  token,
  userId
) {
  validarSesion(token, userId);

  const id = validarIdAnuncio(listingId);

  if (!datos || typeof datos !== 'object') {
    throw new Error(
      'No se proporcionaron los datos para actualizar la publicación.'
    );
  }

  const formData = new FormData();

  agregarDatosFormulario(
    formData,
    datos,
    {
      esActualizacion: true,
    }
  );

  // Solo se envía photosOrder cuando el formulario
  // incluye explícitamente una lista de fotografías.
  //
  // Una lista vacía significa que se desea eliminar
  // todas las fotografías existentes.

  if (tienePropiedad(datos, 'fotos')) {
    agregarFotografiasActualizacion(
      formData,
      datos.fotos
    );
  }

  return apiRequest(
    `${RUTA_ROOMS}/${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      token,
      body: formData,
    }
  );
}

// ======================================================
// CAMBIAR ESTADO DE PUBLICACIÓN
// ======================================================

async function cambiarEstadoAnuncio(
  listingId,
  accion,
  mensajeError,
  token,
  userId
) {
  validarSesion(token, userId);

  const id = validarIdAnuncio(listingId);

  if (!ACCIONES_ESTADO.includes(accion)) {
    throw new Error(
      'La acción solicitada no es válida.'
    );
  }

  try {
    return await apiRequest(
      `${RUTA_ROOMS}/${encodeURIComponent(id)}/${accion}`,
      {
        method: 'PATCH',
        token,
      }
    );
  } catch (error) {
    throw new Error(
      error.message || mensajeError
    );
  }
}

// ======================================================
// PUBLICAR
// PATCH /rooms/:id/publish
// ======================================================

export function publicarAnuncio(listingId, token, userId) {
  return cambiarEstadoAnuncio(
    listingId,
    'publish',
    'No se pudo publicar la habitación.',
    token,
    userId
  );
}

// ======================================================
// PAUSAR
// PATCH /rooms/:id/pause
// ======================================================

export function pausarAnuncio(listingId, token, userId) {
  return cambiarEstadoAnuncio(
    listingId,
    'pause',
    'No se pudo pausar la publicación.',
    token,
    userId
  );
}

// ======================================================
// REACTIVAR
// PATCH /rooms/:id/reactivate
// ======================================================

export function reactivarAnuncio(listingId, token, userId) {
  return cambiarEstadoAnuncio(
    listingId,
    'reactivate',
    'No se pudo reactivar la publicación.',
    token,
    userId
  );
}

// ======================================================
// CERRAR
// PATCH /rooms/:id/close
// ======================================================

export function cerrarAnuncio(listingId, token, userId) {
  return cambiarEstadoAnuncio(
    listingId,
    'close',
    'No se pudo cerrar la publicación.',
    token,
    userId
  );
}
