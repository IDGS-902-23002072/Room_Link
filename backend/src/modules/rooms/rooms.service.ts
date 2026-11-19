
import { randomUUID } from "node:crypto";

import {
  RoomListing,
  type IRoomListingRepository,
  type RoomPhotoInput,
  type RoomPhotoRecord,
  type RoomPhotoUpdateItem,
  type RoomLocationInput,
} from "../../domain/index.js";

// ======================================================
// INTERFACES
// ======================================================

export interface CreateRoomInput {
  hostId: string;
  title: string;
  description?: string | null;
  monthlyRent: number;
  availableFrom?: string | null;
  maxRoommates?: number | null;

  // Ubicación opcional para permitir borradores incompletos.
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;

  // Fotografías opcionales.
  photos?: RoomPhotoInput[];
}

export interface UpdateRoomInput {
  title: string;
  description: string | null;
  monthlyRent: number;
  availableFrom: string | null;
  maxRoommates: number | null;

  // Ubicación opcional.
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;

  // Fotografías existentes y nuevas, respetando su orden.
  photos: RoomPhotoUpdateItem[];
}

// ======================================================
// CONSTANTES
// ======================================================

const TIPOS_IMAGEN_PERMITIDOS = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

const TAMANO_MAXIMO_IMAGEN = 8 * 1024 * 1024;

const MAXIMO_FOTOGRAFIAS = 10;
const MINIMO_FOTOGRAFIAS_PUBLICACION = 3;

const RENTA_MAXIMA = 99999999.99;
const MAXIMO_COMPANEROS = 100;

// ======================================================
// VALIDACIONES DE FECHAS
// ======================================================

/**
 * Obtiene la fecha actual de México.
 * El resultado tiene formato YYYY-MM-DD.
 */
function obtenerFechaActualMexico(): string {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const obtenerParte = (tipo: string): string => {
    return partes.find((parte) => parte.type === tipo)?.value ?? "";
  };

  const year = obtenerParte("year");
  const month = obtenerParte("month");
  const day = obtenerParte("day");

  return `${year}-${month}-${day}`;
}

/**
 * Comprueba que una fecha tenga el formato YYYY-MM-DD
 * y que realmente exista en el calendario.
 */
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

/**
 * Valida la fecha de disponibilidad.
 * Permite null para guardar borradores incompletos.
 */
function validarFechaDisponibilidad(
  fecha: string | null | undefined,
): Date | null {
  if (fecha === null || fecha === undefined || fecha === "") {
    return null;
  }

  if (!fechaValida(fecha)) {
    throw new Error(
      "La fecha de disponibilidad no tiene un formato válido.",
    );
  }

  const hoy = obtenerFechaActualMexico();

  if (fecha < hoy) {
    throw new Error(
      "La habitación no puede estar disponible desde una fecha pasada.",
    );
  }

  return new Date(`${fecha}T00:00:00.000Z`);
}

/**
 * Comprueba que una publicación tenga una fecha de disponibilidad
 * válida antes de publicarse o reactivarse.
 */
function validarFechaRequerida(fecha: Date | null): void {
  if (!fecha || Number.isNaN(fecha.getTime())) {
    throw new Error(
      "Debes registrar una fecha de disponibilidad antes de publicar.",
    );
  }

  const fechaTexto = fecha.toISOString().slice(0, 10);

  if (fechaTexto < obtenerFechaActualMexico()) {
    throw new Error(
      "La habitación no puede estar disponible desde una fecha pasada.",
    );
  }
}

// ======================================================
// VALIDACIÓN DE UBICACIÓN
// ======================================================

/**
 * Permite que los tres campos de ubicación estén vacíos.
 *
 * Si se proporciona alguno, los tres deben estar completos.
 */
function obtenerUbicacion(input: {
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}): RoomLocationInput | null {
  const direccion = input.address?.trim() ?? "";
  const latitud = input.latitude;
  const longitud = input.longitude;

  const sinDireccion = !direccion;
  const sinLatitud = latitud === null || latitud === undefined;
  const sinLongitud = longitud === null || longitud === undefined;

  // No se proporcionó ningún dato de ubicación.
  if (sinDireccion && sinLatitud && sinLongitud) {
    return null;
  }

  // No se permite una ubicación incompleta.
  if (sinDireccion || sinLatitud || sinLongitud) {
    throw new Error(
      "Para registrar la ubicación debes proporcionar dirección, latitud y longitud.",
    );
  }

  if (direccion.length > 500) {
    throw new Error(
      "La dirección no debe superar los 500 caracteres.",
    );
  }

  if (
    typeof latitud !== "number" ||
    !Number.isFinite(latitud) ||
    latitud < -90 ||
    latitud > 90
  ) {
    throw new Error("La latitud no es válida.");
  }

  if (
    typeof longitud !== "number" ||
    !Number.isFinite(longitud) ||
    longitud < -180 ||
    longitud > 180
  ) {
    throw new Error("La longitud no es válida.");
  }

  return {
    address: direccion,
    latitude: latitud,
    longitude: longitud,
  };
}

