
import { File } from "expo-file-system";
import { fetch } from "expo/fetch";

import {
  obtenerToken,
  obtenerUserId,
} from "@/auth/sesion";
import { mensajeTextoRestringido, tieneTextoRestringido } from "@/modulos/comunes/validacionCampos";

// ======================================================
// CONFIGURACIÓN
// ======================================================

const API_URL = process.env.EXPO_PUBLIC_API_URL
  ?.trim()
  .replace(/\/+$/, "");

const PREFIJO_API = "/api/v1";

const URL_BASE = API_URL
  ? `${API_URL}${PREFIJO_API}`
  : "";

const RUTA_ROOMS = "/rooms";

// ======================================================
// VALIDACIONES
// ======================================================

function validarConfiguracion(): void {
  if (!API_URL) {
    throw new Error(
      "Configura EXPO_PUBLIC_API_URL en el archivo .env."
    );
  }
}

function validarUsuario(): string {
  validarConfiguracion();

  const userId = obtenerUserId();

  if (!userId?.trim()) {
    throw new Error(
      "No hay una sesión activa. Inicia sesión para continuar."
    );
  }

  return userId;
}

function validarToken(): string {
  const token = obtenerToken();

  if (!token?.trim()) {
    throw new Error(
      "No hay una sesión autenticada. Inicia sesión nuevamente."
    );
  }

  return token;
}

// ======================================================
// VALIDAR FECHAS
// ======================================================

function validarFecha(
  valor: string | null
): string | null {

  if (!valor || !valor.trim()) {
    return null;
  }

  const fecha = valor.trim();

  const coincidencia =
    /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha);

  if (!coincidencia) {
    throw new Error(
      "La fecha debe tener formato AAAA-MM-DD."
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
      "La fecha seleccionada no es válida."
    );
  }

  return fecha;
}
// ======================================================
// RUTAS
// ======================================================

function obtenerRutaRooms(ruta = ""): string {
  validarConfiguracion();

  return `${URL_BASE}${RUTA_ROOMS}${ruta}`;
}

// ======================================================
// HEADERS
// ======================================================

function obtenerHeaders(
  requiereAuth = false
): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  const token = requiereAuth
    ? validarToken()
    : obtenerToken();

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

// ======================================================
// RESPUESTAS DEL SERVIDOR
// ======================================================

async function obtenerResultado(
  respuesta: Response
): Promise<any> {
  const texto = await respuesta.text();

  if (!texto.trim()) {
    return null;
  }

  try {
    return JSON.parse(texto);
  } catch {
    return {
      message: texto,
    };
  }
}

function obtenerMensajeError(
  resultado: any,
  mensajePredeterminado: string
): string {
  if (typeof resultado === "string") {
    return resultado;
  }

  return (
    resultado?.error ??
    resultado?.message ??
    resultado?.details ??
    resultado?.data?.message ??
    mensajePredeterminado
  );
}

// ======================================================
// TIPOS
// ======================================================

export type FotoAnuncio = {
  id: string;
  uri: string;
  fileName: string;
  mimeType: string;
};

export type EstadoAnuncio =
  | "draft"
  | "published"
  | "paused"
  | "closed";

export type DatosAnuncio = {
  titulo: string;
  descripcion: string;
  renta: string;

  ubicacion: string | null;
  latitude: number | null;
  longitude: number | null;

  availableFrom: string | null;
  maxRoommates: number | null;

  fotos: FotoAnuncio[];
};

export type RespuestaHabitacion = {
  id: string;
};

export type PublicacionBD = {
  id: string;
  hostId: string;
  title: string;
  monthlyRent: number;
  status: EstadoAnuncio;
  photosCount: number;
  availableFrom: string | null;
  createdAt: string;
};

export type UbicacionAnuncio = {
  address: string;
  latitude: number;
  longitude: number;
};

export type FotoExistente = {
  id: string;
  fileName: string;
  mimeType: string;
  position: number;
};

export type FotoEdicion =
  | {
      type: "existing";
      id: string;
    }
  | {
      type: "new";
      foto: FotoAnuncio;
    };

export type AnuncioDetalleBD = {
  id: string;
  hostId: string;
  title: string;
  description: string | null;
  monthlyRent: number;
  status: EstadoAnuncio;
  photosCount: number;
  availableFrom: string | null;
  createdAt: string;
  locationId: string | null;
  maxRoommates: number | null;
  location: UbicacionAnuncio | null;
  photos: FotoExistente[];
};

export type DatosEdicionAnuncio = Omit<
  DatosAnuncio,
  "fotos"
> & {
  fotos: FotoEdicion[];
};

// ======================================================
// FUNCIONES AUXILIARES
// ======================================================

