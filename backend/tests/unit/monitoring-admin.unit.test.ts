import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../../src/app.js";
import { User } from "../../src/domain/entities/User.js";
import type { IUserRepository } from "../../src/domain/repositories/IUserRepository.js";
import { BatchedMonitorWriter, type MonitorRecord, type MonitorSink } from "../../src/monitoring/writer.js";
import type {
  BackupRow,
  CatalogRow,
  ComplianceRow,
  ExportRequestRow,
  LogbookFilters,
  LogbookRow,
  MonitoringAdminRepository,
  ProbeRow,
  RequestRow,
  TestResultRow,
  TestRunRow,
} from "../../src/modules/monitoring-admin/index.js";
import { createAuthFakes } from "../helpers/auth-fakes.js";

const TOKEN = "token-admin-monitoreo";

function createUser(role: "admin" | "seeker") {
  const now = new Date("2026-11-01T00:00:00.000Z");
  return new User({
    id: `${role}-user`,
    email: `${role}@roomlink.test`,
    passwordHash: "hash:password",
    status: "active",
    roles: [role],
    termsAcceptedAt: now,
    createdAt: now,
    updatedAt: now,
  });
}

class CapturingSink implements MonitorSink {
  readonly records: MonitorRecord[] = [];
  async insert(records: MonitorRecord[]): Promise<void> {
    this.records.push(...records);
  }
}

class FakeRepo implements MonitoringAdminRepository {
  compliance: ComplianceRow[] = [];
  catalog: CatalogRow[] = [];
  probes: ProbeRow[] = [];
  requests: RequestRow[] = [];
  lastRun: TestRunRow | null = null;
  lastBackup: BackupRow | null = null;
  runs: TestRunRow[] = [];
  results: TestResultRow[] = [];
  logbook: LogbookRow[] = [];
  exported: ExportRequestRow[] = [];
  fail = false;

  private guard<T>(value: T): T {
    if (this.fail) throw new Error("base caída");
    return value;
  }

  getCompliance = async (): Promise<ComplianceRow[]> => this.guard(this.compliance);
  getCatalog = async (): Promise<CatalogRow[]> => this.guard(this.catalog);
  getProbes = async (): Promise<ProbeRow[]> => this.guard(this.probes);
  getRequests = async (): Promise<RequestRow[]> => this.guard(this.requests);
  getLastRun = async (): Promise<TestRunRow | null> => this.guard(this.lastRun);
  getLastBackup = async (): Promise<BackupRow | null> => this.guard(this.lastBackup);
  getRuns = async (limit: number, before?: Date): Promise<TestRunRow[]> =>
    this.guard(
      this.runs
        .filter((row) => !before || row.finishedAt < before)
        .slice(0, limit),
    );
  getRun = async (id: string): Promise<TestRunRow | null> =>
    this.guard(this.runs.find((row) => row.id === id) ?? null);
  getResults = async (): Promise<TestResultRow[]> => this.guard(this.results);
  getRequestExport = async (): Promise<ExportRequestRow[]> => this.guard(this.exported);

  getLogbook = async (filters: LogbookFilters): Promise<LogbookRow[]> => {
    let rows = this.guard([...this.logbook]).sort(
      (a, b) => b.occurredAt.getTime() - a.occurredAt.getTime(),
    );
    rows = rows.filter(
      (row) => row.occurredAt >= filters.from && row.occurredAt <= filters.to,
    );
    if (filters.module) rows = rows.filter((row) => row.module === filters.module);
    if (filters.type) rows = rows.filter((row) => row.type === filters.type);
    if (filters.status) {
      rows = rows.filter((row) => row.statusLabel === (filters.status === "success" ? "éxito" : "error"));
    }
    if (filters.inSliOnly) rows = rows.filter((row) => row.sliId !== null);
    if (!filters.includeExcluded) rows = rows.filter((row) => row.excluded === 0);
    if (filters.cursor) {
      const [stamp, id] = filters.cursor.split("|");
      rows = rows.filter((row) => {
        const key = `${row.occurredAt.toISOString()}|${row.id}`;
        return stamp && id ? key < `${stamp}|${id}` : true;
      });
    }
    return rows.slice(0, filters.limit);
  };
}

