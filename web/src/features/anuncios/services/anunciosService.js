
import { apiRequest, apiAssetUrl } from '../../../services/api.js';

// ======================================================
// CONFIGURACIÓN
// ======================================================

const RUTA_ROOMS = '/api/v1/rooms';

// ======================================================
// VALIDACIONES
// ======================================================

function validarSesion(token, userId) {
  if (!token?.trim()) {
    throw new Error('No hay una sesión autenticada. Inicia sesión nuevamente.');
  }

  if (!userId?.trim()) {
    throw new Error('No se encontró el usuario de la sesión.');
  }
}

function validarFecha(valor) {
  if (!valor || !valor.trim()) return null;

  const fecha = valor.trim();
  const coincidencia = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha);

  if (!coincidencia) {
    throw new Error('La fecha debe tener formato AAAA-MM-DD.');
  }

  const anio = Number(coincidencia[1]);
  const mes = Number(coincidencia[2]);
  const dia = Number(coincidencia[3]);

  const fechaUTC = new Date(Date.UTC(anio, mes - 1, dia));

  if (
    fechaUTC.getUTCFullYear() !== anio ||
    fechaUTC.getUTCMonth() !== mes - 1 ||
    fechaUTC.getUTCDate() !== dia
  ) {
    throw new Error('La fecha seleccionada no es válida.');
  }

  return fecha;
}

// ======================================================
// TIPOS DE DATOS (DOCUMENTACIÓN)
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
  const valor = String(renta)
    .replace(/[$,\s]/g, '')
    .trim();

  const numero = Number(valor);

  if (
    !Number.isFinite(numero) ||
    numero <= 0 ||
    numero > 99999999.99 ||
    Math.round(numero * 100) !== numero * 100
  ) {
    throw new Error('La renta debe ser mayor a cero y tener máximo dos decimales.');
  }

  return String(numero);
}

function agregarDatosFormulario(formData, datos) {
  formData.append('titulo', datos.titulo.trim());

  formData.append(
    'descripcion',
    datos.descripcion?.trim() ?? ''
  );

  formData.append('renta', normalizarRenta(datos.renta));

  formData.append(
    'ubicacion',
    datos.ubicacion?.trim() ?? ''
  );

  formData.append(
    'latitude',
    datos.latitude != null ? String(datos.latitude) : ''
  );

  formData.append(
    'longitude',
    datos.longitude != null ? String(datos.longitude) : ''
  );

  const fecha = validarFecha(datos.availableFrom);

  if (fecha) {
    formData.append('availableFrom', fecha);
  }

  formData.append(
    'maxRoommates',
    datos.maxRoommates != null
      ? String(datos.maxRoommates)
      : ''
  );
}

function agregarArchivo(formData, foto) {
  if (!(foto instanceof File)) {
    throw new Error('Una de las fotografías no es un archivo válido.');
  }

  formData.append('photos', foto, foto.name);
}

function obtenerIdRespuesta(resultado) {
  const id =
    resultado?.room?.id ??
    resultado?.id ??
    resultado?.data?.room?.id ??
    resultado?.data?.id;

  if (typeof id !== 'string' || !id.trim()) {
    throw new Error('El servidor no devolvió el ID de la habitación.');
  }

  return id.trim();
}

// ======================================================
// CONSULTAR PUBLICACIONES DEL ANFITRIÓN
// GET /rooms/host/:hostId
// ======================================================

export async function obtenerMisPublicaciones(token, userId) {
  validarSesion(token, userId);

  const resultado = await apiRequest(
    `${RUTA_ROOMS}/host/${encodeURIComponent(userId)}`,
    { token }
  );

  if (!Array.isArray(resultado)) {
    throw new Error('El servidor devolvió una respuesta inesperada.');
  }

  return resultado;
}

// ======================================================
// OBTENER URL DE FOTOGRAFÍAS
// ======================================================

export function obtenerUrlPrimeraFoto(listingId) {
  return apiAssetUrl(
    `${RUTA_ROOMS}/${encodeURIComponent(listingId)}/photos/first`
  );
}

export function obtenerUrlFoto(listingId, photoId) {
  return apiAssetUrl(
    `${RUTA_ROOMS}/${encodeURIComponent(listingId)}/photos/${encodeURIComponent(photoId)}`
  );
}

// ======================================================
// CONSULTAR DETALLE
// GET /rooms/:id
// ======================================================

export async function obtenerAnuncioPorId(listingId, token) {
  if (!listingId) {
    throw new Error('El ID de la publicación es obligatorio.');
  }

  const resultado = await apiRequest(
    `${RUTA_ROOMS}/${encodeURIComponent(listingId)}`,
    { token }
  );

  const habitacion = resultado?.room ?? resultado;

  if (!habitacion?.id || !Array.isArray(habitacion.photos)) {
    throw new Error('El servidor devolvió información incompleta.');
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

  for (const foto of datos.fotos ?? []) {
    agregarArchivo(formData, foto.file);
  }

  const resultado = await apiRequest(RUTA_ROOMS, {
    method: 'POST',
    token,
    body: formData,
  });

  return { id: obtenerIdRespuesta(resultado) };
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

  const formData = new FormData();

  agregarDatosFormulario(formData, datos);

  const photosOrder = [];
  let fileIndex = 0;

  for (const foto of datos.fotos ?? []) {
    if (foto.type === 'existing') {
      photosOrder.push({
        type: 'existing',
        id: foto.id,
      });
    } else if (foto.type === 'new') {
      agregarArchivo(formData, foto.file);

      photosOrder.push({
        type: 'new',
        fileIndex,
      });

      fileIndex++;
    }
  }

  formData.append('photosOrder', JSON.stringify(photosOrder));

  return apiRequest(
    `${RUTA_ROOMS}/${encodeURIComponent(listingId)}`,
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

  try {
    return await apiRequest(
      `${RUTA_ROOMS}/${encodeURIComponent(listingId)}/${accion}`,
      {
        method: 'PATCH',
        token,
      }
    );
  } catch (error) {
    throw new Error(error.message || mensajeError);
  }
}

// ======================================================
// PUBLICAR
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