// ======================================================
// VALIDACIONES GENERALES
// ======================================================

/**
 * Valida los datos generales de una publicación.
 * No exige ubicación porque puede tratarse de un borrador.
 */
function validarDatosPublicacion(input: {
  title: string;
  description?: string | null;
  monthlyRent: number;
  maxRoommates?: number | null;
}): void {
  // Título.
  if (
    typeof input.title !== "string" ||
    input.title.trim().length < 5 ||
    input.title.trim().length > 200
  ) {
    throw new Error(
      "El título debe tener entre 5 y 200 caracteres.",
    );
  }

  // Descripción.
  if (
    input.description !== undefined &&
    input.description !== null &&
    typeof input.description !== "string"
  ) {
    throw new Error("La descripción no es válida.");
  }

  if (
    typeof input.description === "string" &&
    input.description.trim().length > 5000
  ) {
    throw new Error(
      "La descripción no puede superar los 5000 caracteres.",
    );
  }

  // Renta.
  if (
    typeof input.monthlyRent !== "number" ||
    !Number.isFinite(input.monthlyRent) ||
    input.monthlyRent <= 0 ||
    input.monthlyRent > RENTA_MAXIMA ||
    Math.round(input.monthlyRent * 100) !==
    input.monthlyRent * 100
  ) {
    throw new Error(
      "La renta mensual debe ser mayor a cero y tener máximo dos decimales.",
    );
  }

  // Número máximo de compañeros.
  if (
    input.maxRoommates !== undefined &&
    input.maxRoommates !== null &&
    (
      !Number.isInteger(input.maxRoommates) ||
      input.maxRoommates < 1 ||
      input.maxRoommates > MAXIMO_COMPANEROS
    )
  ) {
    throw new Error(
      "El número de compañeros debe ser un entero entre 1 y 100.",
    );
  }
}

// ======================================================
// VALIDACIÓN DE FOTOGRAFÍAS
// ======================================================

/**
 * Valida fotografías nuevas.
 */
function validarFotografia(photo: RoomPhotoInput): void {
  if (
    !photo.fileName ||
    typeof photo.fileName !== "string" ||
    !photo.fileName.trim() ||
    photo.fileName.length > 255
  ) {
    throw new Error(
      "El nombre de una fotografía no es válido.",
    );
  }

  if (!TIPOS_IMAGEN_PERMITIDOS.includes(photo.mimeType)) {
    throw new Error(
      "Solo se permiten fotografías JPG, PNG o WEBP.",
    );
  }

  if (
    !Buffer.isBuffer(photo.imageData) ||
    photo.imageData.length === 0 ||
    photo.imageData.length > TAMANO_MAXIMO_IMAGEN
  ) {
    throw new Error(
      "Cada fotografía debe pesar más de 0 bytes y máximo 8 MB.",
    );
  }
}

/**
 * Valida la cantidad de fotografías recibidas.
 */
function validarCantidadFotografias(
  photos: unknown,
): asserts photos is RoomPhotoInput[] {
  if (
    !Array.isArray(photos) ||
    photos.length > MAXIMO_FOTOGRAFIAS
  ) {
    throw new Error(
      "La publicación debe tener como máximo 10 fotografías.",
    );
  }
}

// ======================================================
// SERVICIO DE HABITACIONES
// ======================================================

export class RoomsService {
  constructor(
    private roomRepo: IRoomListingRepository,
  ) { }

  // ====================================================
  // CONSULTAS
  // ====================================================

  async getById(id: string): Promise<RoomListing> {
    if (!id?.trim()) {
      throw new Error("El ID de la habitación es obligatorio.");
    }

    const room = await this.roomRepo.findById(id);

    if (!room) {
      throw new Error(
        `Habitación con ID ${id} no encontrada.`,
      );
    }

    return room;
  }

  // Obtener ubicación de una publicación.
  async getLocation(id: string) {
    const room = await this.getById(id);

    if (!room.locationId) {
      return null;
    }

    return await this.roomRepo.findLocationById(
      room.locationId,
    );
  }

  // Obtener fotografías de una publicación.
  async getPhotos(id: string) {
    await this.getById(id);

    return await this.roomRepo.findPhotosByListingId(id);
  }

