export interface ActivityLogEntryProps {
  id?: number;
  userId: string | null;
  action: string;
  metadata: Record<string, unknown>;
  ipAddress: string | null;
  createdAt: Date;
  /** Módulo donde ocurrió (por ejemplo "Autenticación"). Nulo en registros anteriores. */
  module?: string | null;
  /** Resultado: success, rejected o failed. Nulo en registros anteriores. */
  outcome?: string | null;
  /** Frase en español que explica qué ocurrió. Nulo en registros anteriores. */
  description?: string | null;
}

/**
 * Registro inmutable de una acción sensible del sistema. Se persiste en
 * `mod_activity_log` y nunca se modifica después de crearse.
 */
export class ActivityLogEntry {
  id: number | null;
  userId: string | null;
  action: string;
  metadata: Record<string, unknown>;
  ipAddress: string | null;
  createdAt: Date;
  module: string | null;
  outcome: string | null;
  description: string | null;

  constructor(props: ActivityLogEntryProps) {
    if (!props.action.trim()) {
      throw new Error("La acción es obligatoria.");
    }
    this.id = props.id ?? null;
    this.userId = props.userId;
    this.action = props.action;
    this.metadata = props.metadata;
    this.ipAddress = props.ipAddress;
    this.createdAt = props.createdAt;
    this.module = props.module ?? null;
    this.outcome = props.outcome ?? null;
    this.description = props.description ?? null;
  }
}
