import { emitMonitorEvent } from "./writer.js";

/** Periodo por defecto: el mes actual en UTC-6 (hora local de León). */
export function resolvePeriod(argv: string[] = process.argv.slice(2)): string {
  const flag = argv.find((value) => value.startsWith("--period="));
  const period = flag?.slice("--period=".length) ?? process.env.MONITOR_PERIOD;
  if (period) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) {
      throw new Error(`Periodo inválido: ${period}. Usa YYYY-MM.`);
    }
    return period;
  }
  return new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString().slice(0, 7);
}

export async function runStep(name: string, period: string, work: () => Promise<number>): Promise<void> {
  try {
    const records = await work();
    emitMonitorEvent({ event: "monitor_step_finished", step: name, period, records });
  } catch (error) {
    emitMonitorEvent({
      event: "monitor_step_failed",
      step: name,
      period,
      message: error instanceof Error ? error.message : "error desconocido",
    });
    process.exitCode = 1;
  }
}
