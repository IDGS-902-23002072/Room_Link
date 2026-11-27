import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { AppError } from "../shared/AppError.js";
import { emitMonitorEvent } from "./writer.js";

/** Suites que el panel puede ejecutar. Nunca se acepta un comando del cliente. */
export interface TestSuiteDefinition {
  id: string;
  label: string;
  description: string;
}

export const TEST_SUITES: readonly TestSuiteDefinition[] = [
  {
    id: "monitor",
    label: "Monitoreo (F1/F2/F3/F5)",
    description: "Pruebas unitarias del middleware y de la ingesta.",
  },
  {
    id: "backend:unit",
    label: "Backend · unitarias",
    description: "Todas las pruebas unitarias del backend.",
  },
  {
    id: "backend:smoke",
    label: "Backend · regresión",
    description: "Pruebas de humo con repositorios en memoria.",
  },
];

export interface TestCaseOutcome {
  sliId: string | null;
  module: string;
  testName: string;
  result: string;
  durationMs: number | null;
}

export interface TestExecutionOutcome {
  run: {
    id: string;
    startedAt: string;
    finishedAt: string;
    suite: string;
    complete: number;
    totalTests: number;
    passedTests: number;
    failedTests: number;
    commitSha: null;
  };
  results: TestCaseOutcome[];
}

export interface TestRunExecutor {
  run(suite: string): Promise<TestExecutionOutcome>;
}

const backendDir = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const repoDir = resolve(backendDir, "..");
/**
 * En Windows, npm.cmd no se puede lanzar sin shell; se usa node + npm-cli.js.
 * En otros sistemas se invoca npm directamente. Nunca se usa `shell: true`.
 */
const npmCli = resolve(dirname(process.execPath), "node_modules/npm/bin/npm-cli.js");
const useNodeCli = existsSync(npmCli);
const npmCommand = useNodeCli ? process.execPath : "npm";
const TIMEOUT_MS = 180_000;

interface SuiteCommand {
  cwd: string;
  args: string[];
  report: string;
}

const COMMANDS: Record<string, SuiteCommand> = {
  monitor: {
    cwd: backendDir,
    args: ["run", "test:monitor:json"],
    report: resolve(repoDir, "reports/vitest-monitor.json"),
  },
  "backend:unit": {
    cwd: backendDir,
    args: ["run", "test:unit:json"],
    report: resolve(repoDir, "reports/vitest-results.json"),
  },
  "backend:smoke": {
    cwd: backendDir,
    args: ["run", "test:smoke:json"],
    report: resolve(repoDir, "reports/vitest-smoke.json"),
  },
};

const asCount = (value: unknown): number | null =>
  typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;

const sliFromName = (name: string): string | null => {
  const match = name.match(/\[SLI\s+(\d{1,2}\.\d{1,2}|T\.\d{1,2})\]/i);
  return match ? match[1]! : null;
};

const moduleFromSli = (sliId: string | null): string =>
  sliId === null ? "sin-sli" : sliId.startsWith("T.") ? "PLAT" : `M${sliId.split(".")[0]}`;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Ejecuta un proceso con argumentos fijos, sin shell y con timeout.
 * Los reportes JSON se escriben en reports/ y se convierten al mismo formato
 * que usa la ingesta de resultados de pruebas; no se inventan conteos ausentes.
 */
export class ProcessTestRunExecutor implements TestRunExecutor {
  run = async (suite: string): Promise<TestExecutionOutcome> => {
    const command = COMMANDS[suite];
    if (!command) {
      throw new AppError("Suite no permitida. Consulta las suites disponibles.", 400, "SUITE_INVALID");
    }
    await rm(command.report, { force: true }).catch(() => undefined);
    const startedAt = new Date();
    let reason = "la suite no terminó correctamente";

    try {
      const exitCode = await this.spawn(command, suite);
      reason = `la suite terminó con código ${exitCode ?? "desconocido"}`;
      const report = await this.readReport(command.report, suite);
      const outcome = this.toOutcome(report, suite, startedAt, new Date());
      emitMonitorEvent({
        event: "test_run_executed",
        suite,
        exitCode,
        totalTests: outcome.run.totalTests,
        passedTests: outcome.run.passedTests,
        failedTests: outcome.run.failedTests,
      });
      return outcome;
    } catch (error) {
      emitMonitorEvent({
        event: "test_run_failed",
        suite,
        reason: error instanceof Error ? error.message.slice(0, 200) : reason,
      });
      throw error;
    }
  };

