import "dotenv/config";
import { resolvePeriod, runStep } from "./cli.js";
import { closeMonitorDatabase } from "./db.js";
import { collectIncidents } from "./incidents.js";

const period = resolvePeriod();
await runStep("collect_incidents", period, () => collectIncidents(period));
await closeMonitorDatabase();
