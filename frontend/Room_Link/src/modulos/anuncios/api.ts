
import { File } from "expo-file-system";
import { fetch } from "expo/fetch";

// ======================================================
// CONFIGURACIÓN
// ======================================================

const API_URL = process.env.EXPO_PUBLIC_API_URL
  ?.trim()
  .replace(/\/+$/, "");

const USER_ID = process.env.EXPO_PUBLIC_USER_ID?.trim();

// ======================================================
// MODO DE PRUEBAS
// ======================================================

// true  = permite enviar peticiones sin token.
// false = exige autenticación normal.
//
// IMPORTANTE:
// El backend también debe tener temporalmente
// desactivado el middleware authenticate en las
// rutas privadas para que esto funcione.

const MODO_PRUEBAS_SIN_AUTH = true;

// Token de autenticación de la sesión.
let tokenActual: string | null = null;

// Llamar esta función después de iniciar sesión.
export function establecerTokenAnuncios(
  token: string | null
): void {
  tokenActual = token?.trim() || null;
}

// ======================================================
// VALIDACIONES
// ======================================================

function validarConfiguracion(): void {
  if (!API_URL) {
    throw new Error(
      "Configura EXPO_PUBLIC_API_URL en el archivo .env."
    );
  }
  if (!obtenerUserId()) {
    throw new Error("No hay una sesión activa. Iniciá sesión para continuar.");
  }
}

/** Cabeceras con Accept + el token de sesión (Bearer) cuando existe. */
function cabecerasAuth(extra?: Record<string, string>) {
  const token = obtenerToken();
  return {
    Accept: "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

function validarUsuario(): void {
  validarConfiguracion();

  if (!USER_ID) {
    throw new Error(
      "Configura EXPO_PUBLIC_USER_ID en el archivo .env."
    );
  }
}

// ======================================================
// HEADERS DE LAS PETICIONES
// ======================================================

function obtenerHeaders(
  requiereAuth = false
): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  // Permitir peticiones sin token durante las pruebas.
  if (requiereAuth && MODO_PRUEBAS_SIN_AUTH) {
    return headers;
  }

  // En modo normal exigir autenticación.
  if (requiereAuth) {
    if (!tokenActual) {
      throw new Error(
        "No hay una sesión autenticada. Inicia sesión nuevamente."
      );
    }

    headers.Authorization = `Bearer ${tokenActual}`;
  }

  return headers;
}

// ======================================================
// RESPUESTAS DEL SERVIDOR
// ======================================================

async function obtenerResultado(
  respuesta: Response
): Promise<any> {
  return respuesta.json().catch(() => null);
}

// ======================================================
// TIPOS
// ======================================================

// Fotografía seleccionada desde el dispositivo.
export type FotoAnuncio = {
  id: string;
  uri: string;
  fileName: string;
  mimeType: string;
};

// Estados posibles de una publicación.
export type EstadoAnuncio =
  | "draft"
  | "published"
  | "paused"
  | "closed";

// Datos necesarios para registrar una habitación.
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

// Respuesta del servidor al crear una habitación.
export type RespuestaHabitacion = {
  id: string;
};

// Información resumida de una publicación.
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

// Ubicación de una habitación obtenida del servidor.
export type UbicacionAnuncio = {
  address: string;
  latitude: number;
  longitude: number;
};

// Fotografía guardada en la base de datos.
export type FotoExistente = {
  id: string;
  fileName: string;
  mimeType: string;
  position: number;
};

// Fotografía que se conserva o agrega al editar.
export type FotoEdicion =
  | {
      type: "existing";
      id: string;
    }
  | {
      type: "new";
      foto: FotoAnuncio;
    };

// Información completa de una habitación.
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

// Datos que se enviarán al editar una habitación.
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
  formData.append("titulo", datos.titulo);
  formData.append("descripcion", datos.descripcion ?? "");
  formData.append("renta", datos.renta);

  formData.append(
    "ubicacion",
    datos.ubicacion ?? ""
  );

  formData.append(
    "latitude",
    datos.latitude != null
      ? String(datos.latitude)
      : ""
  );

  formData.append(
    "longitude",
    datos.longitude != null
      ? String(datos.longitude)
      : ""
  );

  formData.append(
    "availableFrom",
    datos.availableFrom ?? ""
  );

  formData.append(
    "maxRoommates",
    datos.maxRoommates != null
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

// Obtener un mensaje de error de una respuesta.
function obtenerMensajeError(
  resultado: any,
  mensajePredeterminado: string
): string {
  return (
    resultado?.error ??
    resultado?.message ??
    mensajePredeterminado
  );
}

// ======================================================
// CONSULTAR PUBLICACIONES DEL ANFITRIÓN
// GET /rooms/host/:hostId
// ======================================================

export async function obtenerMisPublicaciones():
  Promise<PublicacionBD[]> {
  validarUsuario();

  const respuesta = await fetch(
    `${API_URL}/api/v1/rooms/host/${encodeURIComponent(obtenerUserId()!)}`,
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
        "No se pudieron consultar tus publicaciones."
      )
    );
  }

  if (!Array.isArray(resultado)) {
    throw new Error(
      "El servidor devolvió una respuesta inesperada."
    );
  }

  return resultado as PublicacionBD[];
}