// Agregar los datos generales del formulario.
function agregarDatosFormulario(
  formData: FormData,
  datos: Omit<DatosAnuncio, "fotos">
): void {
  if ([datos.titulo, datos.descripcion, datos.ubicacion].some(
    (valor) => valor != null && tieneTextoRestringido(valor),
  )) {
    throw new Error(mensajeTextoRestringido);
  }

  // TÍTULO
  formData.append("titulo", datos.titulo.trim());

  // DESCRIPCIÓN
  formData.append(
    "descripcion",
    datos.descripcion?.trim() ?? ""
  );

  // RENTA
  // Convertimos "$3,500" o "3,500" a "3500".
  const rentaNormalizada = datos.renta
    .replace(/[$,\s]/g, "")
    .trim();

  const rentaNumerica = Number(rentaNormalizada);

  if (
    !Number.isFinite(rentaNumerica) ||
    rentaNumerica <= 0
  ) {
    throw new Error("La renta mensual no es válida.");
  }

  formData.append("renta", String(rentaNumerica));

  // UBICACIÓN
  formData.append(
    "ubicacion",
    datos.ubicacion?.trim() ?? ""
  );

  // LATITUD
  formData.append(
    "latitude",
    datos.latitude !== null
      ? String(datos.latitude)
      : ""
  );

  // LONGITUD
  formData.append(
    "longitude",
    datos.longitude !== null
      ? String(datos.longitude)
      : ""
  );

  // FECHA DE DISPONIBILIDAD
  const fecha = validarFecha(datos.availableFrom);

  if (fecha) {
    formData.append("availableFrom", fecha);
  }

  // MÁXIMO DE COMPAÑEROS
  formData.append(
    "maxRoommates",
    datos.maxRoommates !== null
      ? String(datos.maxRoommates)
      : ""
  );
}

// Agregar una fotografía al FormData.
function agregarArchivo(
  formData: FormData,
  foto: FotoAnuncio
): void {
  const archivo = new File(foto.uri);

  formData.append(
    "photos",
    archivo,
    foto.fileName
  );
}

// ======================================================
// CONSULTAR PUBLICACIONES DEL ANFITRIÓN
// GET /rooms/host/:hostId
// ======================================================

export async function obtenerMisPublicaciones():
  Promise<PublicacionBD[]> {
  const userId = validarUsuario();

  const respuesta = await fetch(
    obtenerRutaRooms(
      `/host/${encodeURIComponent(userId)}`
    ),
    {
      method: "GET",
      headers: obtenerHeaders(true),
    }
  );

  const resultado = await obtenerResultado(respuesta);

  if (!respuesta.ok) {
    throw new Error(
      obtenerMensajeError(
        resultado,
        "No se pudieron consultar tus publicaciones."
      )
    );
  }

  if (!Array.isArray(resultado)) {
    throw new Error(
      "El servidor devolvió una respuesta inesperada al consultar las publicaciones."
    );
  }

  return resultado as PublicacionBD[];
}

// ======================================================
// OBTENER URL DE FOTOGRAFÍAS
// ======================================================

export function obtenerUrlPrimeraFoto(
  listingId: string
): string {
  return obtenerRutaRooms(
    `/${encodeURIComponent(listingId)}/photos/first`
  );
}

export function obtenerUrlFoto(
  listingId: string,
  photoId: string
): string {
  return obtenerRutaRooms(
    `/${encodeURIComponent(listingId)}/photos/${encodeURIComponent(photoId)}`
  );
}

// ======================================================
// CONSULTAR DETALLE DE UNA HABITACIÓN
// GET /rooms/:id
// ======================================================

export async function obtenerAnuncioPorId(
  listingId: string
): Promise<AnuncioDetalleBD> {
  validarConfiguracion();

  const respuesta = await fetch(
    obtenerRutaRooms(
      `/${encodeURIComponent(listingId)}`
    ),
    {
      method: "GET",
      headers: obtenerHeaders(),
    }
  );

  const resultado = await obtenerResultado(respuesta);

  if (!respuesta.ok) {
    throw new Error(
      obtenerMensajeError(
        resultado,
        "No se pudo consultar la habitación."
      )
    );
  }

  const habitacion = resultado?.room ?? resultado;

  if (
    !habitacion?.id ||
    !Array.isArray(habitacion.photos)
  ) {
    throw new Error(
      "El servidor devolvió información incompleta de la habitación."
    );
  }

  return habitacion as AnuncioDetalleBD;
}

// ======================================================
// CREAR UNA HABITACIÓN COMO BORRADOR
// POST /rooms
// ======================================================

