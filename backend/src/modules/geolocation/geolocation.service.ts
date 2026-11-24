import { AppError } from "../../shared/AppError.js";

type Point = { latitude: number; longitude: number };
type Address = Point & { label: string };
type Category = "supermarket" | "pharmacy" | "hospital" | "university" | "bus_stop" | "station";
type Place = Address & { id: string; category: Category; distanceMeters: number };

const radius = 1_500;
const maxCacheEntries = 250;
const hour = 60 * 60 * 1000;
const amenityCategories = new Set(["pharmacy", "hospital", "university"]);

function object(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" ? value as Record<string, unknown> : {};
}

function point(latitude: unknown, longitude: unknown): Point | null {
  const number = (value: unknown) =>
    typeof value === "number" || (typeof value === "string" && value.trim()) ? Number(value) : NaN;
  const lat = number(latitude);
  const lon = number(longitude);
  return Math.abs(lat) <= 90 && Math.abs(lon) <= 180 ? { latitude: lat, longitude: lon } : null;
}

function distance(from: Point, to: Point): number {
  const radians = Math.PI / 180;
  const a = Math.sin((to.latitude - from.latitude) * radians / 2) ** 2 +
    Math.cos(from.latitude * radians) * Math.cos(to.latitude * radians) *
    Math.sin((to.longitude - from.longitude) * radians / 2) ** 2;
  return Math.round(12_742_000 * Math.asin(Math.min(1, Math.sqrt(a))));
}

function category(tags: Record<string, unknown>): Category | null {
  if (tags.shop === "supermarket") return "supermarket";
  if (tags.highway === "bus_stop") return "bus_stop";
  if (tags.railway === "station") return "station";
  if (typeof tags.amenity === "string" && amenityCategories.has(tags.amenity)) return tags.amenity as Category;
  return null;
}

class ProviderCache<T> {
  private readonly entries = new Map<string, { expires: number; value: Promise<T> }>();
  private nextRequest = 0;

  constructor(private readonly interval: number, private readonly ttl: number) {}

  async get(key: string, load: () => Promise<T>): Promise<T> {
    const now = Date.now();
    const cached = this.entries.get(key);
    if (cached && cached.expires > now) return cached.value;
    if (now < this.nextRequest) {
      throw new AppError("Espera unos segundos antes de volver a buscar.", 503, "GEOLOCATION_BUSY");
    }
    this.nextRequest = now + this.interval;
    const value = load();
    this.entries.delete(key);
    this.entries.set(key, { value, expires: now + this.ttl });
    if (this.entries.size > maxCacheEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest !== undefined) this.entries.delete(oldest);
    }
    try {
      return await value;
    } catch (error) {
      this.entries.delete(key);
      throw error;
    }
  }
}

export class GeolocationService {
  private readonly addresses = new ProviderCache<Address[]>(1_100, 24 * hour);
  private readonly places = new ProviderCache<Place[]>(2_000, hour);

  constructor(
    private readonly request: typeof fetch = fetch,
    private readonly geocodingUrl = process.env.GEOCODING_URL ?? "https://nominatim.openstreetmap.org/search",
    private readonly nearbyUrl = process.env.NEARBY_PLACES_URL ?? "https://overpass-api.de/api/interpreter",
  ) {}

  async search(query: string): Promise<Address[]> {
    const q = query.trim().replace(/\s+/g, " ");
    if (q.length < 3 || q.length > 120) {
      throw new AppError("Escribe una dirección o referencia pública de 3 a 120 caracteres.");
    }

    return this.addresses.get(q.toLocaleLowerCase("es-MX"), async () => {
      const url = new URL(this.geocodingUrl);
      for (const [key, value] of Object.entries({
        q, format: "jsonv2", limit: "5", countrycodes: "mx", "accept-language": "es",
      })) url.searchParams.set(key, value);
      const data = await this.load(url);
      if (!Array.isArray(data)) throw this.providerError();
      return data.flatMap((row) => {
        const { lat, lon, display_name: label } = object(row);
        const coordinates = point(lat, lon);
        return coordinates && typeof label === "string" && label.trim() ? [{ ...coordinates, label }] : [];
      }).slice(0, 5);
    });
  }

  async nearby(location: Point): Promise<{ radiusMeters: number; items: Place[] }> {
    const from = point(location.latitude, location.longitude);
    if (!from) throw new AppError("Esta habitación no tiene coordenadas válidas.", 404, "LOCATION_NOT_FOUND");
    const lat = from.latitude.toFixed(5);
    const lon = from.longitude.toFixed(5);
    const items = await this.places.get(`${lat},${lon}`, async () => {
      const area = `(around:${radius},${lat},${lon})`;
      const query = `[out:json][timeout:8];(nwr["shop"="supermarket"]${area};nwr["amenity"~"^(pharmacy|hospital|university)$"]${area};nwr["highway"="bus_stop"]${area};nwr["railway"="station"]${area};);out center;`;
      const data = object(await this.load(new URL(this.nearbyUrl), {
        method: "POST", body: new URLSearchParams({ data: query }),
      }));
      if (!Array.isArray(data.elements) || data.remark) throw this.providerError();
      return data.elements.flatMap((row) => {
        const entry = object(row);
        const center = object(entry.center);
        const coordinates = point(entry.lat ?? center.lat, entry.lon ?? center.lon);
        const tags = object(entry.tags);
        const kind = category(tags);
        if (!coordinates || !kind || typeof entry.id !== "number" || typeof entry.type !== "string") return [];
        const distanceMeters = distance(from, coordinates);
        if (distanceMeters > radius) return [];
        const label = typeof tags.name === "string" ? tags.name.trim() : "";
        return [{ ...coordinates, id: `${entry.type}/${entry.id}`, label, category: kind, distanceMeters }];
      }).sort((a, b) => a.distanceMeters - b.distanceMeters).slice(0, 16);
    });
    return { radiusMeters: radius, items };
  }

  private async load(url: URL, init?: RequestInit): Promise<unknown> {
    try {
      const response = await this.request(url, {
        ...init, signal: AbortSignal.timeout(10_000), redirect: "error",
        headers: { Accept: "application/json", "User-Agent": "RoomLink/1.0 (+https://github.com/IDGS-902-23002072/Room_Link)" },
      });
      if (!response.ok) throw this.providerError();
      return await response.json();
    } catch {
      throw this.providerError();
    }
  }

  private providerError() {
    return new AppError("El servicio de mapas no está disponible en este momento.", 503, "GEOLOCATION_UNAVAILABLE");
  }
}
