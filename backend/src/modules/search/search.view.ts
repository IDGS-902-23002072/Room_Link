import type {
  PaginatedResult,
  Profile,
  SearchProfileDetails,
  RoomListing,
} from "../../domain/index.js";
import { ProfileView, type ProfileResponseDto } from "../profile/profile.view.js";

export interface ListingSummaryDto {
  id: string;
  hostId: string;
  title: string;
  description: string | null;
  monthlyRent: number;
  availableFrom: string | null;
  maxRoommates: number | null;
  status: string;
  photoCount: number;
  createdAt: string;
}

export interface PaginatedDto<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export class SearchView {
  public static toListingSummary(listing: RoomListing): ListingSummaryDto {
    return {
      id: listing.id,
      hostId: listing.hostId,
      title: listing.title,
      description: listing.description ?? null,
      monthlyRent: listing.monthlyRent,
      availableFrom: listing.availableFrom
        ? listing.availableFrom.toISOString().split("T")[0] ?? null
        : null,
      maxRoommates: listing.maxRoommates ?? null,
      status: listing.status,
      photoCount: listing.photoCount,
      createdAt: listing.createdAt.toISOString(),
    };
  }

  public static toProfilesPage(
    result: PaginatedResult<Profile> & { details?: Map<string, SearchProfileDetails> },
  ): PaginatedDto<ProfileResponseDto & Partial<SearchProfileDetails>> {
    return {
      // HU-02 — En búsqueda/descubrimiento el espectador no es dueño ni conexión:
      // se ocultan teléfono y redes de todos los candidatos.
      items: result.items.map((profile) =>
<<<<<<< HEAD
        ({
          ...ProfileView.toPublicProfile(profile, {
            isOwner: false,
            isConnected: false,
            privacy: null,
          }),
          ...result.details?.get(profile.userId),
=======
        ProfileView.toPublicProfile(profile, {
          isOwner: false,
          isConnected: false,
          privacy: null,
>>>>>>> 6e2243ba004a596a2090f8f2a94a1b20ddc0391c
        }),
      ),
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
      totalPages: result.totalPages,
    };
  }

  public static toListingsPage(
    result: PaginatedResult<RoomListing>,
  ): PaginatedDto<ListingSummaryDto> {
    return {
      items: result.items.map(SearchView.toListingSummary),
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
      totalPages: result.totalPages,
    };
  }
}
