import { eq } from "drizzle-orm";
import { monitorDb } from "./db.js";
import { monIncident } from "./schema.js";
import { addBusinessHours, monthWindow } from "./time.js";
import { emitMonitorEvent } from "./writer.js";

export const RESPONSE_HOURS: Record<string, number> = {
  P0: 4, // 4 horas
  P1: 9, // 1 día hábil de 9 horas
  P2: 18, // 2 días hábiles
  P3: 45, // 5 días hábiles
};

interface GithubLabel {
  name?: string;
}

/** Solo etiquetas inocuas de GitHub: prioridad y módulo, nunca título ni texto. */
export function parseIncidentLabels(
  labels: Array<string | GithubLabel>,
): { priority: "P0" | "P1" | "P2" | "P3"; module: string } {
  const names = labels.map(labelName);
  const priority = names.find((label) => /^P[0-3]$/.test(label)) ?? "P2";
  const module = names.find((label) => /^M\d{1,2}$/.test(label))?.slice(0, 4) ?? "PLAT";
  return { priority: priority as "P0" | "P1" | "P2" | "P3", module };
}

interface GithubIssue {
  number: number;
  created_at: string;
  closed_at: string | null;
  comments_url: string;
  labels?: Array<string | GithubLabel>;
  user?: { login?: string };
  pull_request?: unknown;
}

interface GithubComment {
  created_at: string;
  user?: { login?: string };
}

const labelName = (label: string | GithubLabel): string =>
  typeof label === "string" ? label : label.name ?? "";

/** Trae incidentes de GitHub (F6) sin guardar títulos ni descripciones. */
export async function collectIncidents(period: string): Promise<number> {
  const repo = process.env.GITHUB_REPO;
  if (!repo) {
    emitMonitorEvent({ event: "incidents_skipped", reason: "GITHUB_REPO no configurado" });
    return 0;
  }

  const { start, end } = monthWindow(period);
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "roomlink-monitor",
  };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

  const response = await fetch(
    `https://api.github.com/repos/${repo}/issues?state=all&per_page=100&since=${start.toISOString()}`,
    { headers, signal: AbortSignal.timeout(10_000) },
  );
  if (!response.ok) {
    throw new Error(`GitHub respondió ${response.status} al consultar incidentes.`);
  }
  const issues = (await response.json()) as GithubIssue[];
  const existingRows = await monitorDb.select({ githubIssue: monIncident.githubIssue }).from(monIncident);
  const existing = new Set(existingRows.map((row) => row.githubIssue));
  let inserted = 0;

  for (const issue of issues) {
    if (issue.pull_request || !Number.isInteger(issue.number) || existing.has(issue.number)) continue;
    const openedAt = new Date(issue.created_at);
    if (Number.isNaN(openedAt.getTime()) || openedAt < start || openedAt >= end) continue;

    const { priority, module } = parseIncidentLabels(issue.labels ?? []);
    const author = issue.user?.login;

    let firstResponseAt: Date | null = null;
    try {
      const commentsResponse = await fetch(issue.comments_url, {
        headers,
        signal: AbortSignal.timeout(10_000),
      });
      if (commentsResponse.ok) {
        const comments = (await commentsResponse.json()) as GithubComment[];
        const first = comments.find((comment) => comment.user?.login !== author);
        if (first) firstResponseAt = new Date(first.created_at);
      }
    } catch {
      firstResponseAt = null;
    }

    await monitorDb.insert(monIncident).values({
      githubIssue: issue.number,
      priority: priority as "P0" | "P1" | "P2" | "P3",
      module,
      openedAt,
      firstResponseAt: firstResponseAt && !Number.isNaN(firstResponseAt.getTime()) ? firstResponseAt : null,
      restoredAt: issue.closed_at ? new Date(issue.closed_at) : null,
      closedAt: issue.closed_at ? new Date(issue.closed_at) : null,
      firstResponseDueAt: addBusinessHours(openedAt, RESPONSE_HOURS[priority] ?? RESPONSE_HOURS.P2 ?? 18),
    });
    inserted += 1;
  }

  return inserted;
}
