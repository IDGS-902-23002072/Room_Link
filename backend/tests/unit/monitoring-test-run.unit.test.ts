import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../../src/app.js";
import { User } from "../../src/domain/entities/User.js";
import type { IUserRepository } from "../../src/domain/repositories/IUserRepository.js";
import {
  BatchedMonitorWriter,
  type MonitorRecord,
  type MonitorSink,
} from "../../src/monitoring/writer.js";
import type { TestExecutionOutcome, TestRunExecutor } from "../../src/monitoring/testRunner.js";
import { FakeMonitoringAdminRepo } from "../helpers/monitoring-admin-repo.js";
import { createAuthFakes } from "../helpers/auth-fakes.js";

const TOKEN = "token-admin-ejecucion";

function createUser(role: "admin" | "seeker") {
  const now = new Date("2026-11-27T00:00:00.000Z");
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

function outcome(suite: string): TestExecutionOutcome {
  return {
    run: {
      id: randomUUID(),
      startedAt: "2026-11-27T10:00:00.000Z",
      finishedAt: "2026-11-27T10:00:05.000Z",
      suite,
      complete: 1,
      totalTests: 2,
      passedTests: 1,
      failedTests: 1,
      commitSha: null,
    },
    results: [
      {
        sliId: "1.1",
        module: "M1",
        testName: "F1 · [SLI 1.1] registra una petición",
        result: "passed",
        durationMs: 12,
      },
      {
        sliId: null,
        module: "sin-sli",
        testName: "F3 · rechaza token inválido",
        result: "failed",
        durationMs: 8,
      },
    ],
  };
}

function setup(runner: TestRunExecutor) {
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
  const sink = new CapturingSink();
  const writer = new BatchedMonitorWriter(sink, {
    batchSize: 100,
    intervalMs: 600_000,
  });
  const app = createApp({
    userRepo,
    authDependencies: createAuthFakes().dependencies,
    monitoringAdminRepo: new FakeMonitoringAdminRepo(),
    testRunner: runner,
    monitorWriter: writer,
    monitorIngestToken: TOKEN,
    checkDatabase: vi.fn(),
  });
  return { app, writer, sink };
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

const post = (app: ReturnType<typeof createApp>, token: string, body: string) =>
  app.request("/api/v1/admin/monitoring/tests/run", {
    method: "POST",
    headers: { "content-type": "application/json", Authorization: `Bearer ${token}` },
    body,
  });

describe("F6 · ejecución de pruebas desde el panel", () => {
  it("publica solo las suites permitidas", async () => {
    const { app, writer } = setup({ run: async () => outcome("monitor") });
    const token = await tokenFor(app, "admin@roomlink.test");
    const response = await app.request("/api/v1/admin/monitoring/tests/suites", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.items.map((item: { id: string }) => item.id)).toEqual([
      "monitor",
      "backend:unit",
      "backend:smoke",
    ]);
    await writer.close();
  });

  it("ejecuta una suite permitida y encola el resultado sin esperar a la base", async () => {
    const { app, writer, sink } = setup({ run: async () => outcome("backend:unit") });
    const token = await tokenFor(app, "admin@roomlink.test");
    const response = await post(app, token, JSON.stringify({ suite: "backend:unit" }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ suite: "backend:unit", totalTests: 2, passedTests: 1, failedTests: 1 });
    expect(body.runId).toMatch(/^[0-9a-f-]{36}$/);

    await writer.close();
    const kinds = sink.records
      .map((record) => record.kind)
      .filter((kind) => kind === "testRun" || kind === "testResult");
    expect(kinds).toEqual(["testRun", "testResult", "testResult"]);
  });

  it("rechaza comandos y suites fuera de la allowlist", async () => {
    const run = vi.fn(async () => outcome("monitor"));
    const { app, writer } = setup({ run });
    const token = await tokenFor(app, "admin@roomlink.test");
    const response = await post(app, token, JSON.stringify({ suite: "rm -rf /; npm test" }));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: "SUITE_INVALID" });
    expect(run).not.toHaveBeenCalled();
    await writer.close();
  });

  it("niega la ejecución a un usuario sin rol admin", async () => {
    const run = vi.fn(async () => outcome("monitor"));
    const { app, writer } = setup({ run });
    const token = await tokenFor(app, "seeker@roomlink.test");
    const response = await post(app, token, JSON.stringify({ suite: "monitor" }));
    expect(response.status).toBe(403);
    expect(run).not.toHaveBeenCalled();
    await writer.close();
  });

  it("rechaza un cuerpo que no es JSON", async () => {
    const { app, writer } = setup({ run: async () => outcome("monitor") });
    const token = await tokenFor(app, "admin@roomlink.test");
    const response = await post(app, token, "{suite:monitor");
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: "BODY_INVALID" });
    await writer.close();
  });

  it("evita dos corridas al mismo tiempo", async () => {
    let release: (() => void) | undefined;
    const pending = new Promise<TestExecutionOutcome>((resolve) => {
      release = () => resolve(outcome("monitor"));
    });
    const { app, writer } = setup({ run: () => pending });
    const token = await tokenFor(app, "admin@roomlink.test");
    const first = post(app, token, JSON.stringify({ suite: "monitor" }));
    await new Promise((ready) => setImmediate(ready));
    const second = await post(app, token, JSON.stringify({ suite: "monitor" }));
    expect(second.status).toBe(409);
    expect(await second.json()).toMatchObject({ code: "TEST_RUN_BUSY" });
    release?.();
    expect((await first).status).toBe(200);
    await writer.close();
  });
});
