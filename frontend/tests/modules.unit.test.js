import { describe, expect, it } from "vitest";
import { validateLogin, validateRegistration, validateReset } from "../src/modules/auth/auth.logic";
import { normalizeHistory, validateMessage } from "../src/modules/messaging/messaging.logic";
import { isListingReport, validateDecision } from "../src/modules/moderation/moderation.logic";

describe("auth form rules", () => {
  it("requires valid email, minimum password and accepted terms", () => {
    expect(validateRegistration({ email: "bad", password: "123", termsAccepted: false })).toBeTruthy();
    expect(validateRegistration({ email: "cesar@room.link", password: "12345678", termsAccepted: true })).toBeNull();
    expect(validateLogin({ email: "", password: "" })).toBeTruthy();
    expect(validateReset({ token: "token", password: "12345678" })).toBeNull();
  });
});

describe("messaging view rules", () => {
  it("normalizes valid text and maintains chronological order", () => {
    expect(validateMessage("  hola  ")).toEqual({ error: null, body: "hola" });
    expect(validateMessage("   ").error).toBeTruthy();
    expect(normalizeHistory([{ id: 3 }, { id: 1 }, { id: 2 }]).map(({ id }) => id)).toEqual([1, 2, 3]);
  });
});

describe("listing moderation view rules", () => {
  it("requires reasons for adverse decisions and excludes other targets", () => {
    expect(validateDecision("rejected", "")).toBeTruthy();
    expect(validateDecision("removed", "fraude")).toBeNull();
    expect(isListingReport({ listingId: "listing-1" })).toBe(true);
    expect(isListingReport({ targetUserId: "user-1" })).toBe(false);
  });
});
