export const userRoles = ["seeker", "host", "admin"] as const;
export const accountStatuses = [
  "active",
  "suspended",
  "banned",
  "deleted",
] as const;
export const oauthProviders = ["google"] as const;
export const verificationStatuses = [
  "unverified",
  "pending",
  "verified",
  "rejected",
] as const;
export const listingStatuses = [
  "draft",
  "published",
  "paused",
  "closed",
] as const;
export const seekingTypes = ["room", "roommate", "both"] as const;
export const applicationStatuses = [
  "pending",
  "waitlisted",
  "rejected",
  "accepted",
] as const;
export const connectionStatuses = [
  "pending",
  "accepted",
  "rejected",
  "cancelled",
] as const;
export const savedProfileStatuses = ["saved", "discarded"] as const;
export const reportTargetTypes = ["user", "message", "listing"] as const;
export const reportReasons = [
  "fraud",
  "harassment",
  "spam",
  "inappropriate",
  "fake_profile",
  "other",
] as const;
export const reportStatuses = [
  "open",
  "in_review",
  "resolved",
  "dismissed",
] as const;
export const sanctionTypes = [
  "warning",
  "temporary_suspension",
  "permanent_ban",
  "listing_removed",
  "dismissed",
] as const;
export const listingReviewStatuses = [
  "pending",
  "approved",
  "rejected",
  "removed",
] as const;
export const notificationTypes = [
  "application_status_changed",
  "connection_request",
  "connection_accepted",
  "new_message",
  "agreement_pending",
  "listing_moderated",
  "account_sanction",
  "system",
] as const;
export const costKinds = [
  "rent",
  "service",
  "deposit",
  "maintenance",
  "other",
] as const;