// ======================================================
// OBTENER URL DE FOTOGRAFÍAS
// ======================================================

// Obtener la URL de la primera fotografía.
export function obtenerUrlPrimeraFoto(
  listingId: string
): string {
  validarConfiguracion();

  return `${API_URL}/api/v1/rooms/${encodeURIComponent(listingId)}/photos/first`;
}

// Obtener la URL de una fotografía específica.
export function obtenerUrlFoto(
  listingId: string,
  photoId: string
): string {
  validarConfiguracion();

  return `${API_URL}/api/v1/rooms/${encodeURIComponent(listingId)}/photos/${encodeURIComponent(photoId)}`;
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
    `${API_URL}/api/v1/rooms/${encodeURIComponent(listingId)}`,
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

  if (
    !resultado?.id ||
    !Array.isArray(resultado.photos)
  ) {
    throw new Error(
      "El servidor devolvió información incompleta."
    );
  }

  return resultado as AnuncioDetalleBD;
}

// ======================================================
// CREAR UNA HABITACIÓN COMO BORRADOR
// POST /rooms
// ======================================================

export async function crearAnuncio(
  datos: DatosAnuncio
): Promise<RespuestaHabitacion> {
  validarUsuario();

  const formData = new FormData();

  formData.append("hostId", USER_ID!);

  agregarDatosFormulario(formData, datos);

  // Agregar fotografías solamente si existen.
  for (const foto of datos.fotos ?? []) {
    agregarArchivo(formData, foto);
  }

  const respuesta = await fetch(
    `${API_URL}/rooms`,
    {
      method: "POST",
      body: formData,
      headers: obtenerHeaders(true),
    }
  );

  const resultado = await obtenerResultado(respuesta);

  if (!respuesta.ok) {
    throw new Error(
      obtenerMensajeError(
        resultado,
        "No se pudo registrar la habitación."
      )
    );
  }

  if (!resultado?.id) {
    throw new Error(
      "El servidor no devolvió el ID de la habitación."
    );
  }

  return resultado as RespuestaHabitacion;
}

// ======================================================
// ACTUALIZAR UNA HABITACIÓN EXISTENTE
// PATCH /rooms/:id
// ======================================================

export async function actualizarAnuncio(
  listingId: string,
  datos: DatosEdicionAnuncio
): Promise<void> {
  validarConfiguracion();

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

  // Recorrer las fotografías en el orden elegido.
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

  // Incluso si no hay fotografías, enviamos [].
  formData.append(
    "photosOrder",
    JSON.stringify(photosOrder)
  );

  const respuesta = await fetch(
    `${API_URL}/api/v1/rooms/${encodeURIComponent(listingId)}`,
    {
      method: "PATCH",
      body: formData,
      headers: obtenerHeaders(true),
    }
  );

  const resultado = await obtenerResultado(respuesta);

  if (!respuesta.ok) {
    throw new Error(
      obtenerMensajeError(
        resultado,
        "No se pudo actualizar la habitación."
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
  validarConfiguracion();

  const respuesta = await fetch(
    `${API_URL}/rooms/${encodeURIComponent(habitacionId)}/${accion}`,
    {
      method: "PATCH",
      headers: obtenerHeaders(true),
    }
  );

  const resultado = await obtenerResultado(respuesta);

  if (!respuesta.ok) {
    throw new Error(
      obtenerMensajeError(resultado, mensajeError)
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
