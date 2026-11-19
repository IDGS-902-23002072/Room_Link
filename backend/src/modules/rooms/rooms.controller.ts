
import type { Context } from "hono";
import type { RoomsService } from "./rooms.service.js";
import { RoomView } from "./rooms.view.js";
import type { AuthVariables } from "../auth/index.js";
import type {
  RoomPhotoInput,
  RoomPhotoUpdateItem,
} from "../../domain/index.js";
import { randomUUID } from "node:crypto";

type AuthContext = Context<{ Variables: AuthVariables }>;

type FormValue = string | File | undefined;

type FormBody = Record<
  string,
  string | File | (string | File)[]
>;

const TIPOS_IMAGEN = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

const TAMANO_MAXIMO = 8 * 1024 * 1024;
const MAXIMO_FOTOGRAFIAS = 10;
const RENTA_MAXIMA = 99999999.99;
const DESCRIPCION_MAXIMA = 5000;

// ==========================================
// INTERFACES
// ==========================================

interface DatosHabitacion {
  title: string;
  description: string | null;
  monthlyRent: number;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  availableFrom: string | null;
  maxRoommates: number | null;
}

// ==========================================
// FUNCIONES AUXILIARES
// ==========================================

function obtenerValor(
  body: FormBody,
  key: string
): FormValue {
  const value = body[key];

  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function obtenerTexto(
  value: FormValue
): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function obtenerArchivos(
  body: FormBody,
  key: string
): (string | File)[] {
  const value = body[key];

  if (Array.isArray(value)) {
    return value;
  }

  return value !== undefined ? [value] : [];
}

function esObjeto(
  value: unknown
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

// ==========================================
// VALIDACIÓN DE FECHAS
// ==========================================

function obtenerFechaHoy(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function fechaValida(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);

  if (
    year === undefined ||
    month === undefined ||
    day === undefined
  ) {
    return false;
  }

  const date = new Date(year, month - 1, day);

  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

function fechaNoAnteriorAHoy(value: string): boolean {
  return value >= obtenerFechaHoy();
}

// ==========================================
// VALIDACIÓN DE TEXTO
// ==========================================

function validarTexto(
  value: string,
  minimo: number,
  maximo: number
): boolean {
  const texto = value.trim();

  return (
    texto.length >= minimo &&
    texto.length <= maximo &&
    !/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(texto)
  );
}

// ==========================================
// VALIDAR DATOS DE HABITACIÓN
// ==========================================

function validarDatosHabitacion(
  body: FormBody
): { datos?: DatosHabitacion; error?: string } {

  const titleValue =
    obtenerTexto(obtenerValor(body, "titulo")) ??
    obtenerTexto(obtenerValor(body, "title"));

  const descriptionValue =
    obtenerTexto(obtenerValor(body, "descripcion")) ??
    obtenerTexto(obtenerValor(body, "description"));

  const rentValue =
    obtenerTexto(obtenerValor(body, "renta")) ??
    obtenerTexto(obtenerValor(body, "monthlyRent"));

  const addressValue =
    obtenerTexto(obtenerValor(body, "ubicacion")) ??
    obtenerTexto(obtenerValor(body, "address"));

  const latitudeValue = obtenerTexto(
    obtenerValor(body, "latitude")
  );

  const longitudeValue = obtenerTexto(
    obtenerValor(body, "longitude")
  );

  const availableFromValue = obtenerTexto(
    obtenerValor(body, "availableFrom")
  );

  const roommatesValue = obtenerTexto(
    obtenerValor(body, "maxRoommates")
  );

  // ------------------------------------------
  // TÍTULO
  // ------------------------------------------

  if (
    !titleValue ||
    !validarTexto(titleValue, 5, 200)
  ) {
    return {
      error: "El título es obligatorio y debe tener entre 5 y 200 caracteres.",
    };
  }

  // ------------------------------------------
  // DESCRIPCIÓN
  // ------------------------------------------

  const descripcion = descriptionValue?.trim() || null;

  if (
    descripcion !== null &&
    !validarTexto(descripcion, 1, DESCRIPCION_MAXIMA)
  ) {
    return {
      error: "La descripción no es válida o supera los 5000 caracteres.",
    };
  }

  // ------------------------------------------
  // RENTA MENSUAL
  // ------------------------------------------

  if (
    rentValue === undefined ||
    rentValue.trim() === "" ||
    !/^\d+(\.\d{1,2})?$/.test(rentValue.trim())
  ) {
    return {
      error: "La renta debe ser un número válido con máximo dos decimales.",
    };
  }

  const monthlyRent = Number(rentValue);

  if (
    !Number.isFinite(monthlyRent) ||
    monthlyRent <= 0 ||
    monthlyRent > RENTA_MAXIMA
  ) {
    return {
      error: "La renta mensual debe ser mayor a cero y no superar $99,999,999.99.",
    };
  }

  // ------------------------------------------
  // UBICACIÓN OPCIONAL PARA BORRADORES
  // ------------------------------------------

  const address = addressValue?.trim() || "";
  const latitudeText = latitudeValue?.trim() || "";
  const longitudeText = longitudeValue?.trim() || "";

  const tieneAddress = address.length > 0;
  const tieneLatitude = latitudeText.length > 0;
  const tieneLongitude = longitudeText.length > 0;

  let ubicacion: {
    address: string | null;
    latitude: number | null;
    longitude: number | null;
  };

  // Los tres campos vacíos permiten guardar
  // un borrador sin ubicación.

  if (
    !tieneAddress &&
    !tieneLatitude &&
    !tieneLongitude
  ) {
    ubicacion = {
      address: null,
      latitude: null,
      longitude: null,
    };
  } else {

    // Si se proporciona ubicación, deben
    // enviarse los tres campos.

    if (
      !tieneAddress ||
      !tieneLatitude ||
      !tieneLongitude
    ) {
      return {
        error: "Debes proporcionar la dirección y seleccionar una ubicación en el mapa.",
      };
    }

    if (!validarTexto(address, 3, 500)) {
      return {
        error: "La dirección debe tener entre 3 y 500 caracteres.",
      };
    }

    const latitude = Number(latitudeText);
    const longitude = Number(longitudeText);

    if (
      !Number.isFinite(latitude) ||
      latitude < -90 ||
      latitude > 90 ||
      !Number.isFinite(longitude) ||
      longitude < -180 ||
      longitude > 180
    ) {
      return {
        error: "Las coordenadas de ubicación no son válidas.",
      };
    }

    ubicacion = {
      address,
      latitude,
      longitude,
    };
  }

  // ------------------------------------------
  // FECHA DE DISPONIBILIDAD OPCIONAL
  // ------------------------------------------

  let availableFrom: string | null = null;

  if (
    availableFromValue !== undefined &&
    availableFromValue.trim() !== ""
  ) {
    if (
      !fechaValida(availableFromValue) ||
      !fechaNoAnteriorAHoy(availableFromValue)
    ) {
      return {
        error: "La fecha de disponibilidad debe ser hoy o una fecha futura.",
      };
    }

    availableFrom = availableFromValue;
  }

  // ------------------------------------------
  // NÚMERO MÁXIMO DE HABITANTES
  // ------------------------------------------

  let maxRoommates: number | null = null;

  if (
    roommatesValue !== undefined &&
    roommatesValue.trim() !== ""
  ) {
    if (!/^\d+$/.test(roommatesValue.trim())) {
      return {
        error: "El número de habitantes debe ser un entero positivo.",
      };
    }

    maxRoommates = Number(roommatesValue);

    if (
      !Number.isSafeInteger(maxRoommates) ||
      maxRoommates < 1 ||
      maxRoommates > 100
    ) {
      return {
        error: "El número de habitantes debe estar entre 1 y 100.",
      };
    }
  }

  return {
    datos: {
      title: titleValue.trim(),
      description: descripcion,
      monthlyRent,
      address: ubicacion.address,
      latitude: ubicacion.latitude,
      longitude: ubicacion.longitude,
      availableFrom,
      maxRoommates,
    },
  };
}

// ==========================================
// PROCESAR FOTOGRAFÍAS
// ==========================================

async function procesarFotografias(
  files: (string | File)[]
): Promise<{
  photos?: RoomPhotoInput[];
  error?: string;
}> {

  if (files.length > MAXIMO_FOTOGRAFIAS) {
    return {
      error: "No puedes enviar más de 10 fotografías.",
    };
  }

  const photos: RoomPhotoInput[] = [];

  for (const file of files) {

    if (
      typeof file === "string" ||
      !TIPOS_IMAGEN.includes(file.type)
    ) {
      return {
        error: "Solo se permiten imágenes JPG, PNG o WEBP.",
      };
    }

    if (
      file.size === 0 ||
      file.size > TAMANO_MAXIMO
    ) {
      return {
        error: "Cada fotografía debe pesar más de 0 y máximo 8 MB.",
      };
    }

    const fileName =
      file.name.split(/[\\/]/).pop() || `${randomUUID()}.jpg`;

    if (fileName.length > 255) {
      return {
        error: "El nombre de una fotografía es demasiado largo.",
      };
    }

    photos.push({
      fileName,
      mimeType: file.type,
      imageData: Buffer.from(await file.arrayBuffer()),
    });
  }

  return { photos };
}

// ==========================================
// CONTROLADOR DE HABITACIONES
// ==========================================

export class RoomsController {

  constructor(
    private roomsService: RoomsService
  ) {}

  // ==========================================
  // LISTAR HABITACIONES PUBLICADAS
  // ==========================================

  list = async (c: Context) => {
    try {

      const limitValue = c.req.query("limit") ?? "20";
      const offsetValue = c.req.query("offset") ?? "0";

      if (
        !/^\d+$/.test(limitValue) ||
        !/^\d+$/.test(offsetValue)
      ) {
        return c.json(
          { error: "La paginación debe contener números enteros." },
          400
        );
      }

      const limit = Number(limitValue);
      const offset = Number(offsetValue);

      if (
        !Number.isSafeInteger(limit) ||
        !Number.isSafeInteger(offset) ||
        limit < 1 ||
        limit > 100 ||
        offset < 0
      ) {
        return c.json(
          { error: "Paginación inválida." },
          400
        );
      }

      const rooms = await this.roomsService.listPublished(
        limit,
        offset
      );

      return c.json(RoomView.toList(rooms), 200);

    } catch (err: unknown) {

      const message =
        err instanceof Error
          ? err.message
          : "Error al obtener habitaciones.";

      return c.json({ error: message }, 500);
    }
  };

  // ==========================================
  // PUBLICACIONES DE UN ANFITRIÓN
  // ==========================================

  listByHost = async (c: AuthContext) => {
    try {

      const hostId = c.req.param("hostId");

      if (!hostId?.trim()) {
        return c.json(
          { error: "El ID del anfitrión es obligatorio." },
          400
        );
      }

      const rooms = await this.roomsService.listByHost(hostId);

      return c.json(RoomView.toList(rooms), 200);

    } catch (err: unknown) {

      const message =
        err instanceof Error
          ? err.message
          : "Error al obtener las publicaciones.";

      return c.json({ error: message }, 500);
    }
  };

  // ==========================================
  // OBTENER HABITACIÓN POR ID
  // ==========================================

  getById = async (c: Context) => {
    try {

      const id = c.req.param("id");

      if (!id?.trim()) {
        return c.json(
          { error: "El ID es obligatorio." },
          400
        );
      }

      const room = await this.roomsService.getById(id);

      const [location, photos] = await Promise.all([
        this.roomsService.getLocation(id),
        this.roomsService.getPhotos(id),
      ]);

      return c.json(
        {
          ...RoomView.toDetail(room),
          location,
          photos,
        },
        200
      );

    } catch (err: unknown) {

      const message =
        err instanceof Error
          ? err.message
          : "Habitación no encontrada.";

      return c.json({ error: message }, 404);
    }
  };

  // ==========================================
  // OBTENER FOTOGRAFÍA
  // ==========================================

  getPhoto = async (c: Context) => {
    try {

      const listingId = c.req.param("id");
      const photoId = c.req.param("photoId");

      if (!listingId || !photoId) {
        return c.json(
          { error: "Los identificadores son obligatorios." },
          400
        );
      }

      const photo = await this.roomsService.getPhoto(
        listingId,
        photoId
      );

      return c.body(
        new Uint8Array(photo.imageData),
        200,
        {
          "Content-Type": photo.mimeType,
          "Content-Disposition": "inline",
          "X-Content-Type-Options": "nosniff",
          "Cache-Control": "private, max-age=3600",
        }
      );

    } catch (err: unknown) {

      const message =
        err instanceof Error
          ? err.message
          : "Fotografía no encontrada.";

      return c.json({ error: message }, 404);
    }
  };

  // ==========================================
  // OBTENER PRIMERA FOTOGRAFÍA
  // ==========================================

  getFirstPhoto = async (c: AuthContext) => {
    try {

      const listingId = c.req.param("id");

      if (!listingId) {
        return c.json(
          { error: "El ID de la habitación es obligatorio." },
          400
        );
      }

      const photo = await this.roomsService.getFirstPhoto(
        listingId
      );

      return c.body(
        new Uint8Array(photo.imageData),
        200,
        {
          "Content-Type": photo.mimeType,
          "Content-Disposition": "inline",
          "X-Content-Type-Options": "nosniff",
          "Cache-Control": "private, max-age=3600",
        }
      );

    } catch (err: unknown) {

      const message =
        err instanceof Error
          ? err.message
          : "Fotografía no encontrada.";

      return c.json({ error: message }, 404);
    }
  };

  // ==========================================
  // SUBIR FOTOGRAFÍAS
  // ==========================================

  uploadPhotos = async (c: AuthContext) => {
    try {

      const body = await c.req.parseBody({
        all: true,
      }) as FormBody;

      const files = obtenerArchivos(body, "photos");

      if (files.length === 0) {
        return c.json(
          { error: "Debes seleccionar al menos una fotografía." },
          400
        );
      }

      const resultado = await procesarFotografias(files);

      if (resultado.error) {
        return c.json(
          { error: resultado.error },
          400
        );
      }

      return c.json(
        {
          message: "Fotografías validadas correctamente.",
          total: resultado.photos?.length ?? 0,
        },
        200
      );

    } catch (err: unknown) {

      const message =
        err instanceof Error
          ? err.message
          : "Error al procesar las fotografías.";

      return c.json({ error: message }, 500);
    }
  };

  // ==========================================
  // CREAR HABITACIÓN
  // ==========================================

  create = async (c: AuthContext) => {
    try {

      const body = await c.req.parseBody({
        all: true,
      }) as FormBody;

      const hostId = c.get("auth").userId;

      if (!hostId?.trim()) {
        return c.json(
          { error: "No se pudo identificar al anfitrión." },
          401
        );
      }

      const resultado = validarDatosHabitacion(body);

      if (resultado.error || !resultado.datos) {
        return c.json(
          { error: resultado.error },
          400
        );
      }

      const datos = resultado.datos;

      // Las fotografías son opcionales para borradores.
      const files = obtenerArchivos(body, "photos");

      const resultadoFotos = await procesarFotografias(files);

      if (resultadoFotos.error) {
        return c.json(
          { error: resultadoFotos.error },
          400
        );
      }

      const room = await this.roomsService.createListing({
        hostId,
        title: datos.title,
        description: datos.description,
        monthlyRent: datos.monthlyRent,
        availableFrom: datos.availableFrom,
        maxRoommates: datos.maxRoommates,

        // IMPORTANTE:
        // Enviar null explícitamente y no undefined.
        address: datos.address,
        latitude: datos.latitude,
        longitude: datos.longitude,

        photos: resultadoFotos.photos ?? [],
      });

      return c.json(
        {
          message: "Borrador de habitación creado correctamente.",
          room: RoomView.toDetail(room),
        },
        201
      );

    } catch (err: unknown) {

      const message =
        err instanceof Error
          ? err.message
          : "Error al crear la habitación.";

      return c.json({ error: message }, 400);
    }
  };

  // ==========================================
  // ACTUALIZAR PUBLICACIÓN
  // ==========================================

  update = async (c: AuthContext) => {
    try {

      const id = c.req.param("id");

      if (!id?.trim()) {
        return c.json(
          { error: "El ID de la publicación es obligatorio." },
          400
        );
      }

      const existing = await this.roomsService.getById(id);
      const principal = c.get("auth");

      if (
        existing.hostId !== principal.userId &&
        !principal.roles.includes("admin")
      ) {
        return c.json(
          {
            error: "No tienes permiso para editar esta publicación.",
            code: "FORBIDDEN",
          },
          403
        );
      }

      if (existing.status === "closed") {
        return c.json(
          {
            error: "No puedes modificar una publicación cerrada.",
          },
          409
        );
      }

      const body = await c.req.parseBody({
        all: true,
      }) as FormBody;

      const resultado = validarDatosHabitacion(body);

      if (resultado.error || !resultado.datos) {
        return c.json(
          { error: resultado.error },
          400
        );
      }

      const datos = resultado.datos;

      // Las publicaciones que ya fueron publicadas
      // deben conservar ubicación y fecha.

      if (existing.status !== "draft") {

        if (
          datos.address === null ||
          datos.latitude === null ||
          datos.longitude === null
        ) {
          return c.json(
            {
              error: "Una publicación que ya fue publicada debe conservar su ubicación.",
            },
            400
          );
        }

        if (!datos.availableFrom) {
          return c.json(
            {
              error: "Una publicación que ya fue publicada debe tener fecha de disponibilidad.",
            },
            400
          );
        }
      }

      // ------------------------------------------
      // ORDEN DE FOTOGRAFÍAS
      // ------------------------------------------

      const photosOrderValue = obtenerTexto(
        obtenerValor(body, "photosOrder")
      );

      if (photosOrderValue === undefined) {
        return c.json(
          { error: "No se recibió el orden de las fotografías." },
          400
        );
      }

      let photosOrder: unknown;

      try {
        photosOrder = JSON.parse(photosOrderValue);
      } catch {
        return c.json(
          { error: "El orden de fotografías no tiene un formato válido." },
          400
        );
      }

      if (
        !Array.isArray(photosOrder) ||
        photosOrder.length > MAXIMO_FOTOGRAFIAS
      ) {
        return c.json(
          { error: "La publicación puede tener entre 0 y 10 fotografías." },
          400
        );
      }

      // ------------------------------------------
      // PROCESAR FOTOGRAFÍAS NUEVAS
      // ------------------------------------------

      const files = obtenerArchivos(body, "photos");

      const resultadoFotos = await procesarFotografias(files);

      if (resultadoFotos.error) {
        return c.json(
          { error: resultadoFotos.error },
          400
        );
      }

      const newPhotos = resultadoFotos.photos ?? [];

      // ------------------------------------------
      // CONSTRUIR EL ORDEN DEFINITIVO
      // ------------------------------------------

      const photos: RoomPhotoUpdateItem[] = [];

      const usedFileIndexes = new Set<number>();
      const usedPhotoIds = new Set<string>();

      for (const rawItem of photosOrder) {

        if (!esObjeto(rawItem)) {
          return c.json(
            { error: "La información de una fotografía no es válida." },
            400
          );
        }

        if (
          rawItem.type === "existing" &&
          typeof rawItem.id === "string" &&
          rawItem.id.trim().length > 0
        ) {

          const photoId = rawItem.id.trim();

          if (usedPhotoIds.has(photoId)) {
            return c.json(
              { error: "No puedes repetir fotografías existentes." },
              400
            );
          }

          usedPhotoIds.add(photoId);

          photos.push({
            type: "existing",
            id: photoId,
          });

          continue;
        }

        if (
          rawItem.type === "new" &&
          typeof rawItem.fileIndex === "number" &&
          Number.isInteger(rawItem.fileIndex) &&
          rawItem.fileIndex >= 0 &&
          rawItem.fileIndex < newPhotos.length
        ) {

          const index = rawItem.fileIndex;

          if (usedFileIndexes.has(index)) {
            return c.json(
              { error: "Una fotografía nueva está repetida." },
              400
            );
          }

          const photo = newPhotos[index];

          if (!photo) {
            return c.json(
              { error: "No se encontró una fotografía nueva." },
              400
            );
          }

          usedFileIndexes.add(index);

          photos.push({
            type: "new",
            photo,
          });

          continue;
        }

        return c.json(
          { error: "La información de una fotografía no es válida." },
          400
        );
      }

      // Todos los archivos nuevos deben incluirse
      // en el orden definitivo.

      if (usedFileIndexes.size !== newPhotos.length) {
        return c.json(
          {
            error: "Todas las fotografías nuevas deben incluirse en el orden enviado.",
          },
          400
        );
      }

      // Las publicaciones que ya fueron publicadas
      // deben conservar al menos 3 fotografías.

      if (
        existing.status !== "draft" &&
        photos.length < 3
      ) {
        return c.json(
          {
            error: "Una publicación que ya fue publicada debe conservar al menos 3 fotografías.",
          },
          400
        );
      }

      // ------------------------------------------
      // ACTUALIZAR EN EL SERVICIO
      // ------------------------------------------

      const room = await this.roomsService.updateListing(
        id,
        {
          title: datos.title,
          description: datos.description,
          monthlyRent: datos.monthlyRent,
          availableFrom: datos.availableFrom,
          maxRoommates: datos.maxRoommates,

          // Enviar null explícitamente.
          address: datos.address,
          latitude: datos.latitude,
          longitude: datos.longitude,

          photos,
        }
      );

      return c.json(
        {
          message: "Publicación actualizada correctamente.",
          room: RoomView.toDetail(room),
        },
        200
      );

    } catch (err: unknown) {

      const message =
        err instanceof Error
          ? err.message
          : "Error al actualizar la publicación.";

      return c.json({ error: message }, 400);
    }
  };

  // ==========================================
  // PUBLICAR HABITACIÓN
  // ==========================================

  publish = async (c: AuthContext) => {
    try {

      const id = c.req.param("id");

      if (!id?.trim()) {
        return c.json(
          { error: "El ID es obligatorio." },
          400
        );
      }

      const existing = await this.roomsService.getById(id);
      const principal = c.get("auth");

      if (
        existing.hostId !== principal.userId &&
        !principal.roles.includes("admin")
      ) {
        return c.json(
          {
            error: "No tienes permiso para publicar esta habitación.",
            code: "FORBIDDEN",
          },
          403
        );
      }

      if (existing.status === "published") {
        return c.json(
          { error: "Esta habitación ya está publicada." },
          409
        );
      }

      if (existing.status === "closed") {
        return c.json(
          { error: "Una publicación cerrada no puede volver a publicarse." },
          409
        );
      }

      if (
        !existing.title?.trim() ||
        !Number.isFinite(existing.monthlyRent) ||
        existing.monthlyRent <= 0
      ) {
        return c.json(
          { error: "La publicación contiene datos incompletos o inválidos." },
          400
        );
      }

      if (!existing.locationId) {
        return c.json(
          { error: "Debes registrar una ubicación antes de publicar." },
          400
        );
      }

      if (!existing.availableFrom) {
        return c.json(
          { error: "Debes registrar una fecha de disponibilidad antes de publicar." },
          400
        );
      }

      const fechaDisponibilidad =
        existing.availableFrom.toISOString().slice(0, 10);

      if (
        !fechaValida(fechaDisponibilidad) ||
        !fechaNoAnteriorAHoy(fechaDisponibilidad)
      ) {
        return c.json(
          { error: "La fecha de disponibilidad debe ser hoy o una fecha futura." },
          400
        );
      }

      const room = await this.roomsService.publishListing(id);

      return c.json(
        {
          message: "Habitación publicada correctamente.",
          room: RoomView.toDetail(room),
        },
        200
      );

    } catch (err: unknown) {

      const message =
        err instanceof Error
          ? err.message
          : "Error al publicar la habitación.";

      return c.json({ error: message }, 400);
    }
  };

  // ==========================================
  // PAUSAR PUBLICACIÓN
  // ==========================================

  pause = async (c: AuthContext) => {
    try {

      const id = c.req.param("id");

      if (!id?.trim()) {
        return c.json(
          { error: "El ID es obligatorio." },
          400
        );
      }

      const existing = await this.roomsService.getById(id);
      const principal = c.get("auth");

      if (
        existing.hostId !== principal.userId &&
        !principal.roles.includes("admin")
      ) {
        return c.json(
          { error: "No tienes permiso para pausar esta publicación." },
          403
        );
      }

      if (existing.status !== "published") {
        return c.json(
          { error: "Solamente puedes pausar una publicación activa." },
          409
        );
      }

      const room = await this.roomsService.pauseListing(id);

      return c.json(
        {
          message: "Publicación pausada correctamente.",
          room: RoomView.toDetail(room),
        },
        200
      );

    } catch (err: unknown) {

      const message =
        err instanceof Error
          ? err.message
          : "Error al pausar la publicación.";

      return c.json({ error: message }, 400);
    }
  };

  // ==========================================
  // CERRAR PUBLICACIÓN
  // ==========================================

  close = async (c: AuthContext) => {
    try {

      const id = c.req.param("id");

      if (!id?.trim()) {
        return c.json(
          { error: "El ID es obligatorio." },
          400
        );
      }

      const existing = await this.roomsService.getById(id);
      const principal = c.get("auth");

      if (
        existing.hostId !== principal.userId &&
        !principal.roles.includes("admin")
      ) {
        return c.json(
          { error: "No tienes permiso para cerrar esta publicación." },
          403
        );
      }

      if (existing.status !== "published") {
        return c.json(
          { error: "Solamente puedes cerrar una publicación activa." },
          409
        );
      }

      const room = await this.roomsService.closeListing(id);

      return c.json(
        {
          message: "Publicación cerrada correctamente. La renta ha sido concretada.",
          room: RoomView.toDetail(room),
        },
        200
      );

    } catch (err: unknown) {

      const message =
        err instanceof Error
          ? err.message
          : "Error al cerrar la publicación.";

      return c.json({ error: message }, 400);
    }
  };

  // ==========================================
  // REACTIVAR PUBLICACIÓN PAUSADA
  // ==========================================

  reactivate = async (c: AuthContext) => {
    try {

      const id = c.req.param("id");

      if (!id?.trim()) {
        return c.json(
          { error: "El ID es obligatorio." },
          400
        );
      }

      const existing = await this.roomsService.getById(id);
      const principal = c.get("auth");

      if (
        existing.hostId !== principal.userId &&
        !principal.roles.includes("admin")
      ) {
        return c.json(
          { error: "No tienes permiso para reactivar esta publicación." },
          403
        );
      }

      if (existing.status !== "paused") {
        return c.json(
          {
            error: "Solamente puedes reactivar publicaciones pausadas.",
          },
          409
        );
      }

      if (!existing.locationId || !existing.availableFrom) {
        return c.json(
          { error: "La publicación tiene datos incompletos." },
          400
        );
      }

      const fechaDisponibilidad =
        existing.availableFrom.toISOString().slice(0, 10);

      if (
        !fechaValida(fechaDisponibilidad) ||
        !fechaNoAnteriorAHoy(fechaDisponibilidad)
      ) {
        return c.json(
          {
            error: "Actualiza la fecha de disponibilidad antes de reactivar la publicación.",
          },
          400
        );
      }

      const room = await this.roomsService.reactivateListing(id);

      return c.json(
        {
          message: "Publicación reactivada correctamente.",
          room: RoomView.toDetail(room),
        },
        200
      );

    } catch (err: unknown) {

      const message =
        err instanceof Error
          ? err.message
          : "Error al reactivar la publicación.";

      return c.json({ error: message }, 400);
    }
  };
}
