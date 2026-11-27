import "dotenv/config";
import { resolvePeriod, runStep } from "./cli.js";
import { closeMonitorDatabase } from "./db.js";
import { calculateMonthlySlo } from "./sliCalculator.js";

const period = resolvePeriod();
await runStep("calculate_slo", period, async () => (await calculateMonthlySlo(period)).length);
await closeMonitorDatabase();
