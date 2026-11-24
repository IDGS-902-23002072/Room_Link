import { solicitud } from '@/modulos/compatibilidad/api';

export type Periodo = { start: string; end: string };
export type MetricaMensual = { month: string; total: number };
export type Dashboard = {
  period: Periodo;
  kpis: {
    usersRegistered: number;
    activeRooms: number;
    connectionsSent: number;
    connectionsAccepted: number;
    avgDaysToClose: number | null;
    connectionAcceptanceRate: number | null;
  };
  monthlyUsers: MetricaMensual[];
  monthlyListings: MetricaMensual[];
};
export type CorteDiario = {
  metricDate: string;
  usersRegistered: number;
  activeListings: number;
  connectionsSent: number;
  connectionsAccepted: number;
  listingsClosed: number;
  avgDaysToClose: number | null;
  avgAffinityScore: number | null;
};

const ruta = '/api/v1/admin/analytics';

export function obtenerDashboard(periodo: Periodo, signal: AbortSignal) {
  return solicitud<Dashboard>(`${ruta}?${new URLSearchParams(periodo)}`, { signal });
}

export async function obtenerCortes({ start, end }: Periodo, signal: AbortSignal) {
  const { items } = await solicitud<{ items: CorteDiario[] }>(
    `${ruta}?${new URLSearchParams({ from: start, to: end })}`, { signal },
  );
  return items;
}

export function recalcularCorte(fecha: string) {
  return solicitud<CorteDiario>(`${ruta}/recompute?${new URLSearchParams({ date: fecha })}`, { method: 'POST' });
}
