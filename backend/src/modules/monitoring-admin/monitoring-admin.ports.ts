/** Contratos de solo lectura de la base `roomlink_monitor` para el panel admin. */

export interface ComplianceRow {
  sliId: string;
  period: string;
  totalTx: number;
  goodTx: number;
  sliValue: string | null;
  sloValue: string | null;
  compliant: number | null;
  used3mWindow: number;
  message: string;
}

export interface CatalogRow {
  sliId: string;
  module: string;
  type: string;
  thresholdMs: number | null;
  sloPercent: string | null;
  method: string;
}

export interface ProbeRow {
  checkedAt: Date;
  status: string;
}

export interface RequestRow {
  status: number;
  durationMs: number;
  isGood: number;
  source: string;
}

export interface TestRunRow {
  id: string;
  startedAt: Date;
  finishedAt: Date;
  suite: string;
  complete: number;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  source: string;
}

export interface TestResultRow {
  id: number;
  sliId: string | null;
  module: string;
  testName: string;
  result: string;
  durationMs: number | null;
  message: string;
  dataSummary?: string | null;
  expected?: string | null;
  obtained?: string | null;
}

export interface BackupRow {
  backupDate: string;
  status: string;
}

export interface LogbookFilters {
  from: Date;
  to: Date;
  module?: string | undefined;
  type?: string | undefined;
  status?: string | undefined;
  inSliOnly?: boolean | undefined;
  includeExcluded?: boolean | undefined;
  cursor?: string | undefined;
  limit: number;
}

export interface LogbookRow {
  id: string;
  occurredAt: Date;
  occurredAtLocal: Date;
  type: string;
  module: string;
  operation: string;
  statusLabel: string;
  durationMs: number | null;
  message: string;
  source: string;
  requestId: string | null;
  sliId: string | null;
  excluded: number;
}

export interface ExportRequestRow {
  occurredAt: Date;
  requestId: string | null;
  method: string;
  routePattern: string;
  status: number;
  durationMs: number;
  role: string | null;
  sliId: string | null;
  source: string;
  isGood: number;
}

export interface MonitoringAdminRepository {
  getCompliance(period: string): Promise<ComplianceRow[]>;
  getCatalog(): Promise<CatalogRow[]>;
  getProbes(start: Date, end: Date): Promise<ProbeRow[]>;
  getRequests(start: Date, end: Date): Promise<RequestRow[]>;
  getLastRun(start: Date, end: Date): Promise<TestRunRow | null>;
  getLastBackup(fromDate: string, toDate: string): Promise<BackupRow | null>;
  getRuns(limit: number, before?: Date): Promise<TestRunRow[]>;
  getRun(id: string): Promise<TestRunRow | null>;
  getResults(runId: string): Promise<TestResultRow[]>;
  getLogbook(filters: LogbookFilters): Promise<LogbookRow[]>;
  getRequestExport(start: Date, end: Date): Promise<ExportRequestRow[]>;
}
