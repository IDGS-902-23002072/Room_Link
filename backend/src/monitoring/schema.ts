import { sql } from "drizzle-orm";
import {
  bigint,
  char,
  datetime,
  decimal,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  smallint,
  text,
  timestamp,
  tinyint,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

/**
 * Esquema de `roomlink_monitor`. Es independiente de `roomlink`: aquí NO se
 * guardan correos, tokens, contraseñas, IPs, cuerpos de petición ni URLs con
 * identificadores. Solo patrones de ruta, estatus, duración, rol y request_id.
 */

export const monRequestLog = mysqlTable(
  "mon_request_log",
  {
    id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
    occurredAt: timestamp("occurred_at", { fsp: 6 }).notNull().defaultNow(),
    method: varchar("method", { length: 10 }).notNull(),
    routePattern: varchar("route_pattern", { length: 200 }).notNull(),
    status: smallint("status").notNull(),
    durationMs: int("duration_ms").notNull(),
    role: varchar("role", { length: 32 }),
    requestId: varchar("request_id", { length: 64 }),
    sliId: varchar("sli_id", { length: 10 }),
    isGood: tinyint("is_good").notNull(),
    source: varchar("source", { length: 16 }).notNull().default("real"),
    /** Explicación en lenguaje simple de lo que ocurrió en la petición. */
    message: varchar("message", { length: 200 }).default(""),
  },
  (table) => [
    index("idx_mon_request_occurred").on(table.occurredAt),
    index("idx_mon_request_sli").on(table.sliId, table.occurredAt),
    index("idx_mon_request_source").on(table.source, table.occurredAt),
  ],
);

export const monError = mysqlTable(
  "mon_error",
  {
    id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
    occurredAt: timestamp("occurred_at", { fsp: 6 }).notNull().defaultNow(),
    module: varchar("module", { length: 48 }).notNull(),
    code: varchar("code", { length: 80 }).notNull(),
    message: text("message").notNull(),
    status: smallint("status"),
    requestId: varchar("request_id", { length: 64 }),
    source: varchar("source", { length: 16 }).notNull().default("real"),
  },
  (table) => [index("idx_mon_error_occurred").on(table.occurredAt)],
);

export const monActivityLog = mysqlTable(
  "mon_activity_log",
  {
    id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
    occurredAt: timestamp("occurred_at", { fsp: 6 }).notNull().defaultNow(),
    module: varchar("module", { length: 48 }).notNull(),
    action: varchar("action", { length: 160 }).notNull(),
    result: varchar("result", { length: 16 }).notNull(),
    message: text("message").notNull(),
    httpStatus: smallint("http_status"),
    durationMs: int("duration_ms"),
    requestId: varchar("request_id", { length: 64 }),
    source: varchar("source", { length: 16 }).notNull().default("real"),
    sliId: varchar("sli_id", { length: 10 }),
    actorId: char("actor_id", { length: 36 }),
    detail: json("detail").$type<Record<string, unknown>>().notNull().default(sql`(JSON_OBJECT())`),
  },
  (table) => [
    index("idx_mon_activity_occurred").on(table.occurredAt),
    index("idx_mon_activity_filters").on(table.module, table.result, table.source, table.occurredAt),
    index("idx_mon_activity_action").on(table.action, table.occurredAt),
    index("idx_mon_activity_request").on(table.requestId),
  ],
);

export const monProbe = mysqlTable(
  "mon_probe",
  {
    id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
    checkedAt: timestamp("checked_at", { fsp: 6 }).notNull().defaultNow(),
    status: varchar("status", { length: 16 }).notNull(),
    httpStatus: smallint("http_status"),
    latencyMs: int("latency_ms"),
    source: varchar("source", { length: 16 }).notNull().default("synthetic"),
    requestId: varchar("request_id", { length: 64 }),
    message: text("message").notNull(),
  },
  (table) => [index("idx_mon_probe_checked").on(table.checkedAt)],
);

export const monBackupLog = mysqlTable(
  "mon_backup_log",
  {
    id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
    backupDate: varchar("backup_date", { length: 10 }).notNull(),
    status: varchar("status", { length: 16 }).notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number", unsigned: true }),
    durationMs: int("duration_ms"),
    source: varchar("source", { length: 16 }).notNull().default("synthetic"),
    recordedAt: timestamp("recorded_at", { fsp: 6 }).notNull().defaultNow(),
    message: text("message").notNull(),
  },
  (table) => [index("idx_mon_backup_date").on(table.backupDate)],
);

export const monSliCatalog = mysqlTable(
  "mon_sli_catalog",
  {
    // El plan usa `sli_id` VARCHAR(8); las FK de casos apuntan aquí.
    sliId: varchar("sli_id", { length: 8 }).primaryKey(),
    module: varchar("module", { length: 48 }).notNull(),
    type: varchar("type", { length: 16 }).notNull(),
    thresholdMs: int("threshold_ms"),
    sloPercent: decimal("slo_percent", { precision: 5, scale: 1 }),
    method: text("method").notNull(),
    routePattern: varchar("route_pattern", { length: 200 }),
    active: tinyint("active").notNull().default(1),
  },
);

export const monTestRun = mysqlTable(
  "mon_test_run",
  {
    id: char("id", { length: 36 }).primaryKey(),
    startedAt: timestamp("started_at", { fsp: 6 }).notNull(),
    finishedAt: timestamp("finished_at", { fsp: 6 }).notNull(),
    suite: varchar("suite", { length: 80 }).notNull(),
    complete: tinyint("complete").notNull().default(0),
    totalTests: int("total_tests").notNull(),
    passedTests: int("passed_tests").notNull(),
    failedTests: int("failed_tests").notNull(),
    commitSha: varchar("commit_sha", { length: 64 }),
    source: varchar("source", { length: 16 }).notNull().default("test"),
    message: text("message").notNull(),
  },
  (table) => [index("idx_mon_test_run_finished").on(table.finishedAt)],
);

export const monTestResult = mysqlTable(
  "mon_test_result",
  {
    id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
    runId: char("run_id", { length: 36 })
      .notNull()
      .references(() => monTestRun.id, { onDelete: "cascade" }),
    occurredAt: timestamp("occurred_at", { fsp: 6 }).notNull().defaultNow(),
    sliId: varchar("sli_id", { length: 10 }),
    module: varchar("module", { length: 48 }).notNull(),
    testName: varchar("test_name", { length: 300 }).notNull(),
    result: varchar("result", { length: 16 }).notNull(),
    dataSummary: text("data_summary"),
    expected: text("expected"),
    obtained: text("obtained"),
    durationMs: int("duration_ms"),
    source: varchar("source", { length: 16 }).notNull().default("test"),
    message: text("message").notNull(),
  },
  (table) => [
    index("idx_mon_test_result_run").on(table.runId),
    index("idx_mon_test_result_sli").on(table.sliId, table.occurredAt),
  ],
);

export const monExclusion = mysqlTable(
  "mon_exclusion",
  {
    id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
    kind: varchar("kind", { length: 24 }).notNull(),
    value: varchar("value", { length: 160 }).notNull(),
    reason: text("reason").notNull(),
    createdAt: timestamp("created_at", { fsp: 6 }).notNull().defaultNow(),
  },
  (table) => [index("idx_mon_exclusion_kind").on(table.kind, table.value)],
);

export const monSloCompliance = mysqlTable(
  "mon_slo_compliance",
  {
    id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
    sliId: varchar("sli_id", { length: 10 }).notNull(),
    period: varchar("period", { length: 7 }).notNull(),
    totalTx: int("total_tx").notNull(),
    goodTx: int("good_tx").notNull(),
    sliValue: decimal("sli_value", { precision: 5, scale: 1 }),
    sloValue: decimal("slo_value", { precision: 5, scale: 1 }),
    compliant: tinyint("compliant"),
    /** 1 cuando el SLA se calculó con la ventana acumulada de 3 meses. */
    used3mWindow: tinyint("used_3m_window").notNull().default(0),
    computedAt: timestamp("computed_at", { fsp: 6 }).notNull().defaultNow(),
    message: text("message").notNull(),
  },
  (table) => [index("idx_mon_slo_period").on(table.period, table.sliId)],
);

/** Definición exacta dada para la tabla 10 del plan (F4; SLI 10.4, 13.4, 14.3). */
export const monCaseEvent = mysqlTable(
  "mon_case_event",
  {
    id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
    sliId: varchar("sli_id", { length: 8 })
      .notNull()
      .references(() => monSliCatalog.sliId, { onDelete: "restrict", onUpdate: "cascade" }),
    caseKey: char("case_key", { length: 36 }).notNull(),
    startedAt: datetime("started_at", { fsp: 3 }).notNull(),
    finishedAt: datetime("finished_at", { fsp: 3 }),
    elapsedMs: int("elapsed_ms"),
    onTime: tinyint("on_time"),
  },
  (table) => [index("idx_mon_case_sli_started").on(table.sliId, table.startedAt)],
);

/** Definición exacta dada para la tabla 11 del plan (F6; SLI T.5). */
export const monIncident = mysqlTable(
  "mon_incident",
  {
    id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
    githubIssue: int("github_issue").notNull(),
    priority: mysqlEnum("priority", ["P0", "P1", "P2", "P3"]).notNull(),
    module: varchar("module", { length: 4 }).notNull(),
    openedAt: datetime("opened_at").notNull(),
    firstResponseAt: datetime("first_response_at"),
    restoredAt: datetime("restored_at"),
    closedAt: datetime("closed_at"),
    firstResponseDueAt: datetime("first_response_due_at").notNull(),
  },
  (table) => [
    uniqueIndex("uq_mon_incident_github_issue").on(table.githubIssue),
    index("idx_mon_incident_opened").on(table.openedAt),
    index("idx_mon_incident_priority_opened").on(table.priority, table.openedAt),
  ],
);

export const monitorSchema = {
  monRequestLog,
  monError,
  monActivityLog,
  monProbe,
  monBackupLog,
  monSliCatalog,
  monTestRun,
  monTestResult,
  monExclusion,
  monSloCompliance,
  monCaseEvent,
  monIncident,
};
