import "dotenv/config";
import { sql } from "drizzle-orm";
import { closeMonitorDatabase, monitorDb } from "./db.js";
import { monSliCatalog } from "./schema.js";
import { SLI_CATALOG } from "./sliCatalog.js";

try {
  await monitorDb.insert(monSliCatalog).values(
    SLI_CATALOG.map((sli) => ({
      sliId: sli.id,
      module: sli.module,
      type: sli.type,
      thresholdMs: sli.thresholdMs,
      sloPercent: sli.sloPercent === null ? null : sli.sloPercent.toFixed(1),
      method: sli.method,
      routePattern: sli.routePattern,
      active: 1,
    })),
  ).onDuplicateKeyUpdate({ set: { sliId: sql`${monSliCatalog.sliId}` } });
  console.log(`Catálogo de monitoreo cargado: ${SLI_CATALOG.length} SLI.`);
} catch (error) {
  console.error("No se pudo cargar el catálogo de monitoreo.", error);
  process.exitCode = 1;
} finally {
  await closeMonitorDatabase();
}
