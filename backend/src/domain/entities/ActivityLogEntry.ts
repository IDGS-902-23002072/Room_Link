export interface ActivityLogEntryProps {
  id?: number;
  userId: string | null;
  action: string;
  metadata: Record<string, unknown>;
  ipAddress: string | null;
  createdAt: Date;
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
  }
}