  // Obtener fotografía específica.
  async getPhoto(
    listingId: string,
    photoId: string,
  ): Promise<RoomPhotoRecord> {
    const photo = await this.roomRepo.findPhotoById(
      listingId,
      photoId,
    );

    if (!photo) {
      throw new Error("Fotografía no encontrada.");
    }

    return photo;
  }

  // Obtener primera fotografía.
  async getFirstPhoto(
    listingId: string,
  ): Promise<RoomPhotoRecord> {
    const photo =
      await this.roomRepo.findFirstPhotoByListingId(
        listingId,
      );

    if (!photo) {
      throw new Error(
        "La habitación no tiene fotografías.",
      );
    }

    return photo;
  }

  // Obtener publicaciones disponibles.
  async listPublished(
    limit = 20,
    offset = 0,
  ): Promise<RoomListing[]> {
    if (
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 100 ||
      !Number.isInteger(offset) ||
      offset < 0
    ) {
      throw new Error(
        "Los parámetros de paginación no son válidos.",
      );
    }

    return await this.roomRepo.findPublished(
      limit,
      offset,
    );
  }

  // Obtener todas las publicaciones de un anfitrión.
  async listByHost(
    hostId: string,
  ): Promise<RoomListing[]> {
    if (!hostId?.trim()) {
      throw new Error(
        "El ID del anfitrión es obligatorio.",
      );
    }

    return await this.roomRepo.findByHostId(hostId);
  }

  // ====================================================
  // CREAR PUBLICACIÓN
  // ====================================================