  private spawn(command: SuiteCommand, suite: string): Promise<number | null> {
    return new Promise((resolveExit, reject) => {
      let settled = false;
      const args = useNodeCli ? [npmCli, ...command.args] : command.args;
      const child = spawn(npmCommand, args, {
        cwd: command.cwd,
        stdio: ["ignore", "pipe", "pipe"],
        shell: false,
        windowsHide: true,
      });
      // La salida se descarta: puede contener rutas o mensajes con datos sensibles.
      child.stdout.resume();
      child.stderr.resume();

      const timer = setTimeout(() => {
        child.kill("SIGTERM");
        setTimeout(() => child.kill("SIGKILL"), 2_000).unref?.();
        if (!settled) {
          settled = true;
          reject(new AppError(`La suite ${suite} superó el tiempo límite de 3 minutos.`, 503, "TEST_RUN_TIMEOUT"));
        }
      }, TIMEOUT_MS);
      timer.unref?.();

      const finish = (callback: () => void): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        callback();
      };

      child.on("error", () =>
        finish(() => reject(new AppError(`No se pudo iniciar la suite ${suite}.`, 503, "TEST_RUN_START_FAILED"))),
      );
      child.on("close", (code) => finish(() => resolveExit(code)));
    });
  }

  private async readReport(path: string, suite: string): Promise<Record<string, unknown>> {
    let report: unknown;
    try {
      report = JSON.parse(await readFile(path, "utf8"));
    } catch {
      throw new AppError(`La suite ${suite} no entregó un reporte JSON válido.`, 503, "TEST_REPORT_INVALID");
    }
    if (!isRecord(report)) {
      throw new AppError(`La suite ${suite} entregó un reporte inesperado.`, 503, "TEST_REPORT_INVALID");
    }
    return report;
  }

  private toOutcome(
    report: Record<string, unknown>,
    suite: string,
    startedAt: Date,
    finishedAt: Date,
  ): TestExecutionOutcome {
    const totalTests = asCount(report.numTotalTests);
    const passedTests = asCount(report.numPassedTests);
    const failedTests = asCount(report.numFailedTests);
    if (totalTests === null || passedTests === null || failedTests === null) {
      throw new AppError(`El reporte de ${suite} no tiene conteos válidos.`, 503, "TEST_REPORT_INVALID");
    }

    const rawFiles = Array.isArray(report.testResults) ? report.testResults : [];
    const results: TestCaseOutcome[] = [];
    for (const file of rawFiles) {
      if (!isRecord(file) || !Array.isArray(file.assertionResults)) continue;
      for (const raw of file.assertionResults) {
        if (!isRecord(raw)) continue;
        const name =
          typeof raw.fullName === "string"
            ? raw.fullName
            : typeof raw.title === "string"
              ? raw.title
              : "prueba sin nombre";
        const status =
          raw.status === "passed" || raw.status === "failed" || raw.status === "skipped"
            ? raw.status
            : "failed";
        const duration = typeof raw.duration === "number" ? Math.max(0, Math.round(raw.duration)) : null;
        const sliId = sliFromName(name);
        results.push({
          sliId,
          module: moduleFromSli(sliId),
          testName: name,
          result: status,
          durationMs: duration,
        });
      }
    }

    return {
      run: {
        id: randomUUID(),
        startedAt: startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
        suite,
        complete: 1,
        totalTests,
        passedTests,
        failedTests,
        commitSha: null,
      },
      results,
    };
  }
}
