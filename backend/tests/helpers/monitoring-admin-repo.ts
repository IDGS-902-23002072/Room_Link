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
} from "../../src/modules/monitoring-admin/index.js";

/** Repositorio vacío para probar el panel sin base de monitoreo. */
export class FakeMonitoringAdminRepo implements MonitoringAdminRepository {
  getCompliance = async (): Promise<ComplianceRow[]> => [];
  getCatalog = async (): Promise<CatalogRow[]> => [];
  getProbes = async (): Promise<ProbeRow[]> => [];
  getRequests = async (): Promise<RequestRow[]> => [];
  getLastRun = async (): Promise<TestRunRow | null> => null;
  getLastBackup = async (): Promise<BackupRow | null> => null;
  getRuns = async (): Promise<TestRunRow[]> => [];
  getRun = async (): Promise<TestRunRow | null> => null;
  getResults = async (): Promise<TestResultRow[]> => [];
  getLogbook = async (_filters: LogbookFilters): Promise<LogbookRow[]> => [];
  getRequestExport = async (): Promise<ExportRequestRow[]> => [];
}
