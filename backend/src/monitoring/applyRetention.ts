import "dotenv/config";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { closeMonitorDatabase } from "./db.js";
import { runRetention } from "./retention.js";
import { createMonitorRetentionStore } from "./retentionStore.js";

const apply = process.argv.includes("--apply");
const dirFlag = process.argv.find((value) => value.startsWith("--csv-dir="));
const csvDir = dirFlag?.slice("--csv-dir=".length) ?? "../reports";

async function hasValidCsv(period: string): Promise<boolean> {
  try {
    const text = await readFile(join(csvDir, `solicitudes-${period}.csv`), "utf8");
    const header = text.replace(/^\uFEFF/, "").split(/\r?\n/)[0] ?? "";
    return header.startsWith("period,") && header.includes("is_good");
  } catch {
    return false;
  }
}

const store = createMonitorRetentionStore();
try {
  const snapshotPeriods = await store.listSnapshotPeriods();
  const csv = new Map<string, boolean>();
  for (const period of snapshotPeriods) {
    csv.set(period, await hasValidCsv(period));
  }
  const result = await runRetention({
    store,
    csvReady: (period) => csv.get(period) ?? false,
    apply,
  });
  console.log(JSON.stringify({ origin: "monitoring", event: "retention_finished", apply, ...result }));
} finally {
  await closeMonitorDatabase();
}