function fullRepo(): FakeRepo {
  const repo = new FakeRepo();
  repo.catalog = [
    { sliId: "1.1", module: "M1", type: "tx", thresholdMs: 3000, sloPercent: "90.0", method: "F1" },
    { sliId: "T.1", module: "T", type: "platform", thresholdMs: null, sloPercent: "95.0", method: "F2" },
    { sliId: "T.2", module: "T", type: "platform", thresholdMs: 43_200_000, sloPercent: null, method: "F2" },
  ];
  repo.compliance = [
    {
      sliId: "1.1", period: "2026-11", totalTx: 1240, goodTx: 1100, sliValue: "88.7",
      sloValue: "90.0", compliant: 0, used3mWindow: 0, message: "Transacciones de 1.1",
    },
    {
      sliId: "T.1", period: "2026-11", totalTx: 44640, goodTx: 43320, sliValue: "97.0",
      sloValue: "95.0", compliant: 1, used3mWindow: 0, message: "Sondeos de /ready correctos",
    },
    {
      sliId: "T.2", period: "2026-11", totalTx: 44640, goodTx: 44160, sliValue: null,
      sloValue: null, compliant: 1, used3mWindow: 0,
      message: "La racha más larga de sondeos fallidos fue de 480 minutos",
    },
  ];
  const base = Date.parse("2026-11-05T12:00:00.000Z");
  repo.probes = Array.from({ length: 10 }, (_, index) => ({
    checkedAt: new Date(base + index * 60_000), status: "up",
  }));
  repo.probes.push({ checkedAt: new Date(base + 10 * 60_000), status: "down" });
  repo.requests = [
    ...Array.from({ length: 5 }, () => ({ status: 200, durationMs: 120, isGood: 1, source: "real" })),
    { status: 400, durationMs: 900, isGood: 1, source: "real" },
    { status: 503, durationMs: 900, isGood: 0, source: "real" },
    { status: 200, durationMs: 50, isGood: 1, source: "test" },
  ];
  repo.lastRun = {
    id: randomUUID(), startedAt: new Date(base), finishedAt: new Date(base + 5000),
    suite: "backend:unit", complete: 1, totalTests: 229, passedTests: 229,
    failedTests: 0, source: "test",
  };
  repo.runs = [repo.lastRun];
  repo.lastBackup = { backupDate: "2026-11-27", status: "success" };
  return repo;
}

function setup(repo: FakeRepo) {
  const admin = createUser("admin");
  const seeker = createUser("seeker");
  const userRepo: IUserRepository = {
    findById: async (id) => (id === admin.id ? admin : id === seeker.id ? seeker : null),
    findByEmail: async (email) => email === admin.email ? admin : email === seeker.email ? seeker : null,
    create: async (user) => user,
    update: async () => {},
    grantHostRole: async () => {},
    delete: async () => {},
  };
  const writer = new BatchedMonitorWriter(new CapturingSink(), {
    batchSize: 100,
    intervalMs: 600_000,
  });
  const app = createApp({
    userRepo,
    authDependencies: createAuthFakes().dependencies,
    monitoringAdminRepo: repo,
    monitorWriter: writer,
    monitorIngestToken: TOKEN,
    checkDatabase: vi.fn(),
  });
  return { app, writer };
}

async function tokenFor(app: ReturnType<typeof createApp>, email: string): Promise<string> {
  const response = await app.request("/api/v1/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: "password" }),
  });
  const body = (await response.json()) as { token: string };
  return body.token;
}

