
import { File } from "expo-file-system";
import { fetch } from "expo/fetch";

const API_URL = process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/+$/, "");
const USER_ID = process.env.EXPO_PUBLIC_USER_ID?.trim();

function validarConfiguracion() {
  if (!API_URL || !USER_ID) {
    throw new Error(
      "Configura EXPO_PUBLIC_API_URL y EXPO_PUBLIC_USER_ID en el archivo .env."
    );
  }
}

// Fotografía seleccionada desde el dispositivo.
export type FotoAnuncio = {
  id: string;
  uri: string;
  fileName: string;
  mimeType: string;
};

// Datos necesarios para registrar una habitación.
export type DatosAnuncio = {
  titulo: string;
  descripcion: string;
  renta: string;
  ubicacion: string;
  latitude: number;
  longitude: number;
  availableFrom: string;
  maxRoommates: number;
  fotos: FotoAnuncio[];
};

// Respuesta del servidor al crear una habitación.
type RespuestaHabitacion = {
  id: string;
};

// Información de una publicación obtenida de MySQL.
export type PublicacionBD = {
  id: string;
  hostId: string;
  title: string;
  monthlyRent: number;
  status: "draft" | "published" | "paused" | "closed";
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

// Fotografía que ya está guardada en la base de datos.
export type FotoExistente = {
  id: string;
  fileName: string;
  mimeType: string;
  position: number;
};

// Fotografía que se conserva o se agrega al editar.
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
  status: "draft" | "published" | "paused" | "closed";
  photosCount: number;
  availableFrom: string | null;
  createdAt: string;
  locationId: string | null;
  maxRoommates: number | null;
  location: UbicacionAnuncio | null;
  photos: FotoExistente[];
};

// Datos que se enviarán al editar una habitación.
export type DatosEdicionAnuncio = Omit<DatosAnuncio, "fotos"> & {
  fotos: FotoEdicion[];
};

// Obtener las publicaciones del anfitrión.
export async function obtenerMisPublicaciones(): Promise<PublicacionBD[]> {
  validarConfiguracion();

  const respuesta = await fetch(
    `${API_URL}/rooms/host/${encodeURIComponent(USER_ID!)}`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    }
  );

  const resultado = await respuesta.json().catch(() => null);

  if (!respuesta.ok) {
    throw new Error(
      resultado?.error ?? "No se pudieron consultar tus publicaciones."
    );
  }

  if (!Array.isArray(resultado)) {
    throw new Error("El servidor devolvió una respuesta inesperada.");
  }

  return resultado as PublicacionBD[];
}

// Obtener la URL de la primera fotografía de una habitación.
export function obtenerUrlPrimeraFoto(listingId: string): string {
  validarConfiguracion();

  return `${API_URL}/rooms/${encodeURIComponent(listingId)}/photos/first`;
}

// Obtener la URL de una fotografía específica.
export function obtenerUrlFoto(
  listingId: string,
  photoId: string
): string {
  validarConfiguracion();

  return `${API_URL}/rooms/${encodeURIComponent(listingId)}/photos/${encodeURIComponent(photoId)}`;
}

// Obtener los datos completos de una habitación para editarla.
export async function obtenerAnuncioPorId(
  listingId: string
): Promise<AnuncioDetalleBD> {
  validarConfiguracion();

  const respuesta = await fetch(
    `${API_URL}/rooms/${encodeURIComponent(listingId)}`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    }
  );

  const resultado = await respuesta.json().catch(() => null);

  if (!respuesta.ok) {
    throw new Error(
      resultado?.error ?? "No se pudo consultar la habitación."
    );
  }

  if (!resultado?.id || !Array.isArray(resultado.photos)) {
    throw new Error("El servidor devolvió información incompleta.");
  }

  return resultado as AnuncioDetalleBD;
}

// Crear una habitación y guardar sus fotografías.
export async function crearAnuncio(
  datos: DatosAnuncio
): Promise<RespuestaHabitacion> {
  validarConfiguracion();

  const formData = new FormData();

  formData.append("hostId", USER_ID!);
  formData.append("titulo", datos.titulo);
  formData.append("descripcion", datos.descripcion);
  formData.append("renta", datos.renta);
  formData.append("ubicacion", datos.ubicacion);
  formData.append("latitude", String(datos.latitude));
  formData.append("longitude", String(datos.longitude));

  // Nuevos datos de la habitación.
  formData.append("availableFrom", datos.availableFrom);
  formData.append("maxRoommates", String(datos.maxRoommates));

  // Agregar fotografías.
  for (const foto of datos.fotos) {
    const archivo = new File(foto.uri);
    formData.append("photos", archivo);
  }

  const respuesta = await fetch(`${API_URL}/rooms`, {
    method: "POST",
    body: formData,
    headers: {
      Accept: "application/json",
    },
  });

  const resultado = await respuesta.json().catch(() => null);

  if (!respuesta.ok) {
    throw new Error(
      resultado?.error ?? "No se pudo registrar la habitación."
    );
  }

  if (!resultado?.id) {
    throw new Error("El servidor no devolvió el ID de la habitación.");
  }

  return resultado as RespuestaHabitacion;
}

// Actualizar una habitación existente sin crear otra publicación.
export async function actualizarAnuncio(
  listingId: string,
  datos: DatosEdicionAnuncio
): Promise<void> {
  validarConfiguracion();

  const formData = new FormData();

  formData.append("titulo", datos.titulo);
  formData.append("descripcion", datos.descripcion);
  formData.append("renta", datos.renta);
  formData.append("ubicacion", datos.ubicacion);
  formData.append("latitude", String(datos.latitude));
  formData.append("longitude", String(datos.longitude));
  formData.append("availableFrom", datos.availableFrom);
  formData.append("maxRoommates", String(datos.maxRoommates));

  // Orden de las fotografías que se conservarán y agregarán.
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

  for (const foto of datos.fotos) {
    if (foto.type === "existing") {
      // Conservar una fotografía que ya existe en el servidor.
      photosOrder.push({
        type: "existing",
        id: foto.id,
      });
    } else {
      // Agregar una fotografía nueva.
      const archivo = new File(foto.foto.uri);

      formData.append("photos", archivo);

      photosOrder.push({
        type: "new",
        fileIndex,
      });

      fileIndex++;
    }
  }

  formData.append("photosOrder", JSON.stringify(photosOrder));

  const respuesta = await fetch(
    `${API_URL}/rooms/${encodeURIComponent(listingId)}`,
    {
      method: "PATCH",
      body: formData,
      headers: {
        Accept: "application/json",
      },
    }
  );

  const resultado = await respuesta.json().catch(() => null);

  if (!respuesta.ok) {
    throw new Error(
      resultado?.error ?? "No se pudo actualizar la habitación."
    );
  }
}

// Publicar una habitación que ya está guardada.
export async function publicarAnuncio(
  habitacionId: string
): Promise<void> {
  validarConfiguracion();

  const respuesta = await fetch(
    `${API_URL}/rooms/${encodeURIComponent(habitacionId)}/publish`,
    {
      method: "PATCH",
      headers: {
        Accept: "application/json",
      },
    }
  );

  const resultado = await respuesta.json().catch(() => null);

  if (!respuesta.ok) {
    throw new Error(
      resultado?.error ?? "La habitación se guardó, pero no se pudo publicar."
    );
  }
}