export async function crearAnuncio(
  datos: DatosAnuncio
): Promise<RespuestaHabitacion> {

  // Comprobar que exista una sesión.
  validarUsuario();

  const token = validarToken();

  const formData = new FormData();

  // Agregar información general.
  agregarDatosFormulario(formData, datos);

  // Agregar fotografías si existen.
  for (const foto of datos.fotos ?? []) {
    agregarArchivo(formData, foto);
  }

  const respuesta = await fetch(
    obtenerRutaRooms(),
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    }
  );

  const resultado = await obtenerResultado(respuesta);

  if (!respuesta.ok) {
    console.error(
      "ERROR AL CREAR HABITACIÓN:",
      resultado
    );

    throw new Error(
      obtenerMensajeError(
        resultado,
        "No se pudo registrar la habitación."
      )
    );
  }

  const id =
    resultado?.room?.id ??
    resultado?.id ??
    resultado?.data?.room?.id ??
    resultado?.data?.id;

  if (typeof id !== "string" || !id.trim()) {
    console.error(
      "RESPUESTA DEL SERVIDOR:",
      resultado
    );

    throw new Error(
      "El servidor no devolvió el ID de la habitación."
    );
  }

  return {
    id: id.trim(),
  };
}

// ======================================================
// ACTUALIZAR UNA HABITACIÓN EXISTENTE
// PATCH /rooms/:id
// ======================================================

export async function actualizarAnuncio(
  listingId: string,
  datos: DatosEdicionAnuncio
): Promise<void> {

  validarUsuario();

  const token = validarToken();

  const formData = new FormData();

  agregarDatosFormulario(formData, datos);

  type OrdenFotografia =
    | {
        type: "existing";
        id: string;
      }
    | {
        type: "new";
        fileIndex: number;
      };

  const photosOrder: OrdenFotografia[] = [];

  let fileIndex = 0;

  for (const foto of datos.fotos ?? []) {

    if (foto.type === "existing") {

      photosOrder.push({
        type: "existing",
        id: foto.id,
      });

    } else {

      agregarArchivo(formData, foto.foto);

      photosOrder.push({
        type: "new",
        fileIndex,
      });

      fileIndex++;
    }
  }

  formData.append(
    "photosOrder",
    JSON.stringify(photosOrder)
  );

  const respuesta = await fetch(
    obtenerRutaRooms(
      `/${encodeURIComponent(listingId)}`
    ),
    {
      method: "PATCH",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    }
  );

  const resultado = await obtenerResultado(respuesta);

  if (!respuesta.ok) {
    console.error(
      "ERROR AL ACTUALIZAR PUBLICACIÓN:",
      resultado
    );

    throw new Error(
      obtenerMensajeError(
        resultado,
        "No se pudieron guardar los cambios."
      )
    );
  }
}
// ======================================================
// CAMBIAR ESTADO DE UNA PUBLICACIÓN
// ======================================================

async function cambiarEstadoAnuncio(
  habitacionId: string,
  accion: "publish" | "pause" | "reactivate" | "close",
  mensajeError: string
): Promise<void> {
  validarUsuario();

  const respuesta = await fetch(
    obtenerRutaRooms(
      `/${encodeURIComponent(habitacionId)}/${accion}`
    ),
    {
      method: "PATCH",
      headers: obtenerHeaders(true),
    }
  );

  const resultado = await obtenerResultado(respuesta);

  if (!respuesta.ok) {
    throw new Error(
      obtenerMensajeError(
        resultado,
        mensajeError
      )
    );
  }
}

// ======================================================
// PUBLICAR UN BORRADOR
// PATCH /rooms/:id/publish
// ======================================================

export async function publicarAnuncio(
  habitacionId: string
): Promise<void> {
  return cambiarEstadoAnuncio(
    habitacionId,
    "publish",
    "La habitación se guardó, pero no se pudo publicar."
  );
}

// ======================================================
// PAUSAR UNA PUBLICACIÓN
// PATCH /rooms/:id/pause
// ======================================================

export async function pausarAnuncio(
  habitacionId: string
): Promise<void> {
  return cambiarEstadoAnuncio(
    habitacionId,
    "pause",
    "No se pudo pausar la publicación."
  );
}

// ======================================================
// REACTIVAR UNA PUBLICACIÓN
// PATCH /rooms/:id/reactivate
// ======================================================

export async function reactivarAnuncio(
  habitacionId: string
): Promise<void> {
  return cambiarEstadoAnuncio(
    habitacionId,
    "reactivate",
    "No se pudo reactivar la publicación."
  );
}

// ======================================================
// CERRAR UNA PUBLICACIÓN
// PATCH /rooms/:id/close
// ======================================================

export async function cerrarAnuncio(
  habitacionId: string
): Promise<void> {
  return cambiarEstadoAnuncio(
    habitacionId,
    "close",
    "No se pudo cerrar la publicación."
  );
}
