import type { RowDataPacket } from "mysql2";
import { monitorPool } from "../../monitoring/db.js";
import type {
  BackupRow,
  CatalogRow,
  ComplianceRow,
  ExportRequestRow,
  LogbookFilters,
  LogbookRow,
  MonitoringAdminRepository,
  ProbeRow,
  RequestRow,
  TestResultRow,
  TestRunRow,
} from "./monitoring-admin.ports.js";

/**
 * Todas las consultas usan parámetros enlazados y la base de monitoreo.
 * Nunca se consulta `roomlink` desde este repositorio.
 */
type SqlValue = string | number | Date | null;

export class DrizzleMonitoringAdminRepository implements MonitoringAdminRepository {
  private async rows<T>(sql: string, params: SqlValue[] = []): Promise<T[]> {
    const [result] = await monitorPool.execute(sql, params);
    return result as T[] & RowDataPacket[];
  }

  getCompliance = async (period: string): Promise<ComplianceRow[]> =>
    this.rows<ComplianceRow>(
      `SELECT sli_id AS sliId, period, total_tx AS totalTx, good_tx AS goodTx,
              sli_value AS sliValue, slo_value AS sloValue, compliant,
              used_3m_window AS used3mWindow, message
         FROM mon_slo_compliance WHERE period = ? ORDER BY sli_id`,
      [period],
    );

  getCatalog = async (): Promise<CatalogRow[]> =>
    this.rows<CatalogRow>(
      `SELECT sli_id AS sliId, module, type, threshold_ms AS thresholdMs,
              slo_percent AS sloPercent, method
         FROM mon_sli_catalog WHERE active = 1 ORDER BY sli_id`,
    );

  getProbes = async (start: Date, end: Date): Promise<ProbeRow[]> =>
    this.rows<ProbeRow>(
      `SELECT checked_at AS checkedAt, status FROM mon_probe
        WHERE checked_at >= ? AND checked_at < ?`,
      [start, end],
    );

  getRequests = async (start: Date, end: Date): Promise<RequestRow[]> =>
    this.rows<RequestRow>(
      `SELECT status, duration_ms AS durationMs, is_good AS isGood, source
         FROM mon_request_log WHERE occurred_at >= ? AND occurred_at < ?`,
      [start, end],
    );

  getLastRun = async (start: Date, end: Date): Promise<TestRunRow | null> => {
    const rows = await this.rows<TestRunRow>(
      `SELECT id, started_at AS startedAt, finished_at AS finishedAt, suite, complete,
              total_tests AS totalTests, passed_tests AS passedTests,
              failed_tests AS failedTests, source
         FROM mon_test_run
        WHERE finished_at >= ? AND finished_at < ?
        ORDER BY finished_at DESC LIMIT 1`,
      [start, end],
    );
    return rows[0] ?? null;
  };

  getLastBackup = async (fromDate: string, toDate: string): Promise<BackupRow | null> => {
    const rows = await this.rows<BackupRow>(
      `SELECT backup_date AS backupDate, status FROM mon_backup_log
        WHERE backup_date >= ? AND backup_date < ? ORDER BY backup_date DESC LIMIT 1`,
      [fromDate, toDate],
    );
    return rows[0] ?? null;
  };

  getRuns = async (limit: number, before?: Date): Promise<TestRunRow[]> => {
    const params: SqlValue[] = [];
    const beforeClause = before ? "AND finished_at < ?" : "";
    if (before) params.push(before);
    params.push(limit);
    return this.rows<TestRunRow>(
      `SELECT id, started_at AS startedAt, finished_at AS finishedAt, suite, complete,
              total_tests AS totalTests, passed_tests AS passedTests,
              failed_tests AS failedTests, source
         FROM mon_test_run WHERE 1 = 1 ${beforeClause}
        ORDER BY finished_at DESC LIMIT ?`,
      params,
    );
  };

  getRun = async (id: string): Promise<TestRunRow | null> => {
    const rows = await this.rows<TestRunRow>(
      `SELECT id, started_at AS startedAt, finished_at AS finishedAt, suite, complete,
              total_tests AS totalTests, passed_tests AS passedTests,
              failed_tests AS failedTests, source
         FROM mon_test_run WHERE id = ? LIMIT 1`,
      [id],
    );
    return rows[0] ?? null;
  };

  getResults = async (runId: string): Promise<TestResultRow[]> =>
    this.rows<TestResultRow>(
      `SELECT id, sli_id AS sliId, module, test_name AS testName, result,
              duration_ms AS durationMs, message,
              data_summary AS dataSummary, expected, obtained
         FROM mon_test_result WHERE run_id = ? ORDER BY occurred_at DESC, id DESC`,
      [runId],
    );

  getLogbook = async (filters: LogbookFilters): Promise<LogbookRow[]> => {
    const clauses = ["occurred_at >= ?", "occurred_at <= ?"];
    const params: SqlValue[] = [filters.from, filters.to];
    if (filters.module) {
      clauses.push("module = ?");
      params.push(filters.module);
    }
    if (filters.type) {
      clauses.push("type = ?");
      params.push(filters.type);
    }
    if (filters.status) {
      clauses.push("status_label = ?");
      params.push(filters.status === "success" ? "éxito" : "error");
    }
    if (filters.onlyOperations) {
      clauses.push(
        "type = 'business'",
        "source <> 'synthetic'",
        "operation NOT LIKE '%/api/v1/admin/monitoring/%'",
      );
    }
    if (filters.inSliOnly) clauses.push("sli_id IS NOT NULL");
    if (!filters.includeExcluded) clauses.push("excluded = 0");
    if (filters.cursor) {
      const parts = filters.cursor.split("|");
      const stamp = parts[0];
      const cursorId = parts[1];
      if (parts.length === 2 && stamp && cursorId && !Number.isNaN(Date.parse(stamp))) {
        clauses.push("(occurred_at < ? OR (occurred_at = ? AND CAST(id AS CHAR) < ?))");
        params.push(new Date(stamp), new Date(stamp), cursorId);
      }
    }
    params.push(filters.limit);
    return this.rows<LogbookRow>(
      `SELECT CAST(id AS CHAR) AS id, occurred_at AS occurredAt,
              occurred_at_local AS occurredAtLocal, type, module, operation,
              status_label AS statusLabel, duration_ms AS durationMs, message,
              source, request_id AS requestId, sli_id AS sliId, excluded
         FROM mon_v_logbook WHERE ${clauses.join(" AND ")}
        ORDER BY occurred_at DESC, CAST(id AS CHAR) DESC LIMIT ?`,
      params,
    );
  };

  getRequestExport = async (start: Date, end: Date): Promise<ExportRequestRow[]> =>
    this.rows<ExportRequestRow>(
      `SELECT occurred_at AS occurredAt, request_id AS requestId, method,
              route_pattern AS routePattern, status, duration_ms AS durationMs,
              role, sli_id AS sliId, source, is_good AS isGood
         FROM mon_request_log WHERE occurred_at >= ? AND occurred_at < ?
        ORDER BY occurred_at`,
      [start, end],
    );
}
