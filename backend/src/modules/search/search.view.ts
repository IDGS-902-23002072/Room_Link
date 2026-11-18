import type {
  PaginatedResult,
  Profile,
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
    };
  }

  public static toProfilesPage(
    result: PaginatedResult<Profile>,
  ): PaginatedDto<ProfileResponseDto> {
    return {
      items: result.items.map(ProfileView.toPublicProfile),
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
