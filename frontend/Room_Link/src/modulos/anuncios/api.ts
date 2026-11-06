
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

// Obtener las publicaciones del anfitrión.
export async function obtenerMisPublicaciones(): Promise<PublicacionBD[]> {
  validarConfiguracion();

  const respuesta = await fetch(
    `${API_URL}/rooms/host/${USER_ID}`,
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

  return `${API_URL}/rooms/${listingId}/photos/first`;
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

// Publicar una habitación que ya está guardada.
export async function publicarAnuncio(
  habitacionId: string
): Promise<void> {
  validarConfiguracion();

  const respuesta = await fetch(
    `${API_URL}/rooms/${habitacionId}/publish`,
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