  async createListing(
    input: CreateRoomInput,
  ): Promise<RoomListing> {
    if (!input.hostId?.trim()) {
      throw new Error("El usuario es obligatorio.");
    }

    // Validar datos generales.
    validarDatosPublicacion(input);

    // Validar ubicación opcional.
    const location = obtenerUbicacion(input);

    // Validar fecha de disponibilidad.
    const availableFrom = validarFechaDisponibilidad(
      input.availableFrom,
    );

    // Si no se mandan fotografías, utilizar un arreglo vacío.
    const photos = input.photos ?? [];

    validarCantidadFotografias(photos);

    for (const photo of photos) {
      validarFotografia(photo);
    }

    // Crear como borrador.
    const room = new RoomListing({
      id: randomUUID(),
      hostId: input.hostId.trim(),
      title: input.title.trim(),
      description: input.description?.trim() || null,
      monthlyRent: input.monthlyRent,
      availableFrom,
      maxRoommates: input.maxRoommates ?? null,
      status: "draft",
      photoCount: photos.length,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Guardar publicación, ubicación opcional y fotografías.
    return await this.roomRepo.createWithLocationAndPhotos(
      room,
      location,
      photos,
    );
  }

  // ====================================================
  // ACTUALIZAR PUBLICACIÓN
  // ====================================================

  async updateListing(
    id: string,
    input: UpdateRoomInput,
  ): Promise<RoomListing> {
    const room = await this.getById(id);

    // Una publicación cerrada es definitiva.
    if (room.status === "closed") {
      throw new Error(
        "Esta publicación está cerrada y ya no puede modificarse. Debes crear una nueva publicación.",
      );
    }

    // Validar datos generales.
    validarDatosPublicacion(input);

    // Validar ubicación opcional.
    const location = obtenerUbicacion(input);

    // Las publicaciones publicadas o pausadas deben
    // conservar una ubicación.
    if (room.status !== "draft" && !location) {
      throw new Error(
        "Una publicación que ya fue publicada debe conservar su ubicación.",
      );
    }

    // Validar fecha.
    const availableFrom = validarFechaDisponibilidad(
      input.availableFrom,
    );

    // Validar fotografías.
    if (
      !Array.isArray(input.photos) ||
      input.photos.length > MAXIMO_FOTOGRAFIAS
    ) {
      throw new Error(
        "La publicación debe tener como máximo 10 fotografías.",
      );
    }

    // Las publicaciones que ya fueron publicadas deben
    // conservar al menos 3 fotografías, incluso pausadas.
    if (
      room.status !== "draft" &&
      input.photos.length < MINIMO_FOTOGRAFIAS_PUBLICACION
    ) {
      throw new Error(
        "Una publicación que ya fue publicada debe conservar al menos 3 fotografías.",
      );
    }

    // Validar fotografías existentes y evitar duplicados.
    const idsExistentes = new Set<string>();

    for (const item of input.photos) {
      if (item.type === "existing") {
        if (
          typeof item.id !== "string" ||
          !item.id.trim()
        ) {
          throw new Error(
            "El identificador de una fotografía existente no es válido.",
          );
        }

        if (idsExistentes.has(item.id)) {
          throw new Error(
            "No puedes repetir una fotografía existente.",
          );
        }

        idsExistentes.add(item.id);
      } else if (item.type === "new") {
        validarFotografia(item.photo);
      } else {
        throw new Error(
          "El tipo de fotografía enviado no es válido.",
        );
      }
    }

    // Actualizar datos de la entidad.
    room.updateDetails({
      title: input.title.trim(),
      description: input.description?.trim() || null,
      monthlyRent: input.monthlyRent,
      availableFrom,
      maxRoommates: input.maxRoommates,
    });

    room.setPhotoCount(input.photos.length);

    // Actualizar publicación, ubicación y fotografías.
    await this.roomRepo.updateWithLocationAndPhotos(
      room,
      location,
      input.photos,
    );

    // Recuperar la publicación actualizada.
    return await this.getById(id);
  }

  // ====================================================
  // PUBLICAR BORRADOR
  // ====================================================

  async publishListing(
    id: string,
  ): Promise<RoomListing> {
    const room = await this.getById(id);

    // Solo se pueden publicar borradores.
    if (room.status !== "draft") {
      throw new Error(
        "Solamente puedes publicar una habitación que esté en estado borrador.",
      );
    }

    // Verificar ubicación.
    if (!room.locationId) {
      throw new Error(
        "No puedes publicar una habitación sin una ubicación registrada.",
      );
    }

    // Verificar fecha de disponibilidad.
    // ?? null evita pasar undefined a la función.
    validarFechaRequerida(room.availableFrom ?? null);

    // Consultar fotografías reales.
    const photoCount = await this.roomRepo.countPhotos(id);

    room.setPhotoCount(photoCount);

    if (photoCount < MINIMO_FOTOGRAFIAS_PUBLICACION) {
      throw new Error(
        "Necesitas al menos 3 fotografías para publicar una habitación.",
      );
    }

    // Validar datos generales.
    validarDatosPublicacion({
      title: room.title,
      description: room.description ?? null,
      monthlyRent: room.monthlyRent,
      maxRoommates: room.maxRoommates ?? null,
    });
    // Cambiar estado draft -> published.
    room.publish();

    await this.roomRepo.update(room);

    return room;
  }

  // ====================================================
  // PAUSAR PUBLICACIÓN
  // ====================================================

  async pauseListing(
    id: string,
  ): Promise<RoomListing> {
    const room = await this.getById(id);

    if (room.status !== "published") {
      throw new Error(
        "Solamente puedes pausar una publicación que esté activa.",
      );
    }

    room.pause();

    await this.roomRepo.update(room);

    return room;
  }

  // ====================================================
  // REACTIVAR PUBLICACIÓN
  // ====================================================

  async reactivateListing(
    id: string,
  ): Promise<RoomListing> {
    const room = await this.getById(id);

    // Solamente se puede reactivar una publicación pausada.
    if (room.status !== "paused") {
      throw new Error(
        "Solamente puedes reactivar una publicación que esté pausada.",
      );
    }

    // Verificar ubicación.
    if (!room.locationId) {
      throw new Error(
        "No puedes reactivar una publicación sin ubicación.",
      );
    }

    // Verificar fecha de disponibilidad.
    validarFechaRequerida(room.availableFrom ?? null);

    // Recuperar cantidad real de fotografías.
    const photoCount = await this.roomRepo.countPhotos(id);

    room.setPhotoCount(photoCount);

    if (photoCount < MINIMO_FOTOGRAFIAS_PUBLICACION) {
      throw new Error(
        "No puedes reactivar esta publicación porque necesita al menos 3 fotografías.",
      );
    }

    // Validar datos generales.
    validarDatosPublicacion({
      title: room.title,
      description: room.description ?? null,
      monthlyRent: room.monthlyRent,
      maxRoommates: room.maxRoommates ?? null,
    });

    // Cambiar estado paused -> published.
    room.reactivate();

    await this.roomRepo.update(room);

    return room;
  }

  // ====================================================
  // CERRAR PUBLICACIÓN
  // ====================================================

  async closeListing(
    id: string,
  ): Promise<RoomListing> {
    const room = await this.getById(id);

    // Solo una publicación activa puede cerrarse.
    if (room.status !== "published") {
      throw new Error(
        "Solamente puedes cerrar una publicación que esté activa. Si está pausada, primero debes reactivarla.",
      );
    }

    room.close();

    await this.roomRepo.update(room);

    return room;
  }
}
