import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { AppError } from "../shared/AppError.js";
import { parseTestRecords, TEST_RECORD_ENV } from "./testRecordBridge.js";
import { emitMonitorEvent, type MonitorRecord } from "./writer.js";

/** Suites que el panel puede ejecutar. Nunca se acepta un comando del cliente. */
export interface TestSuiteDefinition {
  id: string;
  label: string;
  description: string;
}

export const TEST_SUITES: readonly TestSuiteDefinition[] = [
  {
    id: "funcional",
    label: "Funcional · flujos principales",
    description:
      "Login, test de convivencia, creación de anuncios, postulaciones y cierre con la propia app. Cada paso queda trazable en la bitácora; datos en memoria, sin escribir en roomlink.",
  },
  {
    id: "disponibilidad",
    label: "Disponibilidad · /health y /ready",
    description:
      "Sondea /health y /ready con la base disponible y caída. Comprueba que cada sondeo deje un registro claro en la bitácora de monitoreo.",
  },
  {
    id: "monitor",
    label: "Monitoreo · infraestructura (F1/F2/F3/F5)",
    description:
      "Comprueba la bitácora, privacidad, exclusiones y tolerancia a fallos. No prueba login ni flujos de negocio.",
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
  /** Texto en lenguaje natural: qué se verificó y qué pasó. */
  description?: string | null;
  /** Patrón de datos de prueba, sin correos, tokens ni identificadores de URL. */
  dataSummary?: string | null;
  expected?: string | null;
  obtained?: string | null;
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
  /** Pasos reales de la suite (operaciones y sondeos), ya saneados. */
  records: MonitorRecord[];
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
  funcional: {
    cwd: backendDir,
    args: ["run", "test:functional:json"],
    report: resolve(repoDir, "reports/vitest-functional.json"),
  },
  disponibilidad: {
    cwd: backendDir,
    args: ["run", "test:availability:json"],
    report: resolve(repoDir, "reports/vitest-availability.json"),
  },
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

/**
 * Los títulos de las pruebas pueden traer texto legible separado por ` :: `:
 * título :: qué se verificó :: datos :: esperado :: obtenido.
 * Así el panel no muestra el nombre técnico de Vitest sino una explicación.
 */
export const explainTest = (title: string) => {
  const parts = title.split(" :: ").map((part) => part.trim());
  const taggedName = parts[0] || "prueba sin nombre";
  const sliTag = taggedName.match(/\[SLI\s+[^\]]+\]/i)?.[0] ?? null;
  return {
    testName: sliTag ? taggedName.replace(sliTag, "").trim() : taggedName,
    description: parts[1] || null,
    dataSummary: parts[2] || null,
    expected: parts[3] || null,
    obtained: parts[4] || null,
  };
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
      const { exitCode, records } = await this.spawn(command, suite);
      reason = `la suite terminó con código ${exitCode ?? "desconocido"}`;
      const report = await this.readReport(command.report, suite);
      const outcome = this.toOutcome(report, suite, startedAt, new Date());
      outcome.records = records;
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

  private spawn(
    command: SuiteCommand,
    suite: string,
  ): Promise<{ exitCode: number | null; records: MonitorRecord[] }> {
    return new Promise((resolveExit, reject) => {
      let settled = false;
      let stdout = "";
      const args = useNodeCli ? [npmCli, ...command.args] : command.args;
      const child = spawn(npmCommand, args, {
        cwd: command.cwd,
        env: { ...process.env, [TEST_RECORD_ENV]: "1" },
        stdio: ["ignore", "pipe", "pipe"],
        shell: false,
        windowsHide: true,
      });
      // Solo se leen las líneas marcadas por el puente; el resto se descarta
      // sin guardarse para no filtrar rutas ni mensajes de Vitest.
      child.stdout.on("data", (chunk: Buffer | string) => {
        stdout += chunk.toString();
        if (stdout.length > 2_000_000) stdout = stdout.slice(-2_000_000);
      });
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
      child.on("close", (code) =>
        finish(() => resolveExit({ exitCode: code, records: parseTestRecords(stdout) })),
      );
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
        const fullName =
          typeof raw.fullName === "string" && raw.fullName.trim()
            ? raw.fullName
            : typeof raw.title === "string"
              ? raw.title
              : "prueba sin nombre";
        const title =
          typeof raw.title === "string" && raw.title.trim() ? raw.title : fullName;
        const status =
          raw.status === "passed" || raw.status === "failed" || raw.status === "skipped"
            ? raw.status
            : "failed";
        const duration = typeof raw.duration === "number" ? Math.max(0, Math.round(raw.duration)) : null;
        const sliId = sliFromName(fullName);
        results.push({
          sliId,
          module: moduleFromSli(sliId),
          result: status,
          durationMs: duration,
          ...explainTest(title),
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
      records: [],
    };
  }
}
