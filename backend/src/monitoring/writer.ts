import type {
  monActivityLog,
  monBackupLog,
  monError,
  monProbe,
  monRequestLog,
  monTestResult,
  monTestRun,
} from "./schema.js";

export type MonitorRecord =
  | { kind: "request"; value: typeof monRequestLog.$inferInsert }
  | { kind: "activity"; value: typeof monActivityLog.$inferInsert }
  | { kind: "error"; value: typeof monError.$inferInsert }
  | { kind: "probe"; value: typeof monProbe.$inferInsert }
  | { kind: "backup"; value: typeof monBackupLog.$inferInsert }
  | { kind: "testRun"; value: typeof monTestRun.$inferInsert }
  | { kind: "testResult"; value: typeof monTestResult.$inferInsert };

export interface MonitorSink {
  insert(records: MonitorRecord[]): Promise<void>;
}

export interface WriterOptions {
  maxQueue?: number;
  batchSize?: number;
  intervalMs?: number;
  now?: () => number;
}

/** Salida estructurada: nunca incluye datos de la petición, solo conteos. */
export const emitMonitorEvent = (event: Record<string, unknown>): void => {
  process.stdout.write(`${JSON.stringify({ origin: "monitoring", ...event })}\n`);
};

/**
 * Cola acotada. `enqueue` nunca espera a la base: la petición termina aunque
 * `roomlink_monitor` esté caída. El lote se escribe en segundo plano.
 */
export class BatchedMonitorWriter {
  private readonly queue: MonitorRecord[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private flushing = false;
  private dropped = 0;
  private readonly maxQueue: number;
  private readonly batchSize: number;
  private readonly intervalMs: number;

  constructor(
    private readonly sink: MonitorSink,
    options: WriterOptions = {},
  ) {
    this.maxQueue = options.maxQueue ?? 500;
    this.batchSize = options.batchSize ?? 100;
    this.intervalMs = options.intervalMs ?? 2_000;
  }

  get pending(): number {
    return this.queue.length;
  }

  get discarded(): number {
    return this.dropped;
  }

  enqueue(record: MonitorRecord): void {
    if (this.queue.length >= this.maxQueue) {
      const removed = this.queue.shift();
      this.dropped += 1;
      emitMonitorEvent({ event: "queue_discarded", kind: removed?.kind, dropped: this.dropped });
    }
    this.queue.push(record);
    if (this.queue.length >= this.batchSize) {
      void this.flush();
      return;
    }
    this.schedule();
  }

  private schedule(): void {
    if (this.timer || this.flushing) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.flush();
    }, this.intervalMs);
    this.timer.unref?.();
  }

  async flush(): Promise<void> {
    if (this.flushing || this.queue.length === 0) return;
    this.flushing = true;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    const batch = this.queue.splice(0, this.batchSize);
    try {
      await this.sink.insert(batch);
      emitMonitorEvent({ event: "batch_written", count: batch.length });
    } catch (error) {
      this.dropped += batch.length;
      emitMonitorEvent({
        event: "monitor_write_failed",
        count: batch.length,
        message: error instanceof Error ? error.message : "error desconocido",
      });
    } finally {
      this.flushing = false;
      if (this.queue.length > 0) this.schedule();
    }
  }

  async close(): Promise<void> {
    while (this.queue.length > 0) await this.flush();
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