describe("F6 · panel de monitoreo para administradores", () => {
  it("muestra el mes completo: disponibilidad, racha, SLO, transacciones y última corrida", async () => {
    const { app, writer } = setup(fullRepo());
    const token = await tokenFor(app, "admin@roomlink.test");
    const response = await app.request("/api/v1/admin/monitoring/summary?month=2026-11", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      period: "2026-11",
      availability: { value: 97.0, slo: 95.0, compliant: true },
      outage: { minutes: 1, compliant: true },
      sloMet: { met: 2, total: 3 },
      transactions: { good: 6, bad: 1, serverErrors: 1 },
      lastBackup: { date: "2026-11-27", status: "success" },
    });
    expect(body.lastTestRun).toMatchObject({ suite: "backend:unit", complete: true });
    await writer.close();
  });

  it("niega el panel a un usuario sin rol admin", async () => {
    const { app, writer } = setup(fullRepo());
    const token = await tokenFor(app, "seeker@roomlink.test");
    const response = await app.request("/api/v1/admin/monitoring/summary?month=2026-11", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(response.status).toBe(403);
    await writer.close();
  });

  it("informa el fallo de la base de monitoreo sin afectar /health ni la ingesta", async () => {
    const repo = fullRepo();
    repo.fail = true;
    const { app, writer } = setup(repo);
    const token = await tokenFor(app, "admin@roomlink.test");
    const panel = await app.request("/api/v1/admin/monitoring/summary?month=2026-11", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(panel.status).toBe(503);
    expect(await panel.json()).toMatchObject({ code: "MONITOR_DB_UNAVAILABLE" });

    expect((await app.request("/health")).status).toBe(200);
    const ingest = await app.request("/api/v1/admin/monitoring/ingest/probe", {
      method: "POST",
      headers: { "content-type": "application/json", "x-monitor-token": TOKEN },
      body: JSON.stringify({ status: "up" }),
    });
    expect(ingest.status).toBe(202);
    await writer.close();
  });

  it("muestra 'sin dato' cuando no hay foto mensual", async () => {
    const repo = new FakeRepo();
    repo.catalog = fullRepo().catalog;
    const { app, writer } = setup(repo);
    const token = await tokenFor(app, "admin@roomlink.test");
    const response = await app.request("/api/v1/admin/monitoring/slis?month=2026-11", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.items).toHaveLength(3);
    expect(body.items.every((item: { state: string }) => item.state === "no-data")).toBe(true);
    expect(body.items[0].message).toContain("sin dato");
    await writer.close();
  });

  it("marca la ventana de 3 meses y calcula el margen contra el SLO", async () => {
    const repo = fullRepo();
    repo.compliance[0]!.used3mWindow = 1;
    const { app, writer } = setup(repo);
    const token = await tokenFor(app, "admin@roomlink.test");
    const response = await app.request("/api/v1/admin/monitoring/slis?month=2026-11", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await response.json();
    const first = body.items.find((item: { sliId: string }) => item.sliId === "1.1");
    expect(first).toMatchObject({
      sliValue: 88.7,
      sloValue: 90,
      margin: -1.3,
      state: "unmet",
      used3mWindow: true,
    });
    await writer.close();
  });

  it("página la bitácora por cursor y aplica filtros", async () => {
    const repo = fullRepo();
    const base = Date.parse("2026-11-05T12:00:00.000Z");
    repo.logbook = [3, 2, 1].map((minute) => ({
      id: `row-${minute}`,
      occurredAt: new Date(base - minute * 60_000),
      occurredAtLocal: new Date(base - minute * 60_000 - 6 * 3_600_000),
      type: "request",
      module: "M1",
      operation: "GET /api/v1/auth/me",
      statusLabel: "éxito",
      durationMs: 120,
      message: "HTTP 200",
      source: "real",
      requestId: randomUUID(),
      sliId: "1.3",
      excluded: 0,
    }));
    const { app, writer } = setup(repo);
    const token = await tokenFor(app, "admin@roomlink.test");
    const first = await app.request(
      "/api/v1/admin/monitoring/logbook?month=2026-11&module=M1&status=success&inSli=true&limit=1",
      { headers: { Authorization: `Bearer ${token}` } },
    );
    expect(first.status).toBe(200);
    const page1 = await first.json();
    expect(page1.items).toHaveLength(1);
    expect(page1.items[0].id).toBe("row-1");
    expect(page1.nextCursor).toContain("|row-1");

    const second = await app.request(
      `/api/v1/admin/monitoring/logbook?month=2026-11&module=M1&status=success&inSli=true&limit=1&cursor=${encodeURIComponent(page1.nextCursor)}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const page2 = await second.json();
    expect(page2.items[0].id).toBe("row-2");
    await writer.close();
  });

  it("exporta CSV con patrón de ruta y sin correos ni tokens", async () => {
    const repo = fullRepo();
    repo.exported = [{
      occurredAt: new Date("2026-11-05T12:00:00.000Z"),
      requestId: randomUUID(),
      method: "GET",
      routePattern: "/api/v1/rooms/:roomId",
      status: 200,
      durationMs: 120,
      role: "seeker",
      sliId: "10.1",
      source: "real",
      isGood: 1,
    }];
    const { app, writer } = setup(repo);
    const token = await tokenFor(app, "admin@roomlink.test");
    const response = await app.request("/api/v1/admin/monitoring/export/requests.csv?month=2026-11", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(response.status).toBe(200);
    const csv = await response.text();
    expect(csv).toContain("route_pattern");
    expect(csv).toContain("/api/v1/rooms/:roomId");
    expect(csv).not.toContain("@");
    expect(csv).not.toContain("Bearer");
    await writer.close();
  });
});
