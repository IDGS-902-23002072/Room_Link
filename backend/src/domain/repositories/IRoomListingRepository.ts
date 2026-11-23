
import type { RoomListing } from "../entities/RoomListing.js";

// ======================================================
// INTERFACES DE FOTOGRAFÍAS
// ======================================================

export interface RoomPhotoInput {
  fileName: string;
  mimeType: string;
  imageData: Buffer;
}

export interface RoomPhotoRecord extends RoomPhotoInput {
  id: string;
  listingId: string;
  position: number;
}

// Datos de una fotografía sin recuperar su archivo binario.
export interface RoomPhotoMetadata {
  id: string;
  listingId: string;
  fileName: string;
  mimeType: string;
  position: number;
}

export type RoomPhotoUpdateItem =
  | {
      type: "existing";
      id: string;
    }
  | {
      type: "new";
      photo: RoomPhotoInput;
    };

// ======================================================
// INTERFAZ DE UBICACIÓN
// ======================================================

export interface RoomLocationInput {
  address: string;
  latitude: number;
  longitude: number;
}

export type RoomCostKind =
  | "rent"
  | "service"
  | "deposit"
  | "maintenance"
  | "other";

export interface RoomRulesRecord {
  visitsPolicy: string | null;
  partiesAllowed: boolean;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  petsAllowed: boolean;
  smokingAllowed: boolean;
  commonAreasNotes: string | null;
  extraRules: string | null;
}

export interface RoomCostItemInput {
  kind: RoomCostKind;
  concept: string;
  amount: number;
  isIncluded: boolean;
  isProrated: boolean;
}

export interface RoomCostItemRecord extends RoomCostItemInput {
  id: string;
  listingId: string;
}

// ======================================================
// FILTROS DEL CATÁLOGO DE PUBLICACIONES
// ======================================================

export interface RoomFeedFilters {
  minRent?: number | undefined;
  maxRent?: number | undefined;
  excludeHostId?: string | undefined;
  search?: string | undefined;
}

// ======================================================
// ELEMENTO DEL CATÁLOGO DE PUBLICACIONES
// ======================================================

export interface RoomFeedItem {
  id: string;
  hostId: string;
  hostName: string | null;
  title: string;
  description: string | null;
  monthlyRent: number;
  availableFrom: Date | null;
  maxRoommates: number | null;
  photoCount: number;
  address: string | null;
  zone: string | null;
  city: string | null;
  publishedAt: Date | null;
}
// ======================================================
// REPOSITORIO DE PUBLICACIONES
// ======================================================

export interface IRoomListingRepository {
  // Consultar una publicación por su ID.
  findById(id: string): Promise<RoomListing | null>;

  // Habitaciones publicadas, de la más reciente a la más antigua (HU-04).
  findPublishedFeed(
    filters: RoomFeedFilters,
    limit: number,
    offset: number
  ): Promise<RoomFeedItem[]>;

  // Consultar publicaciones publicadas.
  findPublished(
    limit?: number,
    offset?: number
  ): Promise<RoomListing[]>;

  // Consultar publicaciones de un anfitrión.
  findByHostId(hostId: string): Promise<RoomListing[]>;

  // Crear una publicación sin ubicación ni fotografías.
  create(room: RoomListing): Promise<RoomListing>;

  // Crear una publicación con ubicación y fotografías opcionales.
  createWithLocationAndPhotos(
    room: RoomListing,
    location: RoomLocationInput | null,
    photos: RoomPhotoInput[]
  ): Promise<RoomListing>;

  // Actualizar los datos de una publicación.
  update(room: RoomListing): Promise<void>;

  // Contar las fotografías de una publicación.
  countPhotos(listingId: string): Promise<number>;

  // Recuperar una fotografía específica.
  findPhotoById(
    listingId: string,
    photoId: string
  ): Promise<RoomPhotoRecord | null>;

  // Recuperar la primera fotografía.
  findFirstPhotoByListingId(
    listingId: string
  ): Promise<RoomPhotoRecord | null>;

  // Recuperar los datos de ubicación.
  findLocationById(
    id: string
  ): Promise<RoomLocationInput | null>;

  // Recuperar los metadatos de todas las fotografías.
  findPhotosByListingId(
    listingId: string
  ): Promise<RoomPhotoMetadata[]>;

  // Actualizar datos, ubicación y fotografías.
  updateWithLocationAndPhotos(
    room: RoomListing,
    location: RoomLocationInput | null,
    photos: RoomPhotoUpdateItem[]
  ): Promise<void>;

  // Cambiar el estado de una publicación de forma atómica.
  transitionStatus(
    id: string,
    expectedStatus: "draft" | "published" | "paused",
    newStatus: "published" | "paused" | "closed"
  ): Promise<boolean>;

  // Reglas de la casa (HU-06 / M08).
  findRulesByListingId?(listingId: string): Promise<RoomRulesRecord | null>;
  upsertRules?(listingId: string, rules: RoomRulesRecord): Promise<RoomRulesRecord>;

  // Desglose de costos: servicios, depósito, mantenimiento (HU-06 / M08).
  findCostItemsByListingId?(listingId: string): Promise<RoomCostItemRecord[]>;
  replaceCostItems?(
    listingId: string,
    items: RoomCostItemInput[]
  ): Promise<RoomCostItemRecord[]>;
}
