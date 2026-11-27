import { describe, expect, it, vi } from "vitest";
import { GeolocationService } from "../../src/modules/geolocation/geolocation.service.js";

const geocoding = "https://geo.example/search";
const overpass = "https://geo.example/interpreter";

describe("GeolocationService", () => {
  it("searches explicit queries in Mexico, normalizes results and shares a cached request", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(Response.json([
      { lat: "21.1221", lon: "-101.683", display_name: "Centro, León" },
      { lat: "", lon: "0", display_name: "Invalid" },
    ]));
    const service = new GeolocationService(request, geocoding, overpass);
    const searches = await Promise.all([service.search(" Centro   León "), service.search("centro león")]);
    expect(searches).toEqual(Array(2).fill([{ latitude: 21.1221, longitude: -101.683, label: "Centro, León" }]));
    expect(request).toHaveBeenCalledTimes(1);
    const [url, options] = request.mock.calls[0]!;
    expect(new URL(String(url)).searchParams.get("countrycodes")).toBe("mx");
    expect(options?.headers).toHaveProperty("User-Agent", expect.stringContaining("RoomLink"));
    await expect(service.search("otra dirección")).rejects.toMatchObject({ code: "GEOLOCATION_BUSY" });
    await expect(service.search("  ")).rejects.toMatchObject({ status: 400 });
  });

  it("[SLI 6.3] uses only fixed nearby categories and excludes points outside the radius", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ elements: [
      { type: "way", id: 2, center: { lat: 21.125, lon: -101.683 }, tags: { shop: "supermarket", name: "Mercado" } },
      { type: "node", id: 1, lat: 21.123, lon: -101.683, tags: { highway: "bus_stop" } },
      { type: "node", id: 3, lat: 21.155, lon: -101.683, tags: { amenity: "pharmacy" } },
      { type: "node", id: 4, lat: 21.122, lon: -101.683, tags: { amenity: "bench" } },
    ] }));
    const service = new GeolocationService(request, geocoding, overpass);
    await expect(service.nearby({ latitude: 21.122, longitude: -101.683 })).resolves.toMatchObject({
      radiusMeters: 1500, items: [
        { id: "node/1", category: "bus_stop", distanceMeters: 111 },
        { id: "way/2", category: "supermarket", distanceMeters: 334 },
      ],
    });
    expect(request.mock.calls[0]?.[1]?.body?.toString()).toContain("around%3A1500%2C21.12200%2C-101.68300");
    await expect(service.nearby({ latitude: 91, longitude: 0 })).rejects.toMatchObject({ status: 404 });
  });

  it("returns a recoverable provider failure instead of an empty result", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 429 }));
    const service = new GeolocationService(request, geocoding, overpass);
    await expect(service.search("Centro León")).rejects.toMatchObject({ status: 503, code: "GEOLOCATION_UNAVAILABLE" });
  });
});
