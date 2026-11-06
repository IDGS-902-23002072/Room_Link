export interface AnalyticsTotals {
  usersRegistered: number;
  activeRooms: number;
  connectionsSent: number;
  connectionsAccepted: number;
  avgDaysToClose: number | null;
}

export interface MonthlyMetric {
  month: string;
  total: number;
}

export interface IAnalyticsRepository {
  getTotals(start: Date, end: Date): Promise<AnalyticsTotals>;
  getUsersByMonth(start: Date, end: Date): Promise<MonthlyMetric[]>;
  getListingsByMonth(start: Date, end: Date): Promise<MonthlyMetric[]>;
}
