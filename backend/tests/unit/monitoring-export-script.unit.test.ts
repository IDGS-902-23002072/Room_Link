import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));
const script = fileURLToPath(new URL("../../../scripts/export-monthly.mjs", import.meta.url));
const csv =
  "\uFEFFperiod,occurred_at_utc6,request_id,method,route_pattern,status,duration_ms,role,sli_id,source,is_good\r\n" +
  "2026-10,2026-10-01 00:00:00,demo-req-1.1-000,GET,/api/v1/auth/register,200,120,seeker,1.1,synthetic,1\r\n";

function runScript(
  args: string[],
  env: Record<string, string>,
): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script, ...args], {
      cwd: repoRoot,
      env: { ...process.env, ...env },
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

describe("F7 · export CSV mensual", () => {
  it("descarga el CSV con token de sesión y lo guarda con el mes en el nombre", async () => {
    const dir = await mkdtemp(join(tmpdir(), "roomlink-export-"));
    let requestedMonth: string | null = null;
    const server = createServer((request, response) => {
      const url = new URL(request.url ?? "/", "http://localhost");
      const authorized = request.headers.authorization === "Bearer demo-token";
      if (!authorized || url.pathname !== "/api/v1/admin/monitoring/export/requests.csv") {
        response.writeHead(401).end();
        return;
      }
      requestedMonth = url.searchParams.get("month");
      response.writeHead(200, { "content-type": "text/csv; charset=utf-8" }).end(csv);
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (typeof address !== "object" || address === null) throw new Error("Sin puerto local");

    try {
      const result = await runScript(
        [`--period=2026-10`, `--out-dir=${dir}`],
        {
          ROOMLINK_BASE_URL: `http://127.0.0.1:${address.port}`,
          MONITOR_ADMIN_TOKEN: "demo-token",
        },
      );
      expect(requestedMonth).toBe("2026-10");
      expect(result.code).toBe(0);
      expect(result.stderr).toBe("");
      const event = JSON.parse(result.stdout);
      expect(event.event).toBe("export_finished");
      expect(event.rows).toBe(1);
      expect(result.stdout).not.toContain("demo-token");
      expect(await readFile(join(dir, "solicitudes-2026-10.csv"), "utf8")).toBe(csv);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("falla con token inválido y no escribe el archivo", async () => {
    const dir = await mkdtemp(join(tmpdir(), "roomlink-export-fail-"));
    const server = createServer((_request, response) => response.writeHead(401).end());
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (typeof address !== "object" || address === null) throw new Error("Sin puerto local");

    try {
      const result = await runScript(
        [`--period=2026-10`, `--out-dir=${dir}`],
        {
          ROOMLINK_BASE_URL: `http://127.0.0.1:${address.port}`,
          MONITOR_ADMIN_TOKEN: "token-invalido",
        },
      );
      expect(result.code).toBe(1);
      expect(JSON.parse(result.stderr).event).toBe("export_failed");
      await expect(readFile(join(dir, "solicitudes-2026-10.csv"))).rejects.toThrow();
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await rm(dir, { recursive: true, force: true });
    }
  });
});
