import "dotenv/config";
import { closeReadOnlyPool, collectCaseEvents } from "./cases.js";
import { closeMonitorDatabase } from "./db.js";
import { resolvePeriod, runStep } from "./cli.js";

const period = resolvePeriod();
await runStep("collect_cases", period, () => collectCaseEvents(period));
await closeReadOnlyPool();
await closeMonitorDatabase();
